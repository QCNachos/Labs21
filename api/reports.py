"""
Merged CEO reporting endpoints (daily reports + board meetings).

Routes (transparently rewritten by vercel.json):
  GET|POST|PATCH /api/daily_reports  → /api/reports?resource=daily
  GET|POST|PUT   /api/board_meetings → /api/reports?resource=board
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os
from datetime import datetime, timezone

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "").strip()
    return bool(secret) and token == secret


@app.route("/api/reports", methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"])
def reports():
    if request.method == "OPTIONS":
        return "", 204

    resource = request.args.get("resource")
    if resource == "daily":
        return _daily_reports()
    elif resource == "board":
        return _board_meetings()
    else:
        return jsonify({"error": "resource must be 'daily' or 'board'"}), 400


# ── Daily reports ──────────────────────────────────────────────────────────────

def _daily_reports():
    sb = get_supabase()

    if request.method == "GET":
        report_type = request.args.get("type")
        agent = request.args.get("agent", "ceo")
        limit = int(request.args.get("limit", 30))
        query = sb.table("ops_daily_reports").select("*").eq("agent_slug", agent).order("date", desc=True).limit(limit)
        if report_type:
            query = query.eq("report_type", report_type)
        return jsonify(query.execute().data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("agent_slug") or not body.get("content") or not body.get("date"):
            return jsonify({"error": "agent_slug, content, date required"}), 400
        res = sb.table("ops_daily_reports").insert({
            "agent_slug": body["agent_slug"],
            "date": body["date"],
            "report_type": body.get("report_type", "daily"),
            "content": body["content"],
            "questions": body.get("questions", []),
            "status": body.get("status", "draft"),
        }).execute()
        return jsonify(res.data[0] if res.data else {}), 201

    if request.method == "PATCH":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        report_id = body.get("id")
        if not report_id:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_daily_reports").update({
            "status": "sent",
            "email_sent_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", report_id).execute()
        return jsonify({"success": True})

    return jsonify({"error": "Method not allowed"}), 405


# ── Board meetings ─────────────────────────────────────────────────────────────

def _board_meetings():
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
        }).execute()
        return jsonify(res.data[0] if res.data else {}), 201

    if request.method == "PUT":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        meeting_id = body.pop("id", None)
        if not meeting_id:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_board_meetings").update(body).eq("id", meeting_id).execute()
        return jsonify({"success": True})

    return jsonify({"error": "Method not allowed"}), 405
