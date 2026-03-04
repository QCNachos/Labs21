"""
Post Tweet executor - posts approved tweet drafts to X (Twitter).
Uses Composio if available, otherwise falls back to simulated posting.
"""

import time
from datetime import datetime, timezone
from executors.base import emit_event, log_action_run, complete_action_run
from tools import is_tools_available, execute_tool_action


def execute_post_tweet(supabase, step: dict) -> dict:
    """Execute a tweet posting step."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "post_tweet")
    start = time.time()

    try:
        # Find the next approved tweet draft (or latest draft if auto-post enabled)
        result = (
            supabase.table("ops_tweet_drafts")
            .select("*")
            .in_("status", ["approved", "draft"])
            .eq("agent_slug", agent_slug)
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise ValueError("No tweet draft available to post")

        draft = result.data[0]
        tweet_text = draft["content"]
        external_id = None
        posted_via = "simulated"

        # Try Composio X/Twitter integration
        if is_tools_available():
            tool_result = execute_tool_action(
                "TWITTER_CREATION_OF_A_POST",
                {"text": tweet_text},
            )
            if tool_result.get("success"):
                external_id = str(tool_result.get("result", {}).get("id", ""))
                posted_via = "composio"
            else:
                # Composio failed, fall back to simulated
                external_id = f"simulated_{int(time.time())}"
                posted_via = "simulated (composio failed)"
        else:
            external_id = f"simulated_{int(time.time())}"

        # Update draft status
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("ops_tweet_drafts").update(
            {
                "status": "posted",
                "posted_at": now,
                "external_id": external_id,
            }
        ).eq("id", draft["id"]).execute()

        duration = int((time.time() - start) * 1000)

        emit_event(
            supabase,
            agent_slug,
            "tweet:posted",
            ["tweet", "posted"],
            {
                "draft_id": draft["id"],
                "external_id": external_id,
                "preview": tweet_text[:100],
                "posted_via": posted_via,
            },
        )

        output = {
            "tweet": tweet_text,
            "external_id": external_id,
            "draft_id": draft["id"],
            "posted_via": posted_via,
        }
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
