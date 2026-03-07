"""
Base utilities shared by all executors.
"""

from llm import call_llm, call_llm_tracked, resolve_model_for_agent, LLMResult


def get_agent_model(supabase, agent_slug: str, tier_override: str | None = None) -> str:
    """Look up the agent's config and resolve which model to use."""
    result = (
        supabase.table("ops_agents")
        .select("config")
        .eq("slug", agent_slug)
        .single()
        .execute()
    )
    agent_config = result.data.get("config", {}) if result.data else {}
    return resolve_model_for_agent(agent_config, tier_override)


def load_agent_skills(supabase, agent_slug: str) -> str:
    """
    Load all skills assigned to an agent and format them as context.
    Skills are injected into the system prompt to give agents specialized knowledge.
    """
    result = (
        supabase.table("ops_agent_skill_assignments")
        .select("skill_id, priority, skill:ops_agent_skills!skill_id(name, content, enabled)")
        .eq("agent_slug", agent_slug)
        .order("priority", desc=False)
        .execute()
    )

    if not result.data:
        return ""

    skill_blocks = []
    for assignment in result.data:
        skill = assignment.get("skill")
        if skill and skill.get("enabled", True):
            skill_blocks.append(f"### SKILL: {skill['name']}\n{skill['content']}")

    if not skill_blocks:
        return ""

    return "\n\n---\n\n".join(["## YOUR KNOWLEDGE & SKILLS"] + skill_blocks)


def call_agent_llm(
    supabase,
    agent_slug: str,
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
    tier_override: str | None = None,
) -> str:
    """
    Make an LLM call using the agent's configured model.
    Returns text only. Use call_agent_llm_tracked for usage data.
    """
    result = call_agent_llm_tracked(supabase, agent_slug, system_prompt, user_message, max_tokens, tier_override)
    return result.text


def call_agent_llm_tracked(
    supabase,
    agent_slug: str,
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
    tier_override: str | None = None,
) -> LLMResult:
    """
    Make an LLM call using the agent's configured model.
    Returns LLMResult with token counts and cost estimate.
    """
    model = get_agent_model(supabase, agent_slug, tier_override)

    skills_context = load_agent_skills(supabase, agent_slug)
    if skills_context:
        system_prompt = f"{system_prompt}\n\n{skills_context}"

    return call_llm_tracked(system_prompt, user_message, model=model, max_tokens=max_tokens)


def emit_event(supabase, agent_slug: str, event_type: str, tags: list, payload: dict):
    """Emit an event to the ops_agent_events table."""
    supabase.table("ops_agent_events").insert(
        {
            "agent_slug": agent_slug,
            "event_type": event_type,
            "tags": tags,
            "payload": payload,
        }
    ).execute()


def log_action_run(supabase, step_id: str, agent_slug: str, action_type: str):
    """Create an action run log entry and return its ID."""
    result = (
        supabase.table("ops_action_runs")
        .insert(
            {
                "step_id": step_id,
                "agent_slug": agent_slug,
                "action_type": action_type,
                "status": "running",
            }
        )
        .execute()
    )
    return result.data[0]["id"] if result.data else None


def complete_action_run(
    supabase, run_id: str, status: str, output: dict = None, error: str = None, duration_ms: int = None
):
    """Complete an action run."""
    from datetime import datetime, timezone

    update = {
        "status": status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    if output:
        update["output"] = output
    if error:
        update["error"] = error
    if duration_ms is not None:
        update["duration_ms"] = duration_ms

    supabase.table("ops_action_runs").update(update).eq("id", run_id).execute()
