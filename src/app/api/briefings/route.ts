import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const briefingType = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const sb = getSupabase();
  let query = sb.from("ops_briefings")
    .select("*, agent:ops_agents!agent_slug(slug, name, title, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (unreadOnly) query = query.eq("read", false);
  if (briefingType) query = query.eq("briefing_type", briefingType);
  const { data } = await query;
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.agent_slug || !body.title || !body.content)
    return Response.json({ error: "agent_slug, title, content required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("ops_briefings").insert({
    agent_slug: body.agent_slug, briefing_type: body.briefing_type ?? "daily",
    title: body.title, content: body.content,
    priority: body.priority ?? "normal", projects: body.projects ?? [],
    metadata: body.metadata ?? {},
  }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  const sb = getSupabase();
  await sb.from("ops_briefings").update({ read: body.read ?? true }).eq("id", body.id);
  return Response.json({ success: true });
}
