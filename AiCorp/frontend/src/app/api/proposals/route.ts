import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";
import { createProposalAndMaybeAutoApprove } from "@/lib/proposal-service";

/**
 * GET /api/proposals - List proposals (public, uses anon access via RLS)
 * POST /api/proposals - Create a new proposal (requires ops token)
 */
export async function GET(request: NextRequest) {
  const sb = createServiceClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const agent = searchParams.get("agent");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let query = sb
    .from("ops_mission_proposals")
    .select("*, agent:ops_agents!agent_slug(slug, name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (agent) query = query.eq("agent_slug", agent);

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

  try {
    const body = await request.json();

    const { agent_slug, title, description, source, priority, step_kinds, metadata } =
      body;

    if (!agent_slug || !title || !step_kinds || step_kinds.length === 0) {
      return Response.json(
        { error: "Missing required fields: agent_slug, title, step_kinds" },
        { status: 400 }
      );
    }

    const result = await createProposalAndMaybeAutoApprove(sb, {
      agent_slug,
      title,
      description,
      source: source ?? "api",
      priority: priority ?? 5,
      step_kinds,
      metadata: metadata ?? {},
    });

    return Response.json(result, { status: result.success ? 201 : 422 });
  } catch (err) {
    return Response.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 }
    );
  }
}
