"""
POST /api/steps/complete   Mark a step complete (for VPS worker)
Body: { step_id, status, output?, error? }
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os
from datetime import datetime, timezone

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "")
    secret = os.environ.get("OPS_API_SECRET", "")
    return bool(secret) and token == secret


@app.route("/api/steps/complete", methods=["POST", "OPTIONS"])
@app.route("/", methods=["POST", "OPTIONS"])
def complete():
    if request.method == "OPTIONS":
        return "", 204
    if not _is_auth():
        return jsonify({"error": "Unauthorized"}), 401

    sb = get_supabase()
    body = request.get_json() or {}
    step_id = body.get("step_id")
    status = body.get("status", "succeeded")

    if not step_id:
        return jsonify({"error": "step_id required"}), 400

    now = datetime.now(timezone.utc).isoformat()

    # Update step
    sb.table("ops_mission_steps").update({
        "status": status,
        "output": body.get("output"),
        "last_error": body.get("error"),
        "completed_at": now,
    }).eq("id", step_id).execute()

    # Get step to find mission
    step = sb.table("ops_mission_steps").select("mission_id, agent_slug, step_kind").eq("id", step_id).single().execute()
    if not step.data:
        return jsonify({"success": True})

    mission_id = step.data["mission_id"]
    agent_slug = step.data["agent_slug"]

    # Check if all steps are done
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

    # Emit step event
    sb.table("ops_agent_events").insert({
        "agent_slug": agent_slug,
        "event_type": f"step:{status}",
        "tags": ["step", step.data["step_kind"], status],
        "payload": {"step_id": step_id, "mission_id": mission_id},
    }).execute()

    return jsonify({"success": True})
