"""
GET   /api/proposals           List proposals
POST  /api/proposals           Create proposal (with optional auto-approve)
PATCH /api/proposals           Approve or reject a proposal
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os
from datetime import datetime, timezone

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "").strip()
    return bool(secret) and token == secret


def _auto_approve_allowed(sb, step_kinds: list) -> bool:
    policy = sb.table("ops_policy").select("value").eq("key", "auto_approve").single().execute()
    if not policy.data:
        return False
    cfg = policy.data.get("value", {})
    if not cfg.get("enabled"):
        return False
    allowed = set(cfg.get("allowed_step_kinds", []))
    return all(sk in allowed for sk in step_kinds)


def _emit(sb, agent_slug, event_type, tags, payload):
    sb.table("ops_agent_events").insert({"agent_slug": agent_slug, "event_type": event_type, "tags": tags, "payload": payload}).execute()


@app.route("/api/proposals", methods=["GET", "POST", "PATCH", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PATCH", "OPTIONS"])
def proposals():
    if request.method == "OPTIONS":
        return "", 204
    sb = get_supabase()

    if request.method == "GET":
        status = request.args.get("status")
        limit = int(request.args.get("limit", 100))
        query = sb.table("ops_mission_proposals").select("*").order("created_at", desc=True).limit(limit)
        if status:
            query = query.eq("status", status)
        return jsonify(query.execute().data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("agent_slug") or not body.get("title"):
            return jsonify({"error": "agent_slug and title required"}), 400

        step_kinds = body.get("step_kinds", [])
        auto_approve = _auto_approve_allowed(sb, step_kinds)

        proposal = sb.table("ops_mission_proposals").insert({
            "agent_slug": body["agent_slug"],
            "title": body["title"],
            "description": body.get("description"),
            "source": body.get("source", "api"),
            "priority": body.get("priority", 5),
            "step_kinds": step_kinds,
            "metadata": body.get("metadata", {}),
            "status": "accepted" if auto_approve else "pending",
            "decided_at": datetime.now(timezone.utc).isoformat() if auto_approve else None,
        }).execute()

        proposal_row = proposal.data[0] if proposal.data else {}
        mission_id = None
        if auto_approve:
            mission = sb.table("ops_missions").insert({
                "proposal_id": proposal_row["id"],
                "agent_slug": body["agent_slug"],
                "title": body["title"],
                "description": body.get("description"),
                "priority": body.get("priority", 5),
                "status": "pending",
            }).execute()
            mission_row = mission.data[0] if mission.data else {}
            mission_id = mission_row.get("id")
            for i, sk in enumerate(step_kinds):
                sb.table("ops_mission_steps").insert({
                    "mission_id": mission_id,
                    "agent_slug": body["agent_slug"],
                    "step_kind": sk,
                    "step_order": i,
                    "status": "queued",
                    "input": body.get("metadata", {}),
                }).execute()
            _emit(sb, body["agent_slug"], "proposal:auto_approved", ["proposal", "auto_approved"], {"proposal_id": proposal_row["id"]})

        return jsonify({"success": True, "proposal_id": proposal_row.get("id"), "mission_id": mission_id, "auto_approved": auto_approve}), 201

    if request.method == "PATCH":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        proposal_id = body.get("id")
        action = body.get("action")  # "approve" or "reject"
        if not proposal_id or not action:
            return jsonify({"error": "id and action required"}), 400

        proposal = sb.table("ops_mission_proposals").select("*").eq("id", proposal_id).single().execute()
        if not proposal.data:
            return jsonify({"error": "Not found"}), 404

        now = datetime.now(timezone.utc).isoformat()
        if action == "approve":
            sb.table("ops_mission_proposals").update({"status": "accepted", "decided_at": now}).eq("id", proposal_id).execute()
            mission = sb.table("ops_missions").insert({
                "proposal_id": proposal_id,
                "agent_slug": proposal.data["agent_slug"],
                "title": proposal.data["title"],
                "description": proposal.data.get("description"),
                "priority": proposal.data.get("priority", 5),
                "status": "pending",
            }).execute()
            mission_row = mission.data[0] if mission.data else {}
            for i, sk in enumerate(proposal.data.get("step_kinds", [])):
                sb.table("ops_mission_steps").insert({
                    "mission_id": mission_row.get("id"),
                    "agent_slug": proposal.data["agent_slug"],
                    "step_kind": sk,
                    "step_order": i,
                    "status": "queued",
                    "input": proposal.data.get("metadata", {}),
                }).execute()
            return jsonify({"success": True, "mission_id": mission_row.get("id")})
        else:
            sb.table("ops_mission_proposals").update({
                "status": "rejected",
                "decided_at": now,
                "reject_reason": body.get("reason", "Rejected by Board Director"),
            }).eq("id", proposal_id).execute()
            return jsonify({"success": True})
