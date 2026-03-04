import { SupabaseClient } from "@supabase/supabase-js";
import { maybeFinalizeMission } from "./mission-service";
import { emitEvent } from "./events";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Recover steps that are stuck in "running" status.
 * VPS restarts, network blips, API timeouts can leave steps stranded.
 * Mark them as failed and check if the mission should be finalized.
 */
export async function recoverStaleSteps(
  sb: SupabaseClient
): Promise<{ recovered: number }> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  const { data: staleSteps } = await sb
    .from("ops_mission_steps")
    .select("id, mission_id, agent_slug, step_kind")
    .eq("status", "running")
    .lt("reserved_at", staleThreshold);

  if (!staleSteps || staleSteps.length === 0) {
    return { recovered: 0 };
  }

  let recovered = 0;

  for (const step of staleSteps) {
    // Mark as failed
    await sb
      .from("ops_mission_steps")
      .update({
        status: "failed",
        last_error: "Stale: no progress for 30 minutes",
        completed_at: new Date().toISOString(),
      })
      .eq("id", step.id);

    await emitEvent(sb, {
      agent_slug: step.agent_slug,
      event_type: "step:stale_recovered",
      tags: ["step", "stale", "recovered"],
      payload: {
        step_id: step.id,
        mission_id: step.mission_id,
        step_kind: step.step_kind,
      },
    });

    // Check if mission should be finalized
    await maybeFinalizeMission(sb, step.mission_id);
    recovered++;
  }

  return { recovered };
}
