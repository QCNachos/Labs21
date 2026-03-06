"""
Google Workspace CLI (gws) integration.

This module wraps the `gws` Rust CLI binary to give AI agents access to
Google Workspace APIs: Drive, Gmail, Calendar, Sheets, Docs, Chat.

SETUP REQUIRED (one-time, on the VPS):
  1. Install gws:
       npm install -g @googleworkspace/cli
  2. Set up a Google Cloud project with OAuth credentials:
       gws auth setup          # requires gcloud CLI, OR
       # manual: https://console.cloud.google.com/apis/credentials
       # → OAuth client (Desktop app) → download JSON → save to ~/.config/gws/client_secret.json
  3. Authenticate:
       gws auth login -s drive,gmail,sheets,calendar,docs
  4. Add the ceo@labs21.xyz account as a test user in the GCP OAuth consent screen.
  5. Optionally export credentials for headless use:
       gws auth export --unmasked > ~/.config/gws/credentials.json
       export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=~/.config/gws/credentials.json

NOTE: gws is NOT available on Vercel serverless. It runs on the VPS worker only.
"""

import json
import subprocess
import logging
from typing import Any

logger = logging.getLogger(__name__)

GWS_BINARY = "gws"  # assumes gws is on PATH; override with absolute path if needed


def _run(args: list[str], input_data: str | None = None) -> dict[str, Any]:
    """Run a gws command and return parsed JSON output."""
    cmd = [GWS_BINARY] + args
    try:
        result = subprocess.run(
            cmd,
            input=input_data,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            logger.error("gws error: %s", result.stderr)
            return {"error": result.stderr.strip() or "gws command failed", "exit_code": result.returncode}
        return json.loads(result.stdout) if result.stdout.strip() else {}
    except FileNotFoundError:
        return {"error": "gws binary not found. Run: npm install -g @googleworkspace/cli"}
    except subprocess.TimeoutExpired:
        return {"error": "gws command timed out"}
    except json.JSONDecodeError as e:
        return {"error": f"gws returned non-JSON output: {e}", "raw": result.stdout[:500]}


# ── Drive ──────────────────────────────────────────────────────────────────────

def drive_list_files(page_size: int = 20, query: str | None = None) -> dict:
    """List files in Google Drive. Optionally filter with a Drive query string."""
    params: dict = {"pageSize": page_size}
    if query:
        params["q"] = query
    return _run(["drive", "files", "list", "--params", json.dumps(params)])


def drive_get_file(file_id: str) -> dict:
    """Get metadata for a specific Drive file."""
    return _run(["drive", "files", "get", "--params", json.dumps({"fileId": file_id})])


def drive_upload(local_path: str, name: str, mime_type: str = "application/octet-stream",
                 parent_folder_id: str | None = None) -> dict:
    """Upload a local file to Google Drive."""
    meta: dict = {"name": name, "mimeType": mime_type}
    if parent_folder_id:
        meta["parents"] = [parent_folder_id]
    return _run(
        ["drive", "files", "create", "--json", json.dumps(meta), "--upload", local_path]
    )


# ── Gmail ──────────────────────────────────────────────────────────────────────

def gmail_list_messages(user_id: str = "me", max_results: int = 10,
                        label: str | None = None, query: str | None = None) -> dict:
    """List Gmail messages. Use label='INBOX' for inbox, or a search query."""
    params: dict = {"userId": user_id, "maxResults": max_results}
    if label:
        params["labelIds"] = [label]
    if query:
        params["q"] = query
    return _run(["gmail", "users", "messages", "list", "--params", json.dumps(params)])


def gmail_get_message(message_id: str, user_id: str = "me") -> dict:
    """Get the full content of a Gmail message."""
    return _run(["gmail", "users", "messages", "get",
                 "--params", json.dumps({"userId": user_id, "messageId": message_id, "format": "full"})])


# ── Sheets ─────────────────────────────────────────────────────────────────────

def sheets_read(spreadsheet_id: str, range_: str) -> dict:
    """Read values from a Google Sheet range (e.g. 'Sheet1!A1:C10')."""
    return _run(["sheets", "spreadsheets", "values", "get",
                 "--params", json.dumps({"spreadsheetId": spreadsheet_id, "range": range_})])


def sheets_write(spreadsheet_id: str, range_: str, values: list[list]) -> dict:
    """Write values to a Google Sheet range."""
    return _run(
        ["sheets", "spreadsheets", "values", "update",
         "--params", json.dumps({
             "spreadsheetId": spreadsheet_id,
             "range": range_,
             "valueInputOption": "USER_ENTERED",
         }),
         "--json", json.dumps({"values": values})],
    )


def sheets_append(spreadsheet_id: str, range_: str, values: list[list]) -> dict:
    """Append rows to a Google Sheet."""
    return _run(
        ["sheets", "spreadsheets", "values", "append",
         "--params", json.dumps({
             "spreadsheetId": spreadsheet_id,
             "range": range_,
             "valueInputOption": "USER_ENTERED",
         }),
         "--json", json.dumps({"values": values})],
    )


# ── Calendar ───────────────────────────────────────────────────────────────────

def calendar_list_events(calendar_id: str = "primary", max_results: int = 10,
                          time_min: str | None = None) -> dict:
    """List upcoming calendar events."""
    params: dict = {"calendarId": calendar_id, "maxResults": max_results,
                    "orderBy": "startTime", "singleEvents": True}
    if time_min:
        params["timeMin"] = time_min  # RFC3339 format e.g. "2026-03-01T00:00:00Z"
    return _run(["calendar", "events", "list", "--params", json.dumps(params)])


def calendar_create_event(calendar_id: str, summary: str, start: str, end: str,
                           description: str = "", attendees: list[str] | None = None) -> dict:
    """Create a calendar event."""
    body: dict = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start, "timeZone": "America/Toronto"},
        "end": {"dateTime": end, "timeZone": "America/Toronto"},
    }
    if attendees:
        body["attendees"] = [{"email": e} for e in attendees]
    return _run(
        ["calendar", "events", "insert",
         "--params", json.dumps({"calendarId": calendar_id}),
         "--json", json.dumps(body)],
    )


# ── Health check ───────────────────────────────────────────────────────────────

def is_available() -> bool:
    """Return True if gws binary is installed and authenticated."""
    result = _run(["--version"])
    return "error" not in result
