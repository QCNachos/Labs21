"""
Update Deck executor - Pitch Builder updates pitch materials.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_update_deck(supabase, step: dict) -> dict:
    """Generate/update pitch deck content and one-pagers."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "update_deck")
    start = time.time()

    try:
        # Get project context
        projects = (
            supabase.table("ops_projects")
            .select("*")
            .eq("status", "active")
            .execute()
        )

        # Get recent strategy insights
        strategy_memories = (
            supabase.table("ops_agent_memories")
            .select("content, category, created_at")
            .in_("agent_slug", ["strategist", "scout", "ceo"])
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )

        # Get recent investor research
        investor_intel = (
            supabase.table("ops_agent_memories")
            .select("content")
            .eq("agent_slug", "scout")
            .eq("category", "insight")
            .order("created_at", desc=True)
            .limit(5)
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

        projects_detail = "\n\n".join(
            [f"PROJECT: {p['name']}\nStage: {p['stage']}\nDescription: {p.get('description', 'N/A')}\n"
             f"Tech Stack: {p.get('tech_stack', [])}\nFinancials: {p.get('financials', {})}\n"
             f"Goals: {p.get('goals', [])}"
             for p in (projects.data or [])]
        )

        recent_intel = "\n".join(
            [f"- {m['content'][:300]}" for m in (strategy_memories.data or [])]
        )

        investor_context = "\n".join(
            [f"- {m['content'][:300]}" for m in (investor_intel.data or [])]
        )

        target_project = step_input.get("project", "all")

        user_message = f"""Update the pitch materials for {target_project if target_project != 'all' else 'all portfolio companies'}.

PROJECTS:
{projects_detail or 'No projects registered'}

RECENT STRATEGY INSIGHTS:
{recent_intel or 'None'}

RECENT INVESTOR INTEL:
{investor_context or 'None'}

Generate/update the following for each relevant project:

1. ELEVATOR PITCH (30 seconds)
   - One compelling sentence

2. ONE-PAGER CONTENT
   - Problem
   - Solution
   - Market size (TAM/SAM/SOM if data available)
   - Traction / Key metrics
   - Team highlights
   - The Ask

3. KEY SLIDES CONTENT (pitch deck narrative)
   - Opening hook
   - Problem slide
   - Solution slide
   - Demo / product slide description
   - Market opportunity
   - Business model
   - Traction / metrics
   - Competition / moat
   - Team
   - Financial projections summary
   - The Ask

4. OBJECTION HANDLING
   - Top 3 likely investor concerns and prepared responses

Mark any sections where data is missing or assumptions were made."""

        deck_content = call_agent_llm(supabase, agent_slug, system_prompt, user_message, max_tokens=4096)
        duration = int((time.time() - start) * 1000)

        # Store as memory
        supabase.table("ops_agent_memories").insert(
            {
                "agent_slug": agent_slug,
                "category": "strategy",
                "content": deck_content[:2000],
                "importance": 6,
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "deck:updated",
            ["deck", "updated", "pitch"],
            {
                "target_project": target_project,
                "preview": deck_content[:300],
            },
        )

        output = {"deck_content": deck_content, "target_project": target_project}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
