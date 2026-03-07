"""
Consolidated admin endpoint for templates, usage, and integrations.
Routes via ?resource=templates|usage|integrations

GET/POST/PUT/DELETE /api/admin?resource=templates
GET                 /api/admin?resource=usage
GET/POST            /api/admin?resource=integrations
"""
import os
import re
from datetime import datetime, timezone, timedelta
from flask import jsonify, request
from _utils import make_app, get_supabase

app = make_app(__name__)


def _is_auth():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "").strip()
    return bool(secret) and token == secret


@app.route("/api/admin", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
@app.route("/", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
def admin():
    if request.method == "OPTIONS":
        return "", 204

    resource = request.args.get("resource")
    if resource == "templates":
        return _templates()
    elif resource == "usage":
        return _usage()
    elif resource == "integrations":
        return _integrations()
    elif resource == "render":
        return _render_template()
    else:
        return jsonify({"error": "resource must be templates, usage, integrations, or render"}), 400


# ── Templates ──────────────────────────────────────────────────

def _templates():
    sb = get_supabase()

    if request.method == "GET":
        template_id = request.args.get("id")
        if template_id:
            res = sb.table("ops_templates").select("*").eq("id", template_id).single().execute()
            return jsonify(res.data) if res.data else (jsonify({"error": "Not found"}), 404)
        ttype = request.args.get("type")
        query = sb.table("ops_templates").select("*").order("created_at", desc=True)
        if ttype:
            query = query.eq("type", ttype)
        return jsonify(query.execute().data or [])

    if not _is_auth():
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "POST":
        body = request.get_json() or {}
        if not body.get("name") or not body.get("body"):
            return jsonify({"error": "name and body required"}), 400
        res = sb.table("ops_templates").insert({
            "name": body["name"],
            "type": body.get("type", "general"),
            "body": body["body"],
            "variables": body.get("variables", []),
            "metadata": body.get("metadata", {}),
        }).execute()
        return jsonify(res.data[0] if res.data else {}), 201

    if request.method == "PUT":
        body = request.get_json() or {}
        tid = body.pop("id", None)
        if not tid:
            return jsonify({"error": "id required"}), 400
        allowed = {"name", "type", "body", "variables", "metadata"}
        updates = {k: v for k, v in body.items() if k in allowed}
        if updates:
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            updates["version"] = sb.table("ops_templates").select("version").eq("id", tid).single().execute().data.get("version", 1) + 1
        sb.table("ops_templates").update(updates).eq("id", tid).execute()
        return jsonify({"success": True})

    if request.method == "DELETE":
        tid = request.args.get("id")
        if not tid:
            return jsonify({"error": "id required"}), 400
        sb.table("ops_templates").delete().eq("id", tid).execute()
        return jsonify({"success": True})


# ── Template rendering ─────────────────────────────────────────

def _render_template():
    if not _is_auth():
        return jsonify({"error": "Unauthorized"}), 401
    sb = get_supabase()
    body = request.get_json() or {}
    template_id = body.get("template_id")
    variables = body.get("variables", {})

    if not template_id:
        return jsonify({"error": "template_id required"}), 400

    tmpl = sb.table("ops_templates").select("*").eq("id", template_id).single().execute()
    if not tmpl.data:
        return jsonify({"error": "Template not found"}), 404

    rendered = tmpl.data["body"]
    for key, val in variables.items():
        rendered = rendered.replace("{{" + key + "}}", str(val))

    # Remove any unreplaced variables
    rendered = re.sub(r"\{\{[^}]+\}\}", "", rendered)

    sb.table("ops_template_runs").insert({
        "template_id": template_id,
        "rendered_body": rendered,
        "variables_used": variables,
    }).execute()

    return jsonify({"rendered": rendered, "rendered_body": rendered, "template_name": tmpl.data["name"]})


# ── Usage stats ────────────────────────────────────────────────

def _usage():
    sb = get_supabase()
    days = int(request.args.get("days", 30))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()

    # Get step-level cost data
    steps = (
        sb.table("ops_mission_steps")
        .select("agent_slug, model_used, token_count_in, token_count_out, cost_estimate, completed_at")
        .gte("completed_at", cutoff)
        .not_.is_("completed_at", "null")
        .order("completed_at", desc=True)
        .limit(5000)
        .execute()
    )

    rows = steps.data or []

    total_in = sum(r.get("token_count_in", 0) or 0 for r in rows)
    total_out = sum(r.get("token_count_out", 0) or 0 for r in rows)
    total_cost = sum(float(r.get("cost_estimate", 0) or 0) for r in rows)
    total_runs = len(rows)

    by_agent: dict = {}
    by_model: dict = {}
    daily: dict = {}

    for r in rows:
        slug = r.get("agent_slug") or "unknown"
        model = r.get("model_used") or "unknown"
        tokens = (r.get("token_count_in", 0) or 0) + (r.get("token_count_out", 0) or 0)
        cost = float(r.get("cost_estimate", 0) or 0)
        date_str = (r.get("completed_at") or "")[:10]

        if slug not in by_agent:
            by_agent[slug] = {"agent_slug": slug, "tokens": 0, "cost": 0, "runs": 0}
        by_agent[slug]["tokens"] += tokens
        by_agent[slug]["cost"] += cost
        by_agent[slug]["runs"] += 1

        if model not in by_model:
            by_model[model] = {"model": model, "tokens": 0, "cost": 0, "runs": 0}
        by_model[model]["tokens"] += tokens
        by_model[model]["cost"] += cost
        by_model[model]["runs"] += 1

        if date_str and date_str not in daily:
            daily[date_str] = {"date": date_str, "tokens": 0, "cost": 0, "runs": 0}
        if date_str:
            daily[date_str]["tokens"] += tokens
            daily[date_str]["cost"] += cost
            daily[date_str]["runs"] += 1

    return jsonify({
        "total_tokens_in": total_in,
        "total_tokens_out": total_out,
        "total_cost": round(total_cost, 6),
        "total_runs": total_runs,
        "by_agent": sorted(by_agent.values(), key=lambda x: x["cost"], reverse=True),
        "by_model": sorted(by_model.values(), key=lambda x: x["cost"], reverse=True),
        "daily": sorted(daily.values(), key=lambda x: x["date"]),
    })


# ── Integrations ───────────────────────────────────────────────

def _integrations():
    sb = get_supabase()

    if request.method == "GET":
        return jsonify(sb.table("ops_integrations").select("*").order("created_at").execute().data or [])

    if not _is_auth():
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "POST":
        body = request.get_json() or {}
        if not body.get("provider"):
            return jsonify({"error": "provider required"}), 400
        res = sb.table("ops_integrations").insert({
            "provider": body["provider"],
            "status": body.get("status", "disconnected"),
            "config": body.get("config", {}),
        }).execute()
        return jsonify(res.data[0] if res.data else {}), 201
