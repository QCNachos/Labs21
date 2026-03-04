"""
GET  /api/daily_reports   List daily/weekly/monthly CEO reports
POST /api/daily_reports   Create/store a report (from worker)
PATCH /api/daily_reports  Mark report as sent
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


@app.route("/api/daily_reports", methods=["GET", "POST", "PATCH", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PATCH", "OPTIONS"])
def daily_reports():
    if request.method == "OPTIONS":
        return "", 204
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
        }).select().single().execute()
        return jsonify(res.data), 201

    if request.method == "PATCH":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        report_id = body.get("id")
        if not report_id:
            return jsonify({"error": "id required"}), 400
        from datetime import datetime, timezone
        sb.table("ops_daily_reports").update({
            "status": "sent",
            "email_sent_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", report_id).execute()
        return jsonify({"success": True})
