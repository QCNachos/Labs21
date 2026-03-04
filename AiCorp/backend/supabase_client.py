from supabase import create_client, Client
from config import Config


def get_supabase() -> Client:
    """Create a Supabase client with the service role key."""
    if not Config.SUPABASE_URL or not Config.SUPABASE_SERVICE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    return create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)
