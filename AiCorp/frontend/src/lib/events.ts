import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Emit an event to the ops_agent_events stream.
 * Central event bus for the entire system.
 */
export async function emitEvent(
  sb: SupabaseClient,
  params: {
    agent_slug?: string;
    event_type: string;
    tags?: string[];
    payload?: Record<string, unknown>;
  }
): Promise<string | null> {
  const { data, error } = await sb
    .from("ops_agent_events")
    .insert({
      agent_slug: params.agent_slug ?? null,
      event_type: params.event_type,
      tags: params.tags ?? [],
      payload: params.payload ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[emitEvent] Failed:", error.message);
    return null;
  }

  return data.id;
}

/**
 * Update agent status and last_active timestamp.
 */
export async function updateAgentStatus(
  sb: SupabaseClient,
  agent_slug: string,
  status: "idle" | "working" | "thinking" | "offline"
): Promise<void> {
  await sb
    .from("ops_agents")
    .update({ status, last_active: new Date().toISOString() })
    .eq("slug", agent_slug);
}
