import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reportType = searchParams.get("type");
  const agent = searchParams.get("agent") ?? "ceo";
  const limit = parseInt(searchParams.get("limit") ?? "30");
  const sb = getSupabase();
  let query = sb.from("ops_daily_reports").select("*").eq("agent_slug", agent).order("date", { ascending: false }).limit(limit);
  if (reportType) query = query.eq("report_type", reportType);
  const { data } = await query;
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.agent_slug || !body.content || !body.date)
    return Response.json({ error: "agent_slug, content, date required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("ops_daily_reports").insert({
    agent_slug: body.agent_slug, date: body.date,
    report_type: body.report_type ?? "daily", content: body.content,
    questions: body.questions ?? [], status: body.status ?? "draft",
  }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  const sb = getSupabase();
  await sb.from("ops_daily_reports").update({ status: "sent", email_sent_at: new Date().toISOString() }).eq("id", body.id);
  return Response.json({ success: true });
}
