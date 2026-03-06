import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const agent = searchParams.get("agent");
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const sb = getSupabase();
  let query = sb.from("ops_missions")
    .select("*, steps:ops_mission_steps(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  if (agent) query = query.eq("agent_slug", agent);
  const { data } = await query;
  return Response.json(data ?? []);
}
