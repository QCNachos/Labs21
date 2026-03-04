import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";
import { createProposalAndMaybeAutoApprove } from "@/lib/proposal-service";
import { emitEvent } from "@/lib/events";

/**
 * GET /api/instructions - List instructions from Board Director
 * POST /api/instructions - Board Director gives a direct instruction to an agent
 */
export async function GET(request: NextRequest) {
  const sb = createServiceClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let query = sb
    .from("ops_instructions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

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

  const { target_agent, instruction, priority, project_slug, step_kinds } = body;

  if (!target_agent || !instruction) {
    return Response.json(
      { error: "target_agent and instruction required" },
      { status: 400 }
    );
  }

  // 1. Store the instruction
  const { data: inst, error: instErr } = await sb
    .from("ops_instructions")
    .insert({
      target_agent,
      instruction,
      priority: priority ?? "normal",
      project_slug: project_slug ?? null,
      status: "acknowledged",
    })
    .select("id")
    .single();

  if (instErr) {
    return Response.json({ error: instErr.message }, { status: 500 });
  }

  // 2. Emit event
  await emitEvent(sb, {
    agent_slug: target_agent,
    event_type: "instruction:received",
    tags: ["instruction", "board_director", priority ?? "normal"],
    payload: {
      instruction_id: inst.id,
      instruction: instruction.slice(0, 200),
      project_slug,
    },
  });

  // 3. If step_kinds provided, auto-create a proposal for immediate action
  if (step_kinds && step_kinds.length > 0) {
    const result = await createProposalAndMaybeAutoApprove(sb, {
      agent_slug: target_agent,
      title: `Board directive: ${instruction.slice(0, 100)}`,
      description: instruction,
      source: "api",
      priority: priority === "urgent" ? 1 : priority === "high" ? 2 : 5,
      step_kinds,
      metadata: { instruction_id: inst.id, project_slug },
    });

    return Response.json({
      success: true,
      instruction_id: inst.id,
      proposal: result,
    });
  }

  return Response.json({ success: true, instruction_id: inst.id });
}
