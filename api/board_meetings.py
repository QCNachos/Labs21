"""
GET  /api/board_meetings   List board meetings
POST /api/board_meetings   Create/record a board meeting
PUT  /api/board_meetings   Update a board meeting
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


@app.route("/api/board_meetings", methods=["GET", "POST", "PUT", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PUT", "OPTIONS"])
def board_meetings():
    if request.method == "OPTIONS":
        return "", 204
    sb = get_supabase()

    if request.method == "GET":
        limit = int(request.args.get("limit", 12))
        data = sb.table("ops_board_meetings").select("*").order("date", desc=True).limit(limit).execute()
        return jsonify(data.data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("title") or not body.get("date"):
            return jsonify({"error": "title and date required"}), 400
        res = sb.table("ops_board_meetings").insert({
            "date": body["date"],
            "title": body["title"],
            "summary": body.get("summary", ""),
            "decisions": body.get("decisions", []),
            "action_items": body.get("action_items", []),
            "created_by": body.get("created_by", "board_director"),
        }).select().single().execute()
        return jsonify(res.data), 201

    if request.method == "PUT":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        meeting_id = body.pop("id", None)
        if not meeting_id:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_board_meetings").update(body).eq("id", meeting_id).execute()
        return jsonify({"success": True})
