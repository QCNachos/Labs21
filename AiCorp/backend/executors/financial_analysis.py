"""
Financial Analysis executor - CFO runs financial health checks.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_financial_analysis(supabase, step: dict) -> dict:
    """Execute a financial analysis step (CFO)."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "financial_analysis")
    start = time.time()

    try:
        # Gather project financials
        projects = (
            supabase.table("ops_projects")
            .select("name, slug, stage, financials, goals")
            .eq("status", "active")
            .execute()
        )

        # Get CFO system prompt
        agent_data = (
            supabase.table("ops_agents")
            .select("system_prompt")
            .eq("slug", agent_slug)
            .single()
            .execute()
        )

        system_prompt = agent_data.data.get("system_prompt", "") if agent_data.data else ""

        projects_financial = "\n\n".join(
            [f"PROJECT: {p['name']} (stage: {p['stage']})\nFinancials: {p.get('financials', {})}\nGoals: {p.get('goals', [])}"
             for p in (projects.data or [])]
        )

        context = step_input.get("context", "")

        user_message = f"""Run a financial health check across all portfolio companies.

PORTFOLIO:
{projects_financial or 'No projects with financial data'}

Additional context: {context}

Provide:
1. Portfolio Financial Summary
   - Total burn rate, total runway, total MRR across all projects
2. Per-Project Analysis
   - Runway status (green/yellow/red)
   - Burn efficiency
   - Revenue trajectory
3. Cash Flow Concerns
   - Any project below 3 months runway
   - Unusual spending patterns
4. Fundraising Readiness
   - Which projects need funding soon
   - Recommended fundraising timeline
5. CFO Recommendations
   - Cost optimization opportunities
   - Resource reallocation suggestions

Be precise with numbers. Flag anything the Board Director needs to act on."""

        analysis = call_agent_llm(supabase, agent_slug, system_prompt, user_message, max_tokens=2048)
        duration = int((time.time() - start) * 1000)

        # Check for runway alerts
        for project in (projects.data or []):
            financials = project.get("financials", {})
            runway = financials.get("runway_months")
            if runway is not None and float(runway) < 3:
                emit_event(
                    supabase,
                    agent_slug,
                    "financial:runway_alert",
                    ["financial", "runway", "alert"],
                    {
                        "project": project["name"],
                        "runway_months": runway,
                        "severity": "critical" if float(runway) < 1 else "warning",
                    },
                )

        # Store as memory
        supabase.table("ops_agent_memories").insert(
            {
                "agent_slug": agent_slug,
                "category": "insight",
                "content": analysis[:2000],
                "importance": 6,
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "financial:analysis_completed",
            ["financial", "analysis", "completed"],
            {"projects_analyzed": len(projects.data or []), "preview": analysis[:300]},
        )

        output = {"analysis": analysis, "projects_analyzed": len(projects.data or [])}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
