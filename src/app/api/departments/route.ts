import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET() {
  const sb = getSupabase();
  const { data } = await sb.from("ops_departments").select("*").order("order_index");
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.name) return Response.json({ error: "name required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("ops_departments").insert({
    name: body.name, description: body.description,
    drive_folder_url: body.drive_folder_url, icon: body.icon,
    order_index: body.order_index ?? 99,
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
  await sb.from("ops_departments").update(rest).eq("id", id);
  return Response.json({ success: true });
}
