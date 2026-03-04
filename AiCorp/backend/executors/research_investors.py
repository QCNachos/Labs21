"""
Research Investors executor - Scout finds matching investors.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_research_investors(supabase, step: dict) -> dict:
    """Research and identify matching investors."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "research_investors")
    start = time.time()

    try:
        # Get project details for matching
        projects = (
            supabase.table("ops_projects")
            .select("name, slug, stage, category, description, financials, tech_stack")
            .eq("status", "active")
            .execute()
        )

        # Get existing investor memories to avoid duplicates
        existing_memories = (
            supabase.table("ops_agent_memories")
            .select("content")
            .eq("agent_slug", agent_slug)
            .eq("category", "insight")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )

        agent_data = (
            supabase.table("ops_agents")
            .select("system_prompt")
            .eq("slug", agent_slug)
            .single()
            .execute()
        )

        system_prompt = agent_data.data.get("system_prompt", "") if agent_data.data else ""

        projects_info = "\n\n".join(
            [f"PROJECT: {p['name']}\nStage: {p['stage']}\nCategory: {p['category']}\n"
             f"Description: {p.get('description', 'N/A')}\nTech: {p.get('tech_stack', [])}\n"
             f"Financials: {p.get('financials', {})}"
             for p in (projects.data or [])]
        )

        previous_research = "\n".join(
            [f"- {m['content'][:200]}" for m in (existing_memories.data or [])]
        )

        user_message = f"""Research investors matching our portfolio companies.

PORTFOLIO:
{projects_info or 'No projects registered'}

PREVIOUS RESEARCH (avoid duplicates):
{previous_research or 'No previous research'}

Additional context: {step_input.get('context', '')}

For each project, identify:
1. Investor Profile Match
   - 3-5 investors who actively invest in this stage + sector
   - Include fund name, partner name if known, typical check size
   - Recent portfolio companies in similar space

2. Warm Intro Opportunities
   - Connections through existing portfolio or network
   - Recent public engagement (tweets, blog posts, podcast appearances)

3. Timing Signals
   - Funds that recently raised new capital
   - Investors who just made an investment in adjacent space
   - Upcoming demo days or events

4. Outreach Priority
   - Rank investors by fit (High/Medium/Low)
   - Suggested approach for each (cold email, warm intro, event, etc.)

Be specific with names and firms. Focus on actionable leads."""

        research = call_agent_llm(supabase, agent_slug, system_prompt, user_message, max_tokens=3000)
        duration = int((time.time() - start) * 1000)

        # Store as high-importance memory
        supabase.table("ops_agent_memories").insert(
            {
                "agent_slug": agent_slug,
                "category": "insight",
                "content": research[:2000],
                "importance": 7,
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "investor:research_completed",
            ["investor", "leads_found", "research"],
            {
                "projects_covered": len(projects.data or []),
                "preview": research[:300],
            },
        )

        output = {"research": research, "projects_covered": len(projects.data or [])}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
