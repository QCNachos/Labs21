import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";
import { maybeFinalizeMission } from "@/lib/mission-service";
import { emitEvent } from "@/lib/events";

/**
 * POST /api/steps/[id]/complete - Mark a step as completed or failed
 *
 * Body: { status: "succeeded" | "failed", output?: object, error?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const sb = createServiceClient();
  const body = await request.json();

  const { status, output, error: stepError } = body;

  if (!status || !["succeeded", "failed"].includes(status)) {
    return Response.json(
      { error: "status must be 'succeeded' or 'failed'" },
      { status: 400 }
    );
  }

  // Get the step first
  const { data: step } = await sb
    .from("ops_mission_steps")
    .select("*, mission:ops_missions!mission_id(agent_slug)")
    .eq("id", id)
    .single();

  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  // Update the step
  await sb
    .from("ops_mission_steps")
    .update({
      status,
      output: output ?? null,
      last_error: stepError ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Emit event
  await emitEvent(sb, {
    agent_slug: step.agent_slug,
    event_type: `step:${status}`,
    tags: ["step", status, step.step_kind],
    payload: {
      step_id: id,
      mission_id: step.mission_id,
      step_kind: step.step_kind,
      ...(output ? { output_preview: JSON.stringify(output).slice(0, 500) } : {}),
      ...(stepError ? { error: stepError } : {}),
    },
  });

  // Check if mission should be finalized
  const missionStatus = await maybeFinalizeMission(sb, step.mission_id);

  return Response.json({
    success: true,
    step_id: id,
    step_status: status,
    mission_status: missionStatus,
  });
}
