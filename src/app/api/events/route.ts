import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const eventType = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const sb = getSupabase();
  let query = sb.from("ops_agent_events")
    .select("*, agent:ops_agents!agent_slug(slug, name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (agent) query = query.eq("agent_slug", agent);
  if (eventType) query = query.eq("event_type", eventType);
  const { data } = await query;
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.event_type) return Response.json({ error: "event_type required" }, { status: 400 });
  const sb = getSupabase();
  await sb.from("ops_agent_events").insert({
    agent_slug: body.agent_slug, event_type: body.event_type,
    tags: body.tags ?? [], payload: body.payload ?? {},
  });
  return Response.json({ success: true }, { status: 201 });
}
