import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/agents - List all agents with live stats
 */
export async function GET(_request: NextRequest) {
  const sb = createServiceClient();

  // Get agents
  const { data: agents, error } = await sb
    .from("ops_agents")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Get stats for each agent (completed missions, active missions, recent events)
  const agentStats = await Promise.all(
    (agents ?? []).map(async (agent) => {
      const [
        { count: completedMissions },
        { count: activeMissions },
        { count: todayEvents },
      ] = await Promise.all([
        sb
          .from("ops_missions")
          .select("id", { count: "exact", head: true })
          .eq("agent_slug", agent.slug)
          .eq("status", "succeeded"),
        sb
          .from("ops_missions")
          .select("id", { count: "exact", head: true })
          .eq("agent_slug", agent.slug)
          .in("status", ["pending", "running"]),
        sb
          .from("ops_agent_events")
          .select("id", { count: "exact", head: true })
          .eq("agent_slug", agent.slug)
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          ),
      ]);

      return {
        ...agent,
        stats: {
          completed_missions: completedMissions ?? 0,
          active_missions: activeMissions ?? 0,
          events_24h: todayEvents ?? 0,
        },
      };
    })
  );

  return Response.json(agentStats);
}
