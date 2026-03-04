"""
Composio Tool Integration Layer

Gives agents the ability to execute real actions on external services:
- GitHub: create issues, PRs, star repos, manage branches
- Gmail: send emails, read inbox, draft responses
- Slack: send messages, create channels
- Google Drive: create/read documents, sheets
- LinkedIn: post updates, send messages
- Notion: create pages, update databases
- Calendar: create events, check availability
- And 250+ more via Composio

Setup:
1. pip install composio-openai
2. Get API key from https://app.composio.dev
3. Set COMPOSIO_API_KEY in .env
4. Connect apps: composio add github / composio add gmail / etc.

This module is OPTIONAL. If Composio is not configured, agents fall back
to text-only output (current behavior).
"""

import os
import logging

logger = logging.getLogger("tools")

# Lazy imports - only load Composio if configured
_composio_available = False
_toolset = None


def _init_composio():
    """Initialize Composio toolset if API key is available."""
    global _composio_available, _toolset

    api_key = os.getenv("COMPOSIO_API_KEY")
    if not api_key:
        logger.info("COMPOSIO_API_KEY not set. Tools integration disabled (text-only mode).")
        return False

    try:
        from composio_openai import ComposioToolSet
        _toolset = ComposioToolSet(api_key=api_key)
        _composio_available = True
        logger.info("Composio tools initialized successfully.")
        return True
    except ImportError:
        logger.warning("composio-openai not installed. Run: pip install composio-openai")
        return False
    except Exception as e:
        logger.error(f"Failed to initialize Composio: {e}")
        return False


def is_tools_available() -> bool:
    """Check if external tool execution is available."""
    global _composio_available
    if _composio_available:
        return True
    return _init_composio()


def get_tools_for_action(actions: list[str]) -> list:
    """
    Get Composio tool definitions for specific actions.

    Actions use the format: APP_ACTION_NAME
    Examples:
        - GITHUB_CREATE_AN_ISSUE
        - GMAIL_SEND_EMAIL
        - SLACK_SEND_A_MESSAGE_TO_A_CHANNEL
        - GOOGLE_DOCS_CREATE_A_NEW_DOCUMENT
        - LINKEDIN_CREATE_A_POST
    """
    if not is_tools_available():
        return []

    try:
        from composio_openai import Action
        action_enums = [getattr(Action, a) for a in actions if hasattr(Action, a)]
        return _toolset.get_actions(actions=action_enums)
    except Exception as e:
        logger.error(f"Failed to get tools for actions {actions}: {e}")
        return []


def execute_tool_action(action_name: str, params: dict) -> dict:
    """
    Execute a single tool action directly.

    Returns the result dict or an error dict.
    """
    if not is_tools_available():
        return {"error": "Tools not available", "fallback": True}

    try:
        from composio import Action
        action = getattr(Action, action_name, None)
        if not action:
            return {"error": f"Unknown action: {action_name}"}

        result = _toolset.execute_action(action=action, params=params)
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Tool execution failed [{action_name}]: {e}")
        return {"error": str(e)}


# ============================================================
# Convenience functions for common agent actions
# ============================================================

def github_create_issue(repo: str, title: str, body: str) -> dict:
    """Create a GitHub issue."""
    return execute_tool_action(
        "GITHUB_CREATE_AN_ISSUE",
        {"owner": repo.split("/")[0], "repo": repo.split("/")[1], "title": title, "body": body},
    )


def gmail_send_email(to: str, subject: str, body: str) -> dict:
    """Send an email via Gmail."""
    return execute_tool_action(
        "GMAIL_SEND_EMAIL",
        {"recipient_email": to, "subject": subject, "body": body},
    )


def slack_send_message(channel: str, message: str) -> dict:
    """Send a Slack message."""
    return execute_tool_action(
        "SLACK_SEND_A_MESSAGE_TO_A_CHANNEL",
        {"channel": channel, "text": message},
    )


def linkedin_post(content: str) -> dict:
    """Create a LinkedIn post."""
    return execute_tool_action(
        "LINKEDIN_CREATE_A_LINKEDIN_POST",
        {"text": content},
    )


def google_docs_create(title: str, content: str) -> dict:
    """Create a Google Doc."""
    return execute_tool_action(
        "GOOGLE_DOCS_CREATE_A_NEW_DOCUMENT",
        {"title": title, "body": content},
    )


# ============================================================
# Tool registry: maps step_kind actions to tool functions
# ============================================================

TOOL_ACTIONS = {
    "github_create_issue": github_create_issue,
    "gmail_send": gmail_send_email,
    "slack_message": slack_send_message,
    "linkedin_post": linkedin_post,
    "google_docs_create": google_docs_create,
}


def get_available_tools() -> list[str]:
    """List all available tool actions."""
    if not is_tools_available():
        return []
    return list(TOOL_ACTIONS.keys())
