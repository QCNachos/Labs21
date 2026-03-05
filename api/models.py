"""
GET /api/models   Return full model catalog with availability status.
Checks which API keys are configured server-side and marks models accordingly.
"""
import os
from flask import jsonify, request
from _utils import make_app

app = make_app(__name__)

# ------------------------------------------------------------------
# Model catalog
# tier:    smart | fast | free
# cost:    human-readable string
# ctx:     context window in tokens
# env:     env var name required
# ------------------------------------------------------------------
MODELS = [
    {
        "id": "anthropic:claude-opus-4-6",
        "label": "Claude Opus 4.6",
        "provider": "Anthropic",
        "tier": "smart",
        "ctx": 200_000,
        "cost": "$5 / $25 per 1M",
        "env": "ANTHROPIC_API_KEY",
        "description": "Anthropic flagship. Best reasoning & writing.",
    },
    {
        "id": "openai:gpt-5",
        "label": "GPT-5",
        "provider": "OpenAI",
        "tier": "smart",
        "ctx": 400_000,
        "cost": "$1.25 / $10 per 1M",
        "env": "OPENAI_API_KEY",
        "description": "OpenAI flagship. Text, images, structured output.",
    },
    {
        "id": "openrouter:qwen/qwen3.5-397b-a17b-20260216",
        "label": "Qwen 3.5 (397B)",
        "provider": "OpenRouter",
        "tier": "fast",
        "ctx": 262_144,
        "cost": "$0.15 / $1 per 1M",
        "env": "OPENROUTER_API_KEY",
        "description": "Feb 2026 flagship. MoE 397B, multimodal, 262k ctx.",
    },
    {
        "id": "openrouter:minimax/minimax-m1",
        "label": "MiniMax M1 (1M ctx)",
        "provider": "OpenRouter",
        "tier": "fast",
        "ctx": 1_000_000,
        "cost": "Free input / $0.002 per 1M out",
        "env": "OPENROUTER_API_KEY",
        "description": "1M context window. Essentially free.",
    },
    {
        "id": "openrouter:qwen/qwen3-32b",
        "label": "Qwen 3 (32B)",
        "provider": "OpenRouter",
        "tier": "free",
        "ctx": 131_000,
        "cost": "$0.08 / $0.24 per 1M",
        "env": "OPENROUTER_API_KEY",
        "description": "Best value. Strong performance at near-zero cost.",
    },
]

ENV_LABELS = {
    "ANTHROPIC_API_KEY": "Anthropic",
    "OPENAI_API_KEY": "OpenAI",
    "GROQ_API_KEY": "Groq",
    "OPENROUTER_API_KEY": "OpenRouter",
    "OLLAMA_BASE_URL": "Ollama (local)",
}


@app.route("/api/models", methods=["GET", "OPTIONS"])
@app.route("/", methods=["GET", "OPTIONS"])
def models():
    if request.method == "OPTIONS":
        return "", 204

    result = []
    for m in MODELS:
        env_key = m["env"]
        env_val = os.environ.get(env_key, "")
        # OLLAMA_BASE_URL has a default so check it differently
        if env_key == "OLLAMA_BASE_URL":
            available = True  # always available (defaults to localhost)
        else:
            available = bool(env_val and env_val.strip())

        result.append({
            **m,
            "ctx_label": _format_ctx(m["ctx"]),
            "available": available,
            "unavailable_reason": None if available else f"Add {env_key} to environment",
            "env_label": ENV_LABELS.get(env_key, env_key),
        })

    return jsonify(result)


def _format_ctx(tokens: int) -> str:
    if tokens >= 1_000_000:
        return f"{tokens // 1_000_000}M"
    if tokens >= 1_000:
        return f"{tokens // 1_000}k"
    return str(tokens)
