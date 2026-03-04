"""
GET  /api/agents        List all agents with live stats
POST /api/agents        Create a new agent
PUT  /api/agents        Update an agent
"""
from flask import jsonify, request
from _utils import make_app, get_supabase, require_auth
from datetime import datetime, timezone, timedelta

app = make_app(__name__)


def _with_stats(sb, agents):
    result = []
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    for agent in agents:
        slug = agent["slug"]
        completed = sb.table("ops_missions").select("id", count="exact").eq("agent_slug", slug).eq("status", "succeeded").execute().count or 0
        active = sb.table("ops_missions").select("id", count="exact").eq("agent_slug", slug).in_("status", ["pending", "running"]).execute().count or 0
        events = sb.table("ops_agent_events").select("id", count="exact").eq("agent_slug", slug).gte("created_at", cutoff).execute().count or 0
        result.append({**agent, "stats": {"completed_missions": completed, "active_missions": active, "events_24h": events}})
    return result


@app.route("/api/agents", methods=["GET", "POST", "PUT", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PUT", "OPTIONS"])
def agents():
    if request.method == "OPTIONS":
        return "", 204
    sb = get_supabase()

    if request.method == "GET":
        data = sb.table("ops_agents").select("*").order("id").execute()
        return jsonify(_with_stats(sb, data.data or []))

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        required = ["slug", "name"]
        for f in required:
            if not body.get(f):
                return jsonify({"error": f"{f} required"}), 400
        res = sb.table("ops_agents").insert({
            "slug": body["slug"],
            "name": body["name"],
            "title": body.get("title"),
            "department": body.get("department"),
            "reports_to": body.get("reports_to"),
            "can_approve": body.get("can_approve", False),
            "role_desc": body.get("role_desc"),
            "system_prompt": body.get("system_prompt"),
            "schedule": body.get("schedule", {}),
            "config": body.get("config", {}),
            "model_provider": body.get("model_provider"),
            "model_name": body.get("model_name"),
            "model_subscription": body.get("model_subscription"),
            "compute_provider": body.get("compute_provider"),
            "compute_details": body.get("compute_details"),
            "wallet_address": body.get("wallet_address"),
            "wallet_chain": body.get("wallet_chain"),
            "daily_cost_usd": body.get("daily_cost_usd"),
        }).select().single().execute()
        return jsonify(res.data), 201

    if request.method == "PUT":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        agent_id = body.pop("id", None)
        if not agent_id:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_agents").update(body).eq("id", agent_id).execute()
        return jsonify({"success": True})


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "")
    import os
    secret = os.environ.get("OPS_API_SECRET", "")
    return bool(secret) and token == secret
