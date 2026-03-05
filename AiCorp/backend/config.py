import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Supabase
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

    # API
    OPS_API_URL = os.getenv("OPS_API_URL")  # e.g. https://yourdomain.com
    OPS_API_SECRET = os.getenv("OPS_API_SECRET")

    # Worker
    WORKER_ID = os.getenv("WORKER_ID", f"vps-worker-{os.getpid()}")
    POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))

    # -- LLM Providers --
    # Anthropic (Claude)
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    # Open-source via Ollama (local) or OpenRouter/Groq (hosted)
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

    # Default models per tier (overridable per agent in ops_agents.config)
    MODEL_TIER_SMART = os.getenv("MODEL_TIER_SMART", "openai:gpt-4o")
    MODEL_TIER_FAST = os.getenv("MODEL_TIER_FAST", "openai:gpt-4o-mini")
    MODEL_TIER_FREE = os.getenv("MODEL_TIER_FREE", "ollama:llama3.1:8b")

    # GitHub
    GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

    # Gmail (SMTP with App Password)
    GMAIL_USER = os.getenv("GMAIL_USER")                   # your.address@gmail.com
    GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")   # 16-char App Password from Google

    # CEO email recipient
    CEO_EMAIL_TO = os.getenv("CEO_EMAIL_TO")

    # Flask
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
