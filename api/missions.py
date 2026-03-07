"""
GET /api/missions   List missions with steps
"""
from flask import jsonify, request
from _utils import make_app, get_supabase

app = make_app(__name__)


@app.route("/api/missions", methods=["GET", "OPTIONS"])
@app.route("/", methods=["GET", "OPTIONS"])
def missions():
    if request.method == "OPTIONS":
        return "", 204
    sb = get_supabase()

    mission_id = request.args.get("id")
    if mission_id:
        data = sb.table("ops_missions").select("*, steps:ops_mission_steps(*), agent:ops_agents!agent_slug(slug, name, title)").eq("id", mission_id).execute()
        return jsonify(data.data or [])

    status = request.args.get("status")
    agent = request.args.get("agent")
    limit = int(request.args.get("limit", 100))

    query = sb.table("ops_missions").select("*, steps:ops_mission_steps(*)").order("created_at", desc=True).limit(limit)
    if status:
        query = query.eq("status", status)
    if agent:
        query = query.eq("agent_slug", agent)

    data = query.execute()
    return jsonify(data.data or [])
