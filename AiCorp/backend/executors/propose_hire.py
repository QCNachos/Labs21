"""
Propose Hire executor - CEO evaluates team needs and proposes new agents.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_propose_hire(supabase, step: dict) -> dict:
    """CEO analyzes team gaps and proposes a new hire to the Board Director."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "propose_hire")
    start = time.time()

    try:
        # Get current team
        current_agents = (
            supabase.table("ops_agents")
            .select("slug, name, title, department, role_desc")
            .execute()
        )

        # Get recent mission failures and gaps
        failures = (
            supabase.table("ops_missions")
            .select("title, agent_slug, result")
            .eq("status", "failed")
            .order("completed_at", desc=True)
            .limit(10)
            .execute()
        )

        # Get projects
        projects = (
            supabase.table("ops_projects")
            .select("name, stage, category, tech_stack")
            .eq("status", "active")
            .execute()
        )

        # Get agent's system prompt
        agent_data = (
            supabase.table("ops_agents")
            .select("system_prompt")
            .eq("slug", agent_slug)
            .single()
            .execute()
        )

        system_prompt = agent_data.data.get("system_prompt", "") if agent_data.data else ""

        team_info = "\n".join(
            [f"- {a['name']} ({a['title']}): {a['role_desc'][:100]}" for a in (current_agents.data or [])]
        )

        failures_info = "\n".join(
            [f"- {f['title']} ({f['agent_slug']})" for f in (failures.data or [])]
        )

        projects_info = "\n".join(
            [f"- {p['name']} (stage: {p['stage']}, tech: {p.get('tech_stack', [])})" for p in (projects.data or [])]
        )

        context = step_input.get("context", "")

        user_message = f"""As CEO, evaluate the current team structure and determine if we need to hire a new agent.

CURRENT TEAM:
{team_info}

ACTIVE PROJECTS:
{projects_info or 'No projects registered'}

RECENT FAILURES:
{failures_info or 'None'}

ADDITIONAL CONTEXT: {context}

Evaluate:
1. Are there capability gaps in the current team?
2. Are any agents overloaded with work outside their specialty?
3. Do any projects need dedicated attention that no agent covers?

If you recommend a hire, provide:
- Proposed role name and title
- Department (engineering, growth, content, finance, operations)
- Who they'd report to
- Why this role is needed (specific justification)
- What their core responsibilities would be
- Suggested model tier (smart/fast/free based on task complexity)
- Estimated value they'd add

If the current team is sufficient, explain why no hire is needed.

Format your response as JSON if recommending a hire:
{{"recommend_hire": true/false, "proposal": {{"name": "...", "title": "...", "department": "...", "reports_to": "...", "justification": "...", "role_desc": "...", "model_tier": "...", "slug": "..."}}}}"""

        response = call_agent_llm(supabase, agent_slug, system_prompt, user_message)
        duration = int((time.time() - start) * 1000)

        # Try to parse the response as a hiring proposal
        import json
        try:
            # Extract JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                parsed = json.loads(response[json_start:json_end])

                if parsed.get("recommend_hire") and parsed.get("proposal"):
                    proposal = parsed["proposal"]

                    # Insert hiring proposal
                    supabase.table("ops_hiring_proposals").insert({
                        "proposed_by": agent_slug,
                        "proposed_slug": proposal.get("slug", proposal["name"].lower().replace(" ", "-")),
                        "proposed_name": proposal["name"],
                        "proposed_title": proposal["title"],
                        "department": proposal.get("department", "operations"),
                        "reports_to": proposal.get("reports_to", "ceo"),
                        "justification": proposal.get("justification", ""),
                        "role_desc": proposal.get("role_desc", ""),
                        "model_tier": proposal.get("model_tier", "fast"),
                        "status": "proposed",
                    }).execute()

                    emit_event(
                        supabase,
                        agent_slug,
                        "hiring:proposed",
                        ["hiring", "proposed", "board_review"],
                        {
                            "proposed_name": proposal["name"],
                            "proposed_title": proposal["title"],
                            "department": proposal.get("department"),
                            "justification": proposal.get("justification", "")[:300],
                        },
                    )
        except (json.JSONDecodeError, KeyError):
            pass  # Response wasn't structured as a hiring proposal

        emit_event(
            supabase,
            agent_slug,
            "org:review_completed",
            ["org", "review", "completed"],
            {"preview": response[:300]},
        )

        output = {"analysis": response}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
