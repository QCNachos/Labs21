import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "12");
  const sb = getSupabase();
  const { data } = await sb.from("ops_board_meetings").select("*").order("date", { ascending: false }).limit(limit);
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.title || !body.date) return Response.json({ error: "title and date required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("ops_board_meetings").insert({
    date: body.date, title: body.title, summary: body.summary ?? "",
    decisions: body.decisions ?? [], action_items: body.action_items ?? [],
    created_by: body.created_by ?? "board_director",
  }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const sb = getSupabase();
  await sb.from("ops_board_meetings").update(rest).eq("id", id);
  return Response.json({ success: true });
}
