"""
Send Daily Report executor — for on-demand CEO reports triggered via the admin portal.
Generates and emails the CEO's daily/weekly/monthly report immediately.
"""

import time
from executors.base import emit_event, log_action_run, complete_action_run


def execute_send_daily_report(supabase, step: dict) -> dict:
    """Generate and send a CEO report on demand."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]
    report_type = step_input.get("report_type", "daily")

    run_id = log_action_run(supabase, step_id, agent_slug, "send_daily_report")
    start = time.time()

    try:
        # Import and run the standalone ceo_daily logic
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

        from ceo_daily import run as run_report
        run_report(report_type)

        duration = int((time.time() - start) * 1000)
        output = {"report_type": report_type, "sent": True}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
