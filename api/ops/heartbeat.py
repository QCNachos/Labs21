"""
POST /api/ops/heartbeat   Trigger heartbeat: evaluate trigger rules, process reactions
Called by: VPS crontab
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os
import random
from datetime import datetime, timezone

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "")
    return bool(secret) and token == secret


@app.route("/api/ops/heartbeat", methods=["POST", "OPTIONS"])
@app.route("/", methods=["POST", "OPTIONS"])
def heartbeat():
    if request.method == "OPTIONS":
        return "", 204
    if not _is_auth():
        return jsonify({"error": "Unauthorized"}), 401

    sb = get_supabase()
    now = datetime.now(timezone.utc)
    results = {"triggers": {"evaluated": 0, "fired": 0}, "reactions": {"processed": 0, "created": 0}, "timestamp": now.isoformat()}

    # --- Evaluate trigger rules ---
    triggers = sb.table("ops_trigger_rules").select("*").eq("enabled", True).execute().data or []
    results["triggers"]["evaluated"] = len(triggers)
    for rule in triggers:
        condition = rule.get("condition", {})
        event_type = condition.get("event_type", "")

        # Only fire schedule-based triggers (real event triggers are fired by worker)
        if not event_type.startswith("schedule:"):
            continue

        last_fired = rule.get("last_fired_at")
        cooldown_min = rule.get("cooldown_min", 60)
        if last_fired:
            from datetime import timedelta
            last_dt = datetime.fromisoformat(last_fired.replace("Z", "+00:00"))
            if (now - last_dt).total_seconds() < cooldown_min * 60:
                continue

        # Fire: create a proposal
        action = rule.get("action", {})
        if action.get("agent_slug") and action.get("title"):
            sb.table("ops_mission_proposals").insert({
                "agent_slug": action["agent_slug"],
                "title": action["title"],
                "source": "trigger",
                "priority": action.get("priority", 5),
                "step_kinds": action.get("step_kinds", []),
                "metadata": {"trigger_rule": rule["name"]},
                "status": "pending",
            }).execute()
            sb.table("ops_trigger_rules").update({"last_fired_at": now.isoformat(), "fire_count": rule.get("fire_count", 0) + 1}).eq("id", rule["id"]).execute()
            results["triggers"]["fired"] += 1

    # --- Process pending reactions ---
    reactions = sb.table("ops_agent_reactions").select("*").eq("status", "pending").limit(10).execute().data or []
    results["reactions"]["processed"] = len(reactions)
    for reaction in reactions:
        sb.table("ops_agent_reactions").update({"status": "processing"}).eq("id", reaction["id"]).execute()
        sb.table("ops_mission_proposals").insert({
            "agent_slug": reaction["target_agent"],
            "title": f"React: {reaction['reaction_type']}",
            "source": "reaction",
            "priority": 5,
            "step_kinds": [reaction["reaction_type"]],
            "metadata": {"reaction_id": reaction["id"]},
            "status": "pending",
        }).execute()
        sb.table("ops_agent_reactions").update({"status": "completed"}).eq("id", reaction["id"]).execute()
        results["reactions"]["created"] += 1

    return jsonify(results)
