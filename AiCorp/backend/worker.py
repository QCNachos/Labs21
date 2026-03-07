"""
VPS Mission Worker

The sole executor of mission steps.
Polls the Next.js API to claim queued steps, executes them, and reports results.

Architecture:
- VPS is the sole executor (Vercel only runs the control plane)
- Worker claims one step at a time (no parallel execution by default)
- After completing a step, reports back via the API
- The API handles mission finalization
"""

import time
import logging
import requests
from config import Config
from supabase_client import get_supabase
from executors import get_executor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")


def api_headers():
    return {
        "Authorization": f"Bearer {Config.OPS_API_SECRET}",
        "Content-Type": "application/json",
    }


def claim_step() -> dict | None:
    """Claim the next queued step from the API."""
    try:
        resp = requests.post(
            f"{Config.OPS_API_URL}/api/steps/claim",
            json={"worker_id": Config.WORKER_ID},
            headers=api_headers(),
            timeout=15,
        )

        if resp.status_code != 200:
            logger.warning(f"Claim failed with status {resp.status_code}: {resp.text[:200]}")
            return None

        data = resp.json()
        return data.get("step")

    except requests.RequestException as e:
        logger.error(f"Claim request failed: {e}")
        return None


def report_completion(
    step_id: str,
    status: str,
    output: dict = None,
    error: str = None,
    model_used: str = None,
    token_count_in: int = 0,
    token_count_out: int = 0,
    cost_estimate: float = 0.0,
):
    """Report step completion back to the API with usage tracking."""
    try:
        payload = {"step_id": step_id, "status": status}
        if output:
            payload["output"] = output
        if error:
            payload["error"] = error
        if model_used:
            payload["model_used"] = model_used
        if token_count_in or token_count_out:
            payload["token_count_in"] = token_count_in
            payload["token_count_out"] = token_count_out
        if cost_estimate:
            payload["cost_estimate"] = cost_estimate

        resp = requests.post(
            f"{Config.OPS_API_URL}/api/steps/complete",
            json=payload,
            headers=api_headers(),
            timeout=15,
        )

        if resp.status_code != 200:
            logger.warning(f"Report failed with status {resp.status_code}: {resp.text[:200]}")

    except requests.RequestException as e:
        logger.error(f"Report request failed: {e}")


def execute_step(step: dict):
    """Execute a single step using the appropriate executor."""
    step_kind = step["step_kind"]
    step_id = step["id"]
    agent_slug = step["agent_slug"]

    logger.info(f"Executing step {step_id} ({step_kind}) for {agent_slug}")

    executor = get_executor(step_kind)
    if not executor:
        error_msg = f"No executor found for step kind: {step_kind}"
        logger.error(error_msg)
        report_completion(step_id, "failed", error=error_msg)
        return

    sb = get_supabase()

    # Update agent status
    sb.table("ops_agents").update(
        {"status": "working", "last_active": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    ).eq("slug", agent_slug).execute()

    try:
        output = executor(sb, step)
        logger.info(f"Step {step_id} ({step_kind}) succeeded")

        model_used = None
        tokens_in = 0
        tokens_out = 0
        cost = 0.0
        if isinstance(output, dict):
            model_used = output.pop("_model_used", None)
            tokens_in = output.pop("_tokens_in", 0)
            tokens_out = output.pop("_tokens_out", 0)
            cost = output.pop("_cost_estimate", 0.0)

        report_completion(
            step_id, "succeeded", output=output,
            model_used=model_used, token_count_in=tokens_in,
            token_count_out=tokens_out, cost_estimate=cost,
        )

    except Exception as e:
        logger.error(f"Step {step_id} ({step_kind}) failed: {e}")
        report_completion(step_id, "failed", error=str(e))

    finally:
        # Set agent back to idle
        sb.table("ops_agents").update(
            {"status": "idle", "last_active": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        ).eq("slug", agent_slug).execute()


def run_worker_loop():
    """Main worker loop. Polls for work, executes, repeats."""
    logger.info(f"Worker {Config.WORKER_ID} starting (poll interval: {Config.POLL_INTERVAL_SECONDS}s)")

    while True:
        try:
            step = claim_step()

            if step:
                execute_step(step)
                # Immediately check for more work after completing a step
                continue
            else:
                logger.debug("No work available, sleeping...")

        except Exception as e:
            logger.error(f"Worker loop error: {e}")

        time.sleep(Config.POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_worker_loop()
