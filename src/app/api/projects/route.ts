import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector");
  const sb = getSupabase();
  let query = sb.from("ops_projects").select("*").order("priority").order("created_at", { ascending: false });
  if (sector) query = query.eq("sector", sector);
  const { data } = await query;
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.name || !body.slug) return Response.json({ error: "name and slug required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("ops_projects").insert({
    name: body.name, slug: body.slug, description: body.description,
    stage: body.stage ?? "idea", sector: body.sector ?? "others",
    sub_sector: body.sub_sector, category: body.category ?? "other",
    github_repos: body.github_repos ?? [], website_url: body.website_url,
    tech_stack: body.tech_stack ?? [], goals: body.goals ?? [],
    financials: body.financials ?? {}, team_notes: body.team_notes,
    pitch_url: body.pitch_url, links: body.links ?? {},
    is_active: body.is_active ?? true, priority: body.priority ?? 3,
    status: body.status ?? "active",
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
  await sb.from("ops_projects").update(rest).eq("id", id);
  return Response.json({ success: true });
}
