"""
POST /api/steps?action=claim    Claim the next queued step (VPS worker)
POST /api/steps?action=complete  Mark a step complete (VPS worker)

Merged from steps/claim.py and steps/complete.py to stay within Vercel
Hobby plan 12-function limit. Vercel rewrites /api/steps/claim and
/api/steps/complete to /api/steps?action=claim / ?action=complete.
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os
from datetime import datetime, timezone

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "")
    return bool(secret) and token == secret


@app.route("/api/steps", methods=["POST", "OPTIONS"])
@app.route("/", methods=["POST", "OPTIONS"])
def steps():
    if request.method == "OPTIONS":
        return "", 204
    if not _is_auth():
        return jsonify({"error": "Unauthorized"}), 401

    action = request.args.get("action")
    if action == "claim":
        return _claim()
    elif action == "complete":
        return _complete()
    else:
        return jsonify({"error": "action must be 'claim' or 'complete'"}), 400


def _claim():
    sb = get_supabase()
    body = request.get_json() or {}
    worker_id = body.get("worker_id", "worker-1")
    now = datetime.now(timezone.utc).isoformat()

    steps = (
        sb.table("ops_mission_steps")
        .select("*, mission:ops_missions!mission_id(agent_slug, title, description, status)")
        .eq("status", "queued")
        .order("step_order")
        .order("created_at")
        .limit(1)
        .execute()
    )

    if not steps.data:
        return jsonify({"step": None})

    step = steps.data[0]

    result = (
        sb.table("ops_mission_steps")
        .update({"status": "running", "claimed_by": worker_id, "reserved_at": now})
        .eq("id", step["id"])
        .eq("status", "queued")
        .execute()
    )

    if not result.data:
        return jsonify({"step": None})

    sb.table("ops_missions").update({"status": "running", "started_at": now}).eq("id", step["mission_id"]).eq("status", "pending").execute()

    sb.table("ops_agent_events").insert({
        "agent_slug": step["agent_slug"],
        "event_type": "step:claimed",
        "tags": ["step", step["step_kind"]],
        "payload": {"step_id": step["id"], "worker_id": worker_id},
    }).execute()

    return jsonify({"step": step})


def _complete():
    sb = get_supabase()
    body = request.get_json() or {}
    step_id = body.get("step_id")
    status = body.get("status", "succeeded")

    if not step_id:
        return jsonify({"error": "step_id required"}), 400

    now = datetime.now(timezone.utc).isoformat()

    sb.table("ops_mission_steps").update({
        "status": status,
        "output": body.get("output"),
        "last_error": body.get("error"),
        "completed_at": now,
    }).eq("id", step_id).execute()

    step = sb.table("ops_mission_steps").select("mission_id, agent_slug, step_kind").eq("id", step_id).single().execute()
    if not step.data:
        return jsonify({"success": True})

    mission_id = step.data["mission_id"]
    agent_slug = step.data["agent_slug"]

    all_steps = sb.table("ops_mission_steps").select("status").eq("mission_id", mission_id).execute().data or []
    terminal = {"succeeded", "failed", "skipped"}
    all_done = all(s["status"] in terminal for s in all_steps)

    if all_done:
        any_failed = any(s["status"] == "failed" for s in all_steps)
        mission_status = "failed" if any_failed else "succeeded"
        sb.table("ops_missions").update({"status": mission_status, "completed_at": now}).eq("id", mission_id).execute()
        sb.table("ops_agent_events").insert({
            "agent_slug": agent_slug,
            "event_type": f"mission:{mission_status}",
            "tags": ["mission", mission_status],
            "payload": {"mission_id": mission_id},
        }).execute()

    sb.table("ops_agent_events").insert({
        "agent_slug": agent_slug,
        "event_type": f"step:{status}",
        "tags": ["step", step.data["step_kind"], status],
        "payload": {"step_id": step_id, "mission_id": mission_id},
    }).execute()

    return jsonify({"success": True})
