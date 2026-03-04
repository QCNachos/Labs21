"""
POST /api/steps/claim   Claim the next queued step (for VPS worker)
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


@app.route("/api/steps/claim", methods=["POST", "OPTIONS"])
@app.route("/", methods=["POST", "OPTIONS"])
def claim():
    if request.method == "OPTIONS":
        return "", 204
    if not _is_auth():
        return jsonify({"error": "Unauthorized"}), 401

    sb = get_supabase()
    body = request.get_json() or {}
    worker_id = body.get("worker_id", "worker-1")
    now = datetime.now(timezone.utc).isoformat()

    # Get oldest queued step
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

    # Claim it atomically
    result = (
        sb.table("ops_mission_steps")
        .update({"status": "running", "claimed_by": worker_id, "reserved_at": now})
        .eq("id", step["id"])
        .eq("status", "queued")  # optimistic lock
        .execute()
    )

    if not result.data:
        return jsonify({"step": None})  # lost race

    # Start mission if not already running
    sb.table("ops_missions").update({"status": "running", "started_at": now}).eq("id", step["mission_id"]).eq("status", "pending").execute()

    # Emit event
    sb.table("ops_agent_events").insert({
        "agent_slug": step["agent_slug"],
        "event_type": "step:claimed",
        "tags": ["step", step["step_kind"]],
        "payload": {"step_id": step["id"], "worker_id": worker_id},
    }).execute()

    return jsonify({"step": step})
