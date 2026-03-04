import { SupabaseClient } from "@supabase/supabase-js";
import { emitEvent, updateAgentStatus } from "./events";

/**
 * Create a mission and its steps from an approved proposal.
 */
export async function createMissionFromProposal(
  sb: SupabaseClient,
  proposal: {
    id: string;
    agent_slug: string;
    title: string;
    description?: string | null;
    priority: number;
    step_kinds: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  // 1. Create the mission
  const { data: mission, error: mErr } = await sb
    .from("ops_missions")
    .insert({
      proposal_id: proposal.id,
      agent_slug: proposal.agent_slug,
      title: proposal.title,
      description: proposal.description,
      status: "pending",
      priority: proposal.priority,
    })
    .select("id")
    .single();

  if (mErr || !mission) {
    console.error("[createMissionFromProposal] Failed to create mission:", mErr?.message);
    return null;
  }

  // 2. Create steps in order
  const steps = proposal.step_kinds.map((kind, idx) => ({
    mission_id: mission.id,
    agent_slug: proposal.agent_slug,
    step_kind: kind,
    step_order: idx,
    status: "queued" as const,
    input: proposal.metadata ?? {},
  }));

  const { error: sErr } = await sb.from("ops_mission_steps").insert(steps);

  if (sErr) {
    console.error("[createMissionFromProposal] Failed to create steps:", sErr.message);
    // Clean up the mission
    await sb.from("ops_missions").delete().eq("id", mission.id);
    return null;
  }

  // 3. Emit event
  await emitEvent(sb, {
    agent_slug: proposal.agent_slug,
    event_type: "mission:created",
    tags: ["mission", "created"],
    payload: {
      mission_id: mission.id,
      proposal_id: proposal.id,
      step_kinds: proposal.step_kinds,
    },
  });

  return mission.id;
}

/**
 * Check if all steps in a mission are done and finalize the mission status.
 * - All succeeded -> mission succeeded
 * - Any failed -> mission failed
 * - Otherwise -> still running
 */
export async function maybeFinalizeMission(
  sb: SupabaseClient,
  missionId: string
): Promise<"succeeded" | "failed" | "running"> {
  const { data: steps } = await sb
    .from("ops_mission_steps")
    .select("status")
    .eq("mission_id", missionId);

  if (!steps || steps.length === 0) return "running";

  const statuses = steps.map((s) => s.status);
  const allDone = statuses.every((s) => s === "succeeded" || s === "failed" || s === "skipped");

  if (!allDone) return "running";

  const hasFailed = statuses.some((s) => s === "failed");
  const finalStatus = hasFailed ? "failed" : "succeeded";

  // Update mission
  await sb
    .from("ops_missions")
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", missionId);

  // Get agent slug for event
  const { data: mission } = await sb
    .from("ops_missions")
    .select("agent_slug, title")
    .eq("id", missionId)
    .single();

  if (mission) {
    await emitEvent(sb, {
      agent_slug: mission.agent_slug,
      event_type: `mission:${finalStatus}`,
      tags: ["mission", finalStatus],
      payload: { mission_id: missionId, title: mission.title },
    });

    await updateAgentStatus(sb, mission.agent_slug, "idle");
  }

  return finalStatus;
}
