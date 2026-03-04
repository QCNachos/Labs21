"""
Flask app for the VPS backend.

Provides:
1. Health check endpoint
2. Worker status endpoint
3. Direct proposal creation endpoint (for OpenClaw/cron jobs)
"""

import threading
from flask import Flask, jsonify, request
from config import Config
from worker import run_worker_loop
from supabase_client import get_supabase
import requests

app = Flask(__name__)


def verify_token():
    """Verify the bearer token."""
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "")
    return token == Config.OPS_API_SECRET


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "worker_id": Config.WORKER_ID})


@app.route("/status", methods=["GET"])
def status():
    if not verify_token():
        return jsonify({"error": "Unauthorized"}), 401

    sb = get_supabase()

    # Get current running steps
    running = (
        sb.table("ops_mission_steps")
        .select("id, step_kind, agent_slug, reserved_at")
        .eq("status", "running")
        .eq("claimed_by", Config.WORKER_ID)
        .execute()
    )

    # Get queue depth
    queued = (
        sb.table("ops_mission_steps")
        .select("id", count="exact")
        .eq("status", "queued")
        .execute()
    )

    return jsonify(
        {
            "worker_id": Config.WORKER_ID,
            "running_steps": running.data,
            "queue_depth": queued.count,
        }
    )


@app.route("/tools", methods=["GET"])
def tools_status():
    """Check status of external tool integrations (Composio)."""
    if not verify_token():
        return jsonify({"error": "Unauthorized"}), 401

    from tools import is_tools_available, get_available_tools

    available = is_tools_available()
    return jsonify(
        {
            "composio_available": available,
            "available_tools": get_available_tools() if available else [],
            "setup_instructions": (
                None if available else
                "Set COMPOSIO_API_KEY in .env and run: pip install composio-openai && composio add github"
            ),
        }
    )


@app.route("/propose", methods=["POST"])
def propose():
    """
    Create a proposal through the Next.js API.
    Used by OpenClaw cron jobs to submit work for agents.
    """
    if not verify_token():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400

    try:
        resp = requests.post(
            f"{Config.OPS_API_URL}/api/proposals",
            json=data,
            headers={
                "Authorization": f"Bearer {Config.OPS_API_SECRET}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )

        return jsonify(resp.json()), resp.status_code

    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500


@app.route("/trigger-heartbeat", methods=["POST"])
def trigger_heartbeat():
    """Manually trigger a heartbeat cycle."""
    if not verify_token():
        return jsonify({"error": "Unauthorized"}), 401

    try:
        resp = requests.post(
            f"{Config.OPS_API_URL}/api/ops/heartbeat",
            headers={
                "Authorization": f"Bearer {Config.OPS_API_SECRET}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        return jsonify(resp.json()), resp.status_code

    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500


def start_worker_thread():
    """Start the worker loop in a background thread."""
    worker_thread = threading.Thread(target=run_worker_loop, daemon=True)
    worker_thread.start()
    return worker_thread


if __name__ == "__main__":
    # Start worker in background
    start_worker_thread()

    # Start Flask server
    app.run(
        host="0.0.0.0",
        port=Config.FLASK_PORT,
        debug=Config.FLASK_DEBUG,
    )
