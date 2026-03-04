import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";
import { createMissionFromProposal } from "@/lib/mission-service";
import { emitEvent } from "@/lib/events";

/**
 * POST /api/proposals/[id]/approve - Manually approve a pending proposal
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

  // Get the proposal
  const { data: proposal, error } = await sb
    .from("ops_mission_proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !proposal) {
    return Response.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (proposal.status !== "pending") {
    return Response.json(
      { error: `Proposal is already ${proposal.status}` },
      { status: 422 }
    );
  }

  // Approve the proposal
  await sb
    .from("ops_mission_proposals")
    .update({
      status: "accepted",
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Create mission + steps
  const missionId = await createMissionFromProposal(sb, {
    id: proposal.id,
    agent_slug: proposal.agent_slug,
    title: proposal.title,
    description: proposal.description,
    priority: proposal.priority,
    step_kinds: proposal.step_kinds,
    metadata: proposal.metadata,
  });

  await emitEvent(sb, {
    agent_slug: proposal.agent_slug,
    event_type: "proposal:manually_approved",
    tags: ["proposal", "approved", "manual"],
    payload: { proposal_id: id, mission_id: missionId },
  });

  return Response.json({
    success: true,
    proposal_id: id,
    mission_id: missionId,
  });
}
