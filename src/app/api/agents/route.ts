import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

async function withStats(sb: ReturnType<typeof getSupabase>, agents: Record<string, unknown>[]) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return Promise.all(
    agents.map(async (agent) => {
      const slug = agent.slug as string;
      const [completed, active, events] = await Promise.all([
        sb.from("ops_missions").select("id", { count: "exact", head: true }).eq("agent_slug", slug).eq("status", "succeeded"),
        sb.from("ops_missions").select("id", { count: "exact", head: true }).eq("agent_slug", slug).in("status", ["pending", "running"]),
        sb.from("ops_agent_events").select("id", { count: "exact", head: true }).eq("agent_slug", slug).gte("created_at", cutoff),
      ]);
      const config = (agent.config as Record<string, unknown>) ?? {};
      return {
        ...agent,
        model_override: (config.model_override as string) ?? "",
        stats: {
          completed_missions: completed.count ?? 0,
          active_missions: active.count ?? 0,
          events_24h: events.count ?? 0,
        },
      };
    })
  );
}

export async function GET() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from("ops_agents").select("*").order("id");
    if (error) return Response.json({ error: error.message, code: error.code }, { status: 500 });
    const result = await withStats(sb, data ?? []);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.slug || !body.name) return Response.json({ error: "slug and name required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("ops_agents").insert({
    slug: body.slug, name: body.name, title: body.title,
    department: body.department, reports_to: body.reports_to,
    can_approve: body.can_approve ?? false, role_desc: body.role_desc,
    system_prompt: body.system_prompt, schedule: body.schedule ?? {},
    config: body.config ?? {}, model_provider: body.model_provider,
    model_name: body.model_name, model_subscription: body.model_subscription,
    compute_provider: body.compute_provider, compute_details: body.compute_details,
    wallet_address: body.wallet_address, wallet_chain: body.wallet_chain,
    daily_cost_usd: body.daily_cost_usd,
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
  await sb.from("ops_agents").update(rest).eq("id", id);
  return Response.json({ success: true });
}
