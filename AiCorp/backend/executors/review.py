"""
Review executor - quality checks on content and outputs.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_review(supabase, step: dict) -> dict:
    """Execute a quality review step."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "review")
    start = time.time()

    try:
        # Get recent content to review
        recent_events = (
            supabase.table("ops_agent_events")
            .select("*")
            .in_("event_type", ["content:published", "tweet:posted", "analysis:completed"])
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )

        context = step_input.get("context", "")

        items_to_review = "\n\n".join(
            [
                f"[{e['event_type']}] by {e.get('agent_slug', 'unknown')}: {str(e.get('payload', {}))[:500]}"
                for e in (recent_events.data or [])
            ]
        )

        system_prompt = f"""You are {agent_slug}, an AI quality observer agent.
Your job is to review agent outputs for quality, accuracy, and alignment with standards.
Score each item and provide improvement suggestions."""

        user_message = f"""Review the following recent agent outputs:

{items_to_review or 'No recent outputs to review'}

Additional context: {context}

For each item, provide:
1. Quality score (1-10)
2. Strengths
3. Areas for improvement
4. Overall assessment"""

        review = call_agent_llm(supabase, agent_slug, system_prompt, user_message)
        duration = int((time.time() - start) * 1000)

        emit_event(
            supabase,
            agent_slug,
            "review:completed",
            ["review", "completed"],
            {"items_reviewed": len(recent_events.data or []), "preview": review[:300]},
        )

        output = {"review": review, "items_reviewed": len(recent_events.data or [])}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
