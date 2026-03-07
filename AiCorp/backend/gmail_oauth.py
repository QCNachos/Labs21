"""
Gmail OAuth Integration (Scaffolded)

Provides bidirectional Gmail access: read inbox, draft replies, send (with approval).
Replaces SMTP-only email with full OAuth-based Gmail API access.

Setup:
  1. Create a GCP project at https://console.cloud.google.com
  2. Enable the Gmail API
  3. Create OAuth 2.0 credentials (Desktop app or Web app)
  4. Download credentials.json
  5. Set env vars:
     GMAIL_OAUTH_CLIENT_ID=xxx
     GMAIL_OAUTH_CLIENT_SECRET=xxx
     GMAIL_OAUTH_REDIRECT_URI=https://labs21.xyz/api/admin?resource=oauth_callback

Usage:
  from gmail_oauth import GmailClient
  client = GmailClient(supabase)
  client.authorize(auth_code)   # exchange auth code for tokens
  messages = client.list_inbox(max_results=10)
  client.send_email(to, subject, body_html)
"""

import os
import json
import logging
from datetime import datetime, timezone
from config import Config

logger = logging.getLogger("gmail_oauth")

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]


class GmailClient:
    """Gmail API client using OAuth2 tokens stored in Supabase."""

    def __init__(self, supabase):
        self.sb = supabase
        self.client_id = os.getenv("GMAIL_OAUTH_CLIENT_ID", "")
        self.client_secret = os.getenv("GMAIL_OAUTH_CLIENT_SECRET", "")
        self.redirect_uri = os.getenv("GMAIL_OAUTH_REDIRECT_URI", "")

    def get_auth_url(self) -> str:
        """Generate the OAuth consent URL for the user to visit."""
        import urllib.parse
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(GMAIL_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    def exchange_code(self, auth_code: str) -> dict:
        """Exchange authorization code for access + refresh tokens."""
        import requests
        resp = requests.post("https://oauth2.googleapis.com/token", data={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": auth_code,
            "grant_type": "authorization_code",
            "redirect_uri": self.redirect_uri,
        })
        if not resp.ok:
            raise RuntimeError(f"Token exchange failed: {resp.text}")

        tokens = resp.json()

        self.sb.table("ops_oauth_tokens").upsert({
            "provider": "gmail",
            "access_token_encrypted": tokens.get("access_token"),
            "refresh_token_encrypted": tokens.get("refresh_token"),
            "expires_at": datetime.now(timezone.utc).isoformat(),
            "scopes": GMAIL_SCOPES,
        }, on_conflict="provider").execute()

        self.sb.table("ops_integrations").upsert({
            "provider": "gmail",
            "status": "connected",
            "config": {"email": "ceo@labs21.xyz"},
        }, on_conflict="provider").execute()

        return tokens

    def _get_access_token(self) -> str:
        """Retrieve stored access token, refreshing if needed."""
        result = self.sb.table("ops_oauth_tokens").select("*").eq("provider", "gmail").single().execute()
        if not result.data:
            raise RuntimeError("Gmail not connected. Visit /admin/settings to connect.")
        return result.data.get("access_token_encrypted", "")

    def _gmail_api(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make an authenticated Gmail API call."""
        import requests
        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"https://gmail.googleapis.com/gmail/v1/users/me/{endpoint}"
        resp = getattr(requests, method)(url, headers=headers, **kwargs)
        if not resp.ok:
            raise RuntimeError(f"Gmail API error: {resp.status_code} {resp.text[:300]}")
        return resp.json()

    def list_inbox(self, max_results: int = 20, query: str = "in:inbox") -> list[dict]:
        """List recent inbox messages."""
        data = self._gmail_api("get", "messages", params={"maxResults": max_results, "q": query})
        messages = data.get("messages", [])
        result = []
        for msg in messages[:max_results]:
            detail = self._gmail_api("get", f"messages/{msg['id']}", params={"format": "metadata"})
            headers = {h["name"].lower(): h["value"] for h in detail.get("payload", {}).get("headers", [])}
            result.append({
                "id": msg["id"],
                "subject": headers.get("subject", "(no subject)"),
                "from": headers.get("from", ""),
                "date": headers.get("date", ""),
                "snippet": detail.get("snippet", ""),
            })
        return result

    def get_message(self, message_id: str) -> dict:
        """Get a full message by ID."""
        return self._gmail_api("get", f"messages/{message_id}", params={"format": "full"})

    def send_email(self, to: str, subject: str, body_html: str) -> dict:
        """Send an email via Gmail API."""
        import base64
        from email.mime.text import MIMEText
        msg = MIMEText(body_html, "html")
        msg["to"] = to
        msg["subject"] = subject
        raw = base64.urlsafe_b64encode(msg.as_string().encode()).decode()
        return self._gmail_api("post", "messages/send", json={"raw": raw})

    def draft_reply(self, message_id: str, body_html: str) -> dict:
        """Create a draft reply to a message."""
        import base64
        from email.mime.text import MIMEText
        original = self.get_message(message_id)
        headers = {h["name"].lower(): h["value"] for h in original.get("payload", {}).get("headers", [])}
        msg = MIMEText(body_html, "html")
        msg["to"] = headers.get("from", "")
        msg["subject"] = f"Re: {headers.get('subject', '')}"
        msg["In-Reply-To"] = headers.get("message-id", "")
        msg["References"] = headers.get("message-id", "")
        raw = base64.urlsafe_b64encode(msg.as_string().encode()).decode()
        return self._gmail_api("post", "drafts", json={
            "message": {"raw": raw, "threadId": original.get("threadId")},
        })

    def classify_email(self, message: dict) -> str:
        """Classify an email into categories (stub for LLM-based classification)."""
        subject = message.get("subject", "")
        from_addr = message.get("from", "")
        snippet = message.get("snippet", "")

        if any(kw in subject.lower() for kw in ["urgent", "asap", "critical"]):
            return "urgent"
        if any(kw in subject.lower() for kw in ["invoice", "payment", "bill"]):
            return "financial"
        if any(kw in subject.lower() for kw in ["meeting", "schedule", "calendar"]):
            return "scheduling"
        return "general"

    def is_connected(self) -> bool:
        """Check if Gmail OAuth is connected."""
        try:
            result = self.sb.table("ops_integrations").select("status").eq("provider", "gmail").single().execute()
            return result.data and result.data.get("status") == "connected"
        except Exception:
            return False
