"""
GET  /api/instructions   List Board Director instructions
POST /api/instructions   Send instruction to an agent
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


def _emit_event(sb, agent_slug, event_type, tags, payload):
    sb.table("ops_agent_events").insert({
        "agent_slug": agent_slug,
        "event_type": event_type,
        "tags": tags,
        "payload": payload,
    }).execute()


@app.route("/api/instructions", methods=["GET", "POST", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "OPTIONS"])
def instructions():
    if request.method == "OPTIONS":
        return "", 204
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

        _emit_event(sb, body["target_agent"], "instruction:received",
                    ["instruction", "board_director", body.get("priority", "normal")],
                    {"instruction_id": res.data["id"], "instruction": body["instruction"][:200]})

        return jsonify({"success": True, "instruction_id": res.data["id"]}), 201
