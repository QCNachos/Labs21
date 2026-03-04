import { SupabaseClient } from "@supabase/supabase-js";
import { emitEvent } from "./events";

/**
 * Promote insights that meet the promotion criteria.
 * Insights are agent memories with importance >= threshold and not yet promoted.
 */
export async function promoteInsights(
  sb: SupabaseClient
): Promise<{ promoted: number }> {
  const PROMOTION_THRESHOLD = 7; // importance >= 7 gets promoted

  const { data: candidates } = await sb
    .from("ops_agent_memories")
    .select("id, agent_slug, content, importance, category")
    .eq("promoted", false)
    .gte("importance", PROMOTION_THRESHOLD)
    .order("importance", { ascending: false })
    .limit(5);

  if (!candidates || candidates.length === 0) {
    return { promoted: 0 };
  }

  let promoted = 0;

  for (const memory of candidates) {
    await sb
      .from("ops_agent_memories")
      .update({ promoted: true })
      .eq("id", memory.id);

    await emitEvent(sb, {
      agent_slug: memory.agent_slug,
      event_type: "insight:promoted",
      tags: ["insight", "promoted", memory.category],
      payload: {
        memory_id: memory.id,
        content_preview: memory.content.slice(0, 200),
        importance: memory.importance,
      },
    });

    promoted++;
  }

  return { promoted };
}
