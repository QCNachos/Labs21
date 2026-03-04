"""
Write Content executor - generates articles, reports, or other written content.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_write_content(supabase, step: dict) -> dict:
    """Execute a content writing step."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "write_content")
    start = time.time()

    try:
        topic = step_input.get("topic", step_input.get("title", "untitled"))
        content_type = step_input.get("content_type", "article")
        tone = step_input.get("tone", "professional")

        system_prompt = f"""You are {agent_slug}, an AI content writer agent.
Write high-quality {content_type} content. Tone: {tone}.
Be engaging, informative, and well-structured."""

        user_message = f"""Write a {content_type} about: {topic}

Requirements:
- Clear structure with headings
- Actionable insights
- Engaging opening and conclusion
- Length: 500-1000 words"""

        content = call_agent_llm(supabase, agent_slug, system_prompt, user_message, max_tokens=4096)
        duration = int((time.time() - start) * 1000)

        emit_event(
            supabase,
            agent_slug,
            "content:published",
            ["content", "published", content_type],
            {"topic": topic, "type": content_type, "word_count": len(content.split())},
        )

        output = {"content": content, "topic": topic, "type": content_type}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
