import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const sb = getSupabase();
  const now = new Date();
  const results = { triggers: { evaluated: 0, fired: 0 }, reactions: { processed: 0, created: 0 }, timestamp: now.toISOString() };

  const { data: triggers } = await sb.from("ops_trigger_rules").select("*").eq("enabled", true);
  results.triggers.evaluated = triggers?.length ?? 0;

  for (const rule of triggers ?? []) {
    const condition = (rule.condition as Record<string, string>) ?? {};
    if (!condition.event_type?.startsWith("schedule:")) continue;
    if (rule.last_fired_at) {
      const last = new Date(rule.last_fired_at);
      const cooldownMs = (rule.cooldown_min ?? 60) * 60 * 1000;
      if (now.getTime() - last.getTime() < cooldownMs) continue;
    }
    const action = (rule.action as Record<string, unknown>) ?? {};
    if (action.agent_slug && action.title) {
      await sb.from("ops_mission_proposals").insert({
        agent_slug: action.agent_slug, title: action.title,
        source: "trigger", priority: action.priority ?? 5,
        step_kinds: action.step_kinds ?? [],
        metadata: { trigger_rule: rule.name }, status: "pending",
      });
      await sb.from("ops_trigger_rules").update({ last_fired_at: now.toISOString(), fire_count: (rule.fire_count ?? 0) + 1 }).eq("id", rule.id);
      results.triggers.fired++;
    }
  }

  const { data: reactions } = await sb.from("ops_agent_reactions").select("*").eq("status", "pending").limit(10);
  results.reactions.processed = reactions?.length ?? 0;
  for (const reaction of reactions ?? []) {
    await sb.from("ops_agent_reactions").update({ status: "processing" }).eq("id", reaction.id);
    await sb.from("ops_mission_proposals").insert({
      agent_slug: reaction.target_agent,
      title: `React: ${reaction.reaction_type}`,
      source: "reaction", priority: 5,
      step_kinds: [reaction.reaction_type],
      metadata: { reaction_id: reaction.id }, status: "pending",
    });
    await sb.from("ops_agent_reactions").update({ status: "completed" }).eq("id", reaction.id);
    results.reactions.created++;
  }

  return Response.json(results);
}
