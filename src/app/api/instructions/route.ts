import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const sb = getSupabase();
  let query = sb.from("ops_instructions").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.target_agent || !body.instruction)
    return Response.json({ error: "target_agent and instruction required" }, { status: 400 });
  const sb = getSupabase();
  const { data } = await sb.from("ops_instructions").insert({
    target_agent: body.target_agent, instruction: body.instruction,
    priority: body.priority ?? "normal", project_slug: body.project_slug,
    status: "acknowledged",
  }).select("id").single();
  await sb.from("ops_agent_events").insert({
    agent_slug: body.target_agent, event_type: "instruction:received",
    tags: ["instruction", "board_director", body.priority ?? "normal"],
    payload: { instruction_id: data?.id, instruction: body.instruction.slice(0, 200) },
  });
  return Response.json({ success: true, instruction_id: data?.id }, { status: 201 });
}
