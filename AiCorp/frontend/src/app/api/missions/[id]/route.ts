import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/missions/[id] - Get mission detail with steps
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("ops_missions")
    .select(
      "*, steps:ops_mission_steps(*), agent:ops_agents!agent_slug(slug, name, avatar_url, status)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Mission not found" }, { status: 404 });
  }

  return Response.json(data);
}
