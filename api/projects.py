"""
GET  /api/projects        List all projects (with optional sector filter)
POST /api/projects        Create a project
PUT  /api/projects        Update a project
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


@app.route("/api/projects", methods=["GET", "POST", "PUT", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PUT", "OPTIONS"])
def projects():
    if request.method == "OPTIONS":
        return "", 204
    sb = get_supabase()

    if request.method == "GET":
        sector = request.args.get("sector")
        query = sb.table("ops_projects").select("*").order("priority").order("created_at", desc=True)
        if sector:
            query = query.eq("sector", sector)
        data = query.execute()
        return jsonify(data.data or [])

    if request.method == "POST":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        if not body.get("name") or not body.get("slug"):
            return jsonify({"error": "name and slug required"}), 400
        res = sb.table("ops_projects").insert({
            "name": body["name"],
            "slug": body["slug"],
            "description": body.get("description"),
            "stage": body.get("stage", "idea"),
            "sector": body.get("sector", "others"),
            "sub_sector": body.get("sub_sector"),
            "category": body.get("category", "other"),
            "github_repos": body.get("github_repos", []),
            "website_url": body.get("website_url"),
            "tech_stack": body.get("tech_stack", []),
            "goals": body.get("goals", []),
            "financials": body.get("financials", {}),
            "team_notes": body.get("team_notes"),
            "pitch_url": body.get("pitch_url"),
            "links": body.get("links", {}),
            "is_active": body.get("is_active", True),
            "priority": body.get("priority", 3),
            "status": body.get("status", "active"),
        }).select().single().execute()
        return jsonify(res.data), 201

    if request.method == "PUT":
        if not _is_auth():
            return jsonify({"error": "Unauthorized"}), 401
        body = request.get_json() or {}
        project_id = body.pop("id", None)
        if not project_id:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_projects").update(body).eq("id", project_id).execute()
        return jsonify({"success": True})
