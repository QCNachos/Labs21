"""
Analyze executor - uses Claude to analyze data, trends, or events.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_analyze(supabase, step: dict) -> dict:
    """Execute an analysis step."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "analyze")
    start = time.time()

    try:
        topic = step_input.get("topic", step_input.get("title", "general analysis"))
        context = step_input.get("context", "")

        system_prompt = f"""You are {agent_slug}, an AI analyst agent.
Your job is to analyze the given topic thoroughly and provide actionable insights.
Be concise, structured, and data-driven. Format with clear sections."""

        user_message = f"""Analyze the following:

Topic: {topic}
Context: {context}

Provide:
1. Key findings
2. Patterns or trends
3. Recommendations
4. Risk factors (if any)"""

        analysis = call_agent_llm(supabase, agent_slug, system_prompt, user_message)
        duration = int((time.time() - start) * 1000)

        # Store as memory
        supabase.table("ops_agent_memories").insert(
            {
                "agent_slug": agent_slug,
                "category": "insight",
                "content": analysis[:2000],
                "importance": 5,
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "analysis:completed",
            ["analysis", "completed"],
            {"topic": topic, "preview": analysis[:300]},
        )

        output = {"analysis": analysis, "topic": topic}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
