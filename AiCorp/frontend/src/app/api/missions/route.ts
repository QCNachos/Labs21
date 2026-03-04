import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/missions - List missions with optional filters
 */
export async function GET(request: NextRequest) {
  const sb = createServiceClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const agent = searchParams.get("agent");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let query = sb
    .from("ops_missions")
    .select(
      "*, steps:ops_mission_steps(id, step_kind, step_order, status, completed_at), agent:ops_agents!agent_slug(slug, name, avatar_url)"
    )
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
