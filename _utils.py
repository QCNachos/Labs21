"""
Shared utilities for Python serverless API functions.
All Supabase access happens here — never in Next.js.
"""
import os
from functools import wraps
from flask import request, jsonify
from supabase import create_client, Client


def get_supabase() -> Client:
    """Create a Supabase service-role client."""
    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def is_authorized() -> bool:
    """Check bearer token against OPS_API_SECRET."""
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    secret = os.environ.get("OPS_API_SECRET", "").strip()
    return bool(secret) and token == secret


def require_auth(f):
    """Decorator: require valid OPS_API_SECRET bearer token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not is_authorized():
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


def cors(response):
    """Add CORS headers to response."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return response


def make_app(name: str):
    """Create a Flask app with CORS after-request hook."""
    from flask import Flask
    application = Flask(name)
    application.after_request(cors)
    return application
