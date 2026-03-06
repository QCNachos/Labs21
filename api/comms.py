"""
Merged CEO communication endpoints (briefings + instructions).

Routes (transparently rewritten by vercel.json):
  GET|POST|PATCH /api/briefings   → /api/comms?resource=briefings
  GET|POST       /api/instructions → /api/comms?resource=instructions
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "")
    return bool(secret) and token == secret


@app.route("/api/comms", methods=["GET", "POST", "PATCH", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PATCH", "OPTIONS"])
def comms():
    if request.method == "OPTIONS":
        return "", 204

    resource = request.args.get("resource")
    if resource == "briefings":
        return _briefings()
    elif resource == "instructions":
        return _instructions()
    else:
        return jsonify({"error": "resource must be 'briefings' or 'instructions'"}), 400


# ── Briefings ──────────────────────────────────────────────────────────────────

def _briefings():
    sb = get_supabase()

    if request.method == "GET":
        unread_only = request.args.get("unread") == "true"
        briefing_type = request.args.get("type")
        limit = int(request.args.get("limit", 50))

        query = (
            sb.table("ops_briefings")
            .select("*, agent:ops_agents!agent_slug(slug, name, title, avatar_url)")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if unread_only:
            query = query.eq("read", False)
        if briefing_type:
            query = query.eq("briefing_type", briefing_type)

        return jsonify(query.execute().data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("agent_slug") or not body.get("title") or not body.get("content"):
            return jsonify({"error": "agent_slug, title, content required"}), 400
        res = sb.table("ops_briefings").insert({
            "agent_slug": body["agent_slug"],
            "briefing_type": body.get("briefing_type", "daily"),
            "title": body["title"],
            "content": body["content"],
            "priority": body.get("priority", "normal"),
            "projects": body.get("projects", []),
            "metadata": body.get("metadata", {}),
        }).select().single().execute()
        return jsonify(res.data), 201

    if request.method == "PATCH":
        body = request.get_json() or {}
        briefing_id = body.get("id")
        if not briefing_id:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_briefings").update({"read": body.get("read", True)}).eq("id", briefing_id).execute()
        return jsonify({"success": True})

    return jsonify({"error": "Method not allowed"}), 405


# ── Instructions ───────────────────────────────────────────────────────────────

def _instructions():
    sb = get_supabase()

    if request.method == "GET":
        status = request.args.get("status")
        limit = int(request.args.get("limit", 50))
        query = sb.table("ops_instructions").select("*").order("created_at", desc=True).limit(limit)
        if status:
            query = query.eq("status", status)
        return jsonify(query.execute().data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("target_agent") or not body.get("instruction"):
            return jsonify({"error": "target_agent and instruction required"}), 400

        res = sb.table("ops_instructions").insert({
            "target_agent": body["target_agent"],
            "instruction": body["instruction"],
            "priority": body.get("priority", "normal"),
            "project_slug": body.get("project_slug"),
            "status": "acknowledged",
        }).select("id").single().execute()

        sb.table("ops_agent_events").insert({
            "agent_slug": body["target_agent"],
            "event_type": "instruction:received",
            "tags": ["instruction", "board_director", body.get("priority", "normal")],
            "payload": {"instruction_id": res.data["id"], "instruction": body["instruction"][:200]},
        }).execute()

        return jsonify({"success": True, "instruction_id": res.data["id"]}), 201

    return jsonify({"error": "Method not allowed"}), 405
