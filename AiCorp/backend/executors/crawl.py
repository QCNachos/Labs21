"""
Crawl executor - gathers information from the web.
"""

import time
import requests
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_crawl(supabase, step: dict) -> dict:
    """Execute a web crawl/research step."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "crawl")
    start = time.time()

    try:
        topic = step_input.get("topic", step_input.get("title", ""))
        urls = step_input.get("urls", [])

        gathered_content = []

        # If specific URLs are provided, fetch them
        for url in urls[:5]:  # Limit to 5 URLs
            try:
                resp = requests.get(url, timeout=10, headers={"User-Agent": "AiCorp-Agent/1.0"})
                if resp.ok:
                    # Take first 5000 chars of text content
                    gathered_content.append(
                        {"url": url, "content": resp.text[:5000], "status": resp.status_code}
                    )
            except requests.RequestException as e:
                gathered_content.append({"url": url, "error": str(e)})

        # Use Claude to synthesize findings
        system_prompt = f"""You are {agent_slug}, an AI research/intel agent.
Synthesize the gathered information into a clear intelligence brief.
Focus on key facts, trends, and actionable intelligence."""

        context = "\n\n".join(
            [
                f"Source: {item.get('url', 'unknown')}\n{item.get('content', item.get('error', ''))[:2000]}"
                for item in gathered_content
            ]
        ) if gathered_content else "No specific sources. Research the topic using your knowledge."

        user_message = f"""Research topic: {topic}

Gathered data:
{context}

Provide:
1. Key findings
2. Notable signals
3. Recommended actions"""

        synthesis = call_agent_llm(supabase, agent_slug, system_prompt, user_message)
        duration = int((time.time() - start) * 1000)

        # Store as memory
        supabase.table("ops_agent_memories").insert(
            {
                "agent_slug": agent_slug,
                "category": "general",
                "content": synthesis[:2000],
                "importance": 4,
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "crawl:completed",
            ["crawl", "completed"],
            {"topic": topic, "sources": len(gathered_content), "preview": synthesis[:300]},
        )

        output = {"synthesis": synthesis, "sources_count": len(gathered_content), "topic": topic}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
