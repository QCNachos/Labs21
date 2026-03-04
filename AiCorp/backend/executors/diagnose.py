"""
Diagnose executor - investigates failures and issues.
"""

import time
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run


def execute_diagnose(supabase, step: dict) -> dict:
    """Execute a diagnosis step (typically after a mission failure)."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "diagnose")
    start = time.time()

    try:
        # Get recent failed missions/steps for context
        failed_missions = (
            supabase.table("ops_missions")
            .select("id, title, status, result")
            .eq("status", "failed")
            .order("completed_at", desc=True)
            .limit(5)
            .execute()
        )

        failed_steps = (
            supabase.table("ops_mission_steps")
            .select("id, step_kind, last_error, mission_id")
            .eq("status", "failed")
            .order("completed_at", desc=True)
            .limit(10)
            .execute()
        )

        context = step_input.get("context", "")
        source_event_id = step_input.get("source_event_id", "")

        system_prompt = f"""You are {agent_slug}, an AI diagnostic agent.
Your job is to analyze failures, identify root causes, and recommend fixes.
Be systematic and thorough."""

        missions_info = "\n".join(
            [f"- {m['title']} (status: {m['status']})" for m in (failed_missions.data or [])]
        )
        steps_info = "\n".join(
            [f"- {s['step_kind']}: {s.get('last_error', 'unknown')}" for s in (failed_steps.data or [])]
        )

        user_message = f"""Diagnose the following system issues:

Context: {context}

Recent failed missions:
{missions_info or 'None'}

Recent failed steps:
{steps_info or 'None'}

Provide:
1. Root cause analysis
2. Pattern identification
3. Immediate fixes
4. Long-term recommendations"""

        diagnosis = call_agent_llm(supabase, agent_slug, system_prompt, user_message)
        duration = int((time.time() - start) * 1000)

        # Store as high-importance memory
        supabase.table("ops_agent_memories").insert(
            {
                "agent_slug": agent_slug,
                "category": "learning",
                "content": diagnosis[:2000],
                "importance": 7,
            }
        ).execute()

        emit_event(
            supabase,
            agent_slug,
            "diagnosis:completed",
            ["diagnosis", "completed"],
            {"preview": diagnosis[:300]},
        )

        output = {"diagnosis": diagnosis}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
