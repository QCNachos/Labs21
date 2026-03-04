import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/events - List recent events
 */
export async function GET(request: NextRequest) {
  const sb = createServiceClient();
  const { searchParams } = new URL(request.url);

  const agent = searchParams.get("agent");
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "100");

  let query = sb
    .from("ops_agent_events")
    .select("*, agent:ops_agents!agent_slug(slug, name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (agent) query = query.eq("agent_slug", agent);
  if (type) query = query.eq("event_type", type);

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
