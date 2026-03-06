"""
GET  /api/departments   List all departments
POST /api/departments   Create a department
PUT  /api/departments   Update a department (especially Drive folder URL)
"""
from flask import jsonify, request
from _utils import make_app, get_supabase
import os

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "").strip()
    return bool(secret) and token == secret


@app.route("/api/departments", methods=["GET", "POST", "PUT", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PUT", "OPTIONS"])
def departments():
    if request.method == "OPTIONS":
        return "", 204
    sb = get_supabase()

    if request.method == "GET":
        data = sb.table("ops_departments").select("*").order("order_index").execute()
        return jsonify(data.data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("name"):
            return jsonify({"error": "name required"}), 400
        res = sb.table("ops_departments").insert({
            "name": body["name"],
            "description": body.get("description"),
            "drive_folder_url": body.get("drive_folder_url"),
            "icon": body.get("icon"),
            "order_index": body.get("order_index", 99),
        }).execute()
        return jsonify(res.data[0] if res.data else {}), 201

    if request.method == "PUT":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        dept_id = body.pop("id", None)
        if not dept_id:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_departments").update(body).eq("id", dept_id).execute()
        return jsonify({"success": True})
