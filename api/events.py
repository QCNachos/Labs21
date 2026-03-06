"""
GET  /api/events   List agent events
POST /api/events   Emit an event (worker/agent use)
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


@app.route("/api/events", methods=["GET", "POST", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "OPTIONS"])
def events():
    if request.method == "OPTIONS":
        return "", 204
    sb = get_supabase()

    if request.method == "GET":
        agent = request.args.get("agent")
        event_type = request.args.get("type")
        limit = int(request.args.get("limit", 50))

        query = (
            sb.table("ops_agent_events")
            .select("*, agent:ops_agents!agent_slug(slug, name)")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if agent:
            query = query.eq("agent_slug", agent)
        if event_type:
            query = query.eq("event_type", event_type)

        return jsonify(query.execute().data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("event_type"):
            return jsonify({"error": "event_type required"}), 400
        sb.table("ops_agent_events").insert({
            "agent_slug": body.get("agent_slug"),
            "event_type": body["event_type"],
            "tags": body.get("tags", []),
            "payload": body.get("payload", {}),
        }).execute()
        return jsonify({"success": True}), 201
