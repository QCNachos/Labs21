"""
Multi-model LLM Router

Supports:
- OpenAI (gpt-4o, gpt-4o-mini, etc.)
- Anthropic (claude-sonnet, claude-haiku, etc.)
- Ollama (local open-source models: llama3.1, mistral, deepseek, etc.)
- Groq (hosted open-source: llama, mixtral at high speed)
- OpenRouter (access to hundreds of models)

Model string format: "provider:model_name"
  Examples:
    "openai:gpt-4o"
    "anthropic:claude-sonnet-4-20250514"
    "ollama:llama3.1:8b"
    "groq:llama-3.3-70b-versatile"
    "openrouter:meta-llama/llama-3.1-8b-instruct:free"

Each agent has a model tier in their config:
  { "model_tier": "smart" | "fast" | "free", "model_override": "provider:model" }
"""

import logging
from config import Config

logger = logging.getLogger("llm")


class LLMResult:
    """Structured result from an LLM call with usage tracking."""

    def __init__(self, text: str, model: str, tokens_in: int = 0, tokens_out: int = 0, cost: float = 0.0):
        self.text = text
        self.model = model
        self.tokens_in = tokens_in
        self.tokens_out = tokens_out
        self.cost = cost

    def __str__(self):
        return self.text


COST_PER_1M: dict[str, tuple[float, float]] = {
    "gpt-5": (1.25, 10.0),
    "gpt-4o": (2.50, 10.0),
    "gpt-4o-mini": (0.15, 0.60),
    "claude-opus-4-6": (5.0, 25.0),
    "claude-sonnet-4": (3.0, 15.0),
    "claude-haiku-3.5": (0.25, 1.25),
}


def _estimate_cost(model_name: str, tokens_in: int, tokens_out: int) -> float:
    for key, (cin, cout) in COST_PER_1M.items():
        if key in model_name:
            return (tokens_in * cin + tokens_out * cout) / 1_000_000
    return 0.0


def call_llm(
    system_prompt: str,
    user_message: str,
    model: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> str:
    """
    Route an LLM call to the appropriate provider. Returns text only.
    For tracked usage, use call_llm_tracked() instead.
    """
    result = call_llm_tracked(system_prompt, user_message, model, max_tokens, temperature)
    return result.text


def call_llm_tracked(
    system_prompt: str,
    user_message: str,
    model: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> LLMResult:
    """
    Route an LLM call and return structured result with token usage.
    """
    if not model:
        model = Config.MODEL_TIER_SMART

    provider, model_name = _parse_model_string(model)

    logger.info(f"LLM call -> {provider}:{model_name} (max_tokens={max_tokens})")

    if provider == "openai":
        return _call_openai(system_prompt, user_message, model_name, max_tokens, temperature)
    elif provider == "anthropic":
        return _call_anthropic(system_prompt, user_message, model_name, max_tokens, temperature)
    elif provider == "ollama":
        return _call_ollama(system_prompt, user_message, model_name, max_tokens, temperature)
    elif provider == "groq":
        return _call_groq(system_prompt, user_message, model_name, max_tokens, temperature)
    elif provider == "openrouter":
        return _call_openrouter(system_prompt, user_message, model_name, max_tokens, temperature)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}. Use openai, anthropic, ollama, groq, or openrouter.")


def resolve_model_for_agent(agent_config: dict, tier_override: str | None = None) -> str:
    """
    Resolve which model an agent should use.

    Priority:
    1. agent_config["model_override"] (explicit model string)
    2. tier_override parameter
    3. agent_config["model_tier"] mapped to Config tier defaults
    4. Config.MODEL_TIER_SMART as fallback
    """
    # 1. Explicit override
    if agent_config.get("model_override"):
        return agent_config["model_override"]

    # 2. Tier override from caller
    tier = tier_override or agent_config.get("model_tier", "smart")

    # 3. Map tier to model
    tier_map = {
        "smart": Config.MODEL_TIER_SMART,
        "fast": Config.MODEL_TIER_FAST,
        "free": Config.MODEL_TIER_FREE,
    }

    return tier_map.get(tier, Config.MODEL_TIER_SMART)


# -- Provider implementations --

def _parse_model_string(model: str) -> tuple[str, str]:
    """Parse 'provider:model_name' into (provider, model_name)."""
    if ":" not in model:
        # Assume OpenAI if no provider prefix
        return ("openai", model)

    parts = model.split(":", 1)
    return (parts[0].lower(), parts[1])


def _call_openai(
    system_prompt: str, user_message: str, model: str, max_tokens: int, temperature: float
) -> LLMResult:
    from openai import OpenAI

    client = OpenAI(api_key=Config.OPENAI_API_KEY)

    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    text = response.choices[0].message.content or ""
    tokens_in = response.usage.prompt_tokens if response.usage else 0
    tokens_out = response.usage.completion_tokens if response.usage else 0
    return LLMResult(text, f"openai:{model}", tokens_in, tokens_out, _estimate_cost(model, tokens_in, tokens_out))


def _call_anthropic(
    system_prompt: str, user_message: str, model: str, max_tokens: int, temperature: float
) -> LLMResult:
    import anthropic

    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text
    tokens_in = response.usage.input_tokens if response.usage else 0
    tokens_out = response.usage.output_tokens if response.usage else 0
    return LLMResult(text, f"anthropic:{model}", tokens_in, tokens_out, _estimate_cost(model, tokens_in, tokens_out))


def _call_ollama(
    system_prompt: str, user_message: str, model: str, max_tokens: int, temperature: float
) -> LLMResult:
    import requests

    response = requests.post(
        f"{Config.OLLAMA_BASE_URL}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
            "stream": False,
        },
        timeout=120,
    )

    if not response.ok:
        raise RuntimeError(f"Ollama error ({response.status_code}): {response.text[:500]}")

    data = response.json()
    text = data.get("message", {}).get("content", "")
    tokens_in = data.get("prompt_eval_count", 0)
    tokens_out = data.get("eval_count", 0)
    return LLMResult(text, f"ollama:{model}", tokens_in, tokens_out, 0.0)


def _call_groq(
    system_prompt: str, user_message: str, model: str, max_tokens: int, temperature: float
) -> LLMResult:
    from openai import OpenAI

    client = OpenAI(
        api_key=Config.GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )

    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    text = response.choices[0].message.content or ""
    tokens_in = response.usage.prompt_tokens if response.usage else 0
    tokens_out = response.usage.completion_tokens if response.usage else 0
    return LLMResult(text, f"groq:{model}", tokens_in, tokens_out, 0.0)


def _call_openrouter(
    system_prompt: str, user_message: str, model: str, max_tokens: int, temperature: float
) -> LLMResult:
    from openai import OpenAI

    client = OpenAI(
        api_key=Config.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
    )

    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    text = response.choices[0].message.content or ""
    tokens_in = response.usage.prompt_tokens if response.usage else 0
    tokens_out = response.usage.completion_tokens if response.usage else 0
    return LLMResult(text, f"openrouter:{model}", tokens_in, tokens_out, _estimate_cost(model, tokens_in, tokens_out))
