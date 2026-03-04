"""
Deploy executor - placeholder for deployment operations.
"""

import time
from executors.base import emit_event, log_action_run, complete_action_run


def execute_deploy(supabase, step: dict) -> dict:
    """Execute a deploy step (placeholder)."""
    agent_slug = step["agent_slug"]
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "deploy")
    start = time.time()

    try:
        # -------------------------------------------------------
        # TODO: Implement actual deployment logic
        # Options:
        # - Trigger Vercel deployment via API
        # - Run deployment scripts
        # - Update configuration
        # -------------------------------------------------------

        duration = int((time.time() - start) * 1000)

        emit_event(
            supabase,
            agent_slug,
            "deploy:completed",
            ["deploy", "completed"],
            {"message": "Deploy step executed (placeholder)"},
        )

        output = {"status": "placeholder", "message": "Deploy executor not yet implemented"}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
