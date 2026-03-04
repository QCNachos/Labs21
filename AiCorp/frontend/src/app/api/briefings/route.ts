import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";

/**
 * GET /api/briefings - List briefings (CEO/CFO reports to Board Director)
 * POST /api/briefings/[id]/read - Mark as read
 */
export async function GET(request: NextRequest) {
  const sb = createServiceClient();
  const { searchParams } = new URL(request.url);

  const unreadOnly = searchParams.get("unread") === "true";
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let query = sb
    .from("ops_briefings")
    .select("*, agent:ops_agents!agent_slug(slug, name, title, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq("read", false);
  if (type) query = query.eq("briefing_type", type);

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function PATCH(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();
  const { id, read } = await request.json();

  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  await sb.from("ops_briefings").update({ read: read ?? true }).eq("id", id);

  return Response.json({ success: true });
}
