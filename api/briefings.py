"""
GET   /api/briefings   List briefings from CEO/CFO
PATCH /api/briefings   Mark briefing as read
POST  /api/briefings   Create a briefing (worker/agent use)
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "")
    secret = os.environ.get("OPS_API_SECRET", "")
    return bool(secret) and token == secret


@app.route("/api/briefings", methods=["GET", "POST", "PATCH", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PATCH", "OPTIONS"])
def briefings():
    if request.method == "OPTIONS":
        return "", 204
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

        data = query.execute()
        return jsonify(data.data or [])

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
