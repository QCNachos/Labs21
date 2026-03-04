import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";
import { updateAgentStatus } from "@/lib/events";

/**
 * POST /api/steps/claim - VPS worker claims the next queued step
 *
 * Body: { worker_id: string }
 * Returns the step to execute, or null if no work available.
 */
export async function POST(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();
  const { worker_id } = await request.json();

  if (!worker_id) {
    return Response.json({ error: "worker_id required" }, { status: 400 });
  }

  // Claim the next queued step (ordered by priority then creation time)
  // Use a CTE to atomically select + update (prevent race conditions)
  const { data: step, error } = await sb.rpc("claim_next_step", {
    p_worker_id: worker_id,
  });

  if (error) {
    // Fallback: manual claim if RPC not available
    const { data: nextStep } = await sb
      .from("ops_mission_steps")
      .select(
        "*, mission:ops_missions!mission_id(id, title, priority, agent_slug)"
      )
      .eq("status", "queued")
      .order("step_order", { ascending: true })
      .limit(1)
      .single();

    if (!nextStep) {
      return Response.json({ step: null, message: "No work available" });
    }

    // Claim it
    const { error: claimErr } = await sb
      .from("ops_mission_steps")
      .update({
        status: "running",
        claimed_by: worker_id,
        reserved_at: new Date().toISOString(),
      })
      .eq("id", nextStep.id)
      .eq("status", "queued"); // Optimistic lock

    if (claimErr) {
      return Response.json({ step: null, message: "Claim conflict" });
    }

    // Update mission status to running if it's pending
    await sb
      .from("ops_missions")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", nextStep.mission_id)
      .eq("status", "pending");

    // Update agent status
    if (nextStep.mission) {
      await updateAgentStatus(
        sb,
        (nextStep.mission as { agent_slug: string }).agent_slug,
        "working"
      );
    }

    return Response.json({ step: nextStep });
  }

  return Response.json({ step });
}
