"""
Draft Tweet executor - generates tweet drafts for review/posting.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_draft_tweet(supabase, step: dict) -> dict:
    """Execute a tweet drafting step."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]
    mission_id = step["mission_id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "draft_tweet")
    start = time.time()

    try:
        topic = step_input.get("topic", step_input.get("title", ""))
        context = step_input.get("context", "")

        system_prompt = f"""You are {agent_slug}, an AI social media agent.
Draft a compelling tweet (max 280 characters).
Be concise, engaging, and authentic. No hashtag spam.
Return ONLY the tweet text, nothing else."""

        user_message = f"""Draft a tweet about: {topic}
Context: {context}

Rules:
- Max 280 characters
- Engaging and authentic voice
- No excessive hashtags (max 2)
- Return only the tweet text"""

        tweet_text = call_agent_llm(supabase, agent_slug, system_prompt, user_message, max_tokens=256)
        tweet_text = tweet_text.strip().strip('"').strip("'")

        # Enforce character limit
        if len(tweet_text) > 280:
            tweet_text = tweet_text[:277] + "..."

        duration = int((time.time() - start) * 1000)

        # Store as draft in ops_tweet_drafts
        supabase.table("ops_tweet_drafts").insert(
            {
                "agent_slug": agent_slug,
                "mission_id": mission_id,
                "content": tweet_text,
                "status": "draft",
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "tweet:drafted",
            ["tweet", "drafted"],
            {"preview": tweet_text[:100], "char_count": len(tweet_text)},
        )

        output = {"tweet": tweet_text, "char_count": len(tweet_text)}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
