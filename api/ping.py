"""Minimal health check — no external imports."""
from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/api/ping")
@app.route("/")
def ping():
    return jsonify({"ok": True, "python": "works"})
