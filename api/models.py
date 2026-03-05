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
    # ── Premium (smart) ──────────────────────────────────────────
    {
        "id": "anthropic:claude-3-5-sonnet-20241022",
        "label": "Claude 3.5 Sonnet",
        "provider": "Anthropic",
        "tier": "smart",
        "ctx": 200_000,
        "cost": "$3 / $15 per 1M",
        "env": "ANTHROPIC_API_KEY",
        "description": "Best reasoning & writing. Flagship.",
    },
    {
        "id": "anthropic:claude-3-haiku-20240307",
        "label": "Claude 3 Haiku",
        "provider": "Anthropic",
        "tier": "fast",
        "ctx": 200_000,
        "cost": "$0.25 / $1.25 per 1M",
        "env": "ANTHROPIC_API_KEY",
        "description": "Fast & cheap Claude for lighter tasks.",
    },
    {
        "id": "openai:gpt-4o",
        "label": "GPT-4o",
        "provider": "OpenAI",
        "tier": "smart",
        "ctx": 128_000,
        "cost": "$2.50 / $10 per 1M",
        "env": "OPENAI_API_KEY",
        "description": "OpenAI flagship — vision + reasoning.",
    },
    {
        "id": "openai:gpt-4o-mini",
        "label": "GPT-4o Mini",
        "provider": "OpenAI",
        "tier": "fast",
        "ctx": 128_000,
        "cost": "$0.15 / $0.60 per 1M",
        "env": "OPENAI_API_KEY",
        "description": "Cost-efficient GPT-4 class model.",
    },
    # ── Qwen 3.5 (OpenRouter) ────────────────────────────────────
    {
        "id": "openrouter:qwen/qwen3.5-397b-a17b-20260216",
        "label": "Qwen 3.5 397B A17B",
        "provider": "OpenRouter / Qwen",
        "tier": "smart",
        "ctx": 262_144,
        "cost": "$0.15 / $1 per 1M",
        "env": "OPENROUTER_API_KEY",
        "description": "New flagship (Feb 2026). MoE 397B, multimodal.",
    },
    {
        "id": "openrouter:qwen/qwen3.5-plus-02-15",
        "label": "Qwen 3.5 Plus (1M ctx)",
        "provider": "OpenRouter / Qwen",
        "tier": "smart",
        "ctx": 1_000_000,
        "cost": "$0.26 / $1.56 per 1M",
        "env": "OPENROUTER_API_KEY",
        "description": "1M context window. Vision + text.",
    },
    # ── MiniMax ──────────────────────────────────────────────────
    {
        "id": "openrouter:minimax/minimax-m1",
        "label": "MiniMax M1 (1M ctx)",
        "provider": "OpenRouter / MiniMax",
        "tier": "fast",
        "ctx": 1_000_000,
        "cost": "Free input / $0.002 per 1M out",
        "env": "OPENROUTER_API_KEY",
        "description": "1M context, nearly free. Great for long docs.",
    },
    # ── Groq (free) ──────────────────────────────────────────────
    {
        "id": "groq:qwen-2.5-72b-instruct",
        "label": "Qwen 2.5 72B",
        "provider": "Groq",
        "tier": "fast",
        "ctx": 128_000,
        "cost": "Free",
        "env": "GROQ_API_KEY",
        "description": "Free on Groq. Excellent quality & speed.",
    },
    {
        "id": "groq:llama-3.3-70b-versatile",
        "label": "Llama 3.3 70B",
        "provider": "Groq",
        "tier": "free",
        "ctx": 128_000,
        "cost": "Free",
        "env": "GROQ_API_KEY",
        "description": "Free on Groq. Fast, reliable workhorse.",
    },
    # ── OpenRouter free ──────────────────────────────────────────
    {
        "id": "openrouter:qwen/qwen3-30b-a3b:free",
        "label": "Qwen 3 30B A3B",
        "provider": "OpenRouter / Qwen",
        "tier": "free",
        "ctx": 40_960,
        "cost": "Free",
        "env": "OPENROUTER_API_KEY",
        "description": "Free MoE. Good for most background tasks.",
    },
    {
        "id": "openrouter:deepseek/deepseek-r1",
        "label": "DeepSeek R1",
        "provider": "OpenRouter / DeepSeek",
        "tier": "smart",
        "ctx": 164_000,
        "cost": "$0.55 / $2.19 per 1M",
        "env": "OPENROUTER_API_KEY",
        "description": "Strong reasoning model, MIT license.",
    },
    # ── Local ────────────────────────────────────────────────────
    {
        "id": "ollama:qwen2.5:14b",
        "label": "Qwen 2.5 14B (local)",
        "provider": "Ollama",
        "tier": "free",
        "ctx": 32_000,
        "cost": "Free (local GPU)",
        "env": "OLLAMA_BASE_URL",
        "description": "Run locally via Ollama. No API cost.",
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
