import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";
import { emitEvent } from "@/lib/events";

/**
 * GET /api/hiring - List hiring proposals
 * POST /api/hiring/[id]/approve - Board Director approves and creates the agent
 * POST /api/hiring/[id]/reject - Board Director rejects the proposal
 */
export async function GET(request: NextRequest) {
  const sb = createServiceClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");

  let query = sb
    .from("ops_hiring_proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();
  const body = await request.json();
  const { proposal_id, action, board_notes } = body;

  if (!proposal_id || !action) {
    return Response.json({ error: "proposal_id and action required" }, { status: 400 });
  }

  // Get the proposal
  const { data: proposal, error: fetchErr } = await sb
    .from("ops_hiring_proposals")
    .select("*")
    .eq("id", proposal_id)
    .single();

  if (fetchErr || !proposal) {
    return Response.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (proposal.status !== "proposed") {
    return Response.json({ error: `Proposal already ${proposal.status}` }, { status: 422 });
  }

  if (action === "reject") {
    await sb
      .from("ops_hiring_proposals")
      .update({
        status: "rejected",
        board_notes: board_notes ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", proposal_id);

    await emitEvent(sb, {
      agent_slug: proposal.proposed_by,
      event_type: "hiring:rejected",
      tags: ["hiring", "rejected"],
      payload: { proposal_id, proposed_name: proposal.proposed_name },
    });

    return Response.json({ success: true, status: "rejected" });
  }

  if (action === "approve") {
    // Create the new agent
    const { error: agentErr } = await sb.from("ops_agents").insert({
      slug: proposal.proposed_slug,
      name: proposal.proposed_name,
      title: proposal.proposed_title,
      department: proposal.department,
      reports_to: proposal.reports_to,
      can_approve: false,
      role_desc: proposal.role_desc,
      system_prompt: proposal.system_prompt ?? `You are ${proposal.proposed_name}, ${proposal.proposed_title} at AiCorp. ${proposal.role_desc}`,
      config: { model_tier: proposal.model_tier },
      status: "idle",
    });

    if (agentErr) {
      return Response.json({ error: `Failed to create agent: ${agentErr.message}` }, { status: 500 });
    }

    // Update proposal status
    await sb
      .from("ops_hiring_proposals")
      .update({
        status: "hired",
        board_notes: board_notes ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", proposal_id);

    await emitEvent(sb, {
      agent_slug: proposal.proposed_by,
      event_type: "hiring:approved",
      tags: ["hiring", "approved", "new_agent"],
      payload: {
        proposal_id,
        new_agent_slug: proposal.proposed_slug,
        new_agent_name: proposal.proposed_name,
        new_agent_title: proposal.proposed_title,
      },
    });

    return Response.json({
      success: true,
      status: "hired",
      new_agent: {
        slug: proposal.proposed_slug,
        name: proposal.proposed_name,
        title: proposal.proposed_title,
      },
    });
  }

  return Response.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
}
