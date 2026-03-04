"""
Generate Briefing executor - CEO/CFO produce reports for the Board Director.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_generate_briefing(supabase, step: dict) -> dict:
    """Generate an executive briefing for the Board Director."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "generate_briefing")
    start = time.time()

    try:
        # Gather context: recent events, missions, project status
        recent_events = (
            supabase.table("ops_agent_events")
            .select("agent_slug, event_type, payload, created_at")
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )

        active_missions = (
            supabase.table("ops_missions")
            .select("title, agent_slug, status, created_at")
            .in_("status", ["pending", "running"])
            .execute()
        )

        recent_failures = (
            supabase.table("ops_missions")
            .select("title, agent_slug, result")
            .eq("status", "failed")
            .order("completed_at", desc=True)
            .limit(5)
            .execute()
        )

        projects = (
            supabase.table("ops_projects")
            .select("name, stage, status, financials, goals")
            .eq("status", "active")
            .execute()
        )

        # Get the agent's system prompt
        agent_data = (
            supabase.table("ops_agents")
            .select("system_prompt, name, title")
            .eq("slug", agent_slug)
            .single()
            .execute()
        )

        system_prompt = agent_data.data.get("system_prompt", "") if agent_data.data else ""

        events_summary = "\n".join(
            [f"- [{e['agent_slug']}] {e['event_type']}: {str(e.get('payload', {}))[:200]}"
             for e in (recent_events.data or [])[:20]]
        )

        missions_summary = "\n".join(
            [f"- {m['title']} ({m['agent_slug']}, {m['status']})"
             for m in (active_missions.data or [])]
        )

        failures_summary = "\n".join(
            [f"- {m['title']} ({m['agent_slug']}): {str(m.get('result', ''))[:200]}"
             for m in (recent_failures.data or [])]
        )

        projects_summary = "\n".join(
            [f"- {p['name']} (stage: {p['stage']}, status: {p['status']})"
             for p in (projects.data or [])]
        )

        user_message = f"""Produce a briefing for the Board Director.

ACTIVE PROJECTS:
{projects_summary or 'No projects registered'}

RECENT ACTIVITY (last 24h):
{events_summary or 'No recent events'}

ACTIVE MISSIONS:
{missions_summary or 'No active missions'}

RECENT FAILURES:
{failures_summary or 'No recent failures'}

Additional context: {step_input.get('context', '')}

Produce a concise executive briefing with:
1. Executive Summary (2-3 sentences)
2. Key Highlights (top 3-5 items that need attention)
3. Project Status (one line per project)
4. Risks & Blockers
5. Recommendations for Board Director action (if any)

Keep it sharp, actionable, and under 500 words."""

        briefing_content = call_agent_llm(supabase, agent_slug, system_prompt, user_message, max_tokens=2048)
        duration = int((time.time() - start) * 1000)

        # Determine briefing type and priority
        briefing_type = step_input.get("briefing_type", "daily")
        priority = "normal"
        if recent_failures.data and len(recent_failures.data) > 2:
            priority = "high"

        # Store briefing
        project_slugs = [p.get("slug", p["name"]) for p in (projects.data or [])]
        supabase.table("ops_briefings").insert(
            {
                "agent_slug": agent_slug,
                "briefing_type": briefing_type,
                "title": f"{'Daily' if briefing_type == 'daily' else 'Weekly'} Briefing from {agent_data.data.get('name', agent_slug) if agent_data.data else agent_slug}",
                "content": briefing_content,
                "priority": priority,
                "projects": project_slugs[:10],
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "briefing:generated",
            ["briefing", briefing_type, "board_director"],
            {"type": briefing_type, "priority": priority, "preview": briefing_content[:300]},
        )

        output = {"briefing": briefing_content, "type": briefing_type, "priority": priority}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
