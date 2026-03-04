import { SupabaseClient } from "@supabase/supabase-js";
import { ReactionPattern } from "@/types";
import { getPolicy } from "./policy";
import { createProposalAndMaybeAutoApprove } from "./proposal-service";
import { emitEvent } from "./events";

/**
 * Process the reaction queue.
 * Reactions are spontaneous inter-agent interactions based on the reaction matrix.
 *
 * Flow:
 * 1. Check recent events for pattern matches
 * 2. Roll probability dice
 * 3. Create proposals through the proposal service
 */
export async function processReactionQueue(
  sb: SupabaseClient,
  timeoutMs: number = 3000
): Promise<{ processed: number; created: number }> {
  const startTime = Date.now();
  let processed = 0;
  let created = 0;

  // 1. Process any pending reactions in the queue
  const { data: pendingReactions } = await sb
    .from("ops_agent_reactions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

  if (pendingReactions && pendingReactions.length > 0) {
    for (const reaction of pendingReactions) {
      if (Date.now() - startTime > timeoutMs) break;

      processed++;

      // Mark as processing
      await sb
        .from("ops_agent_reactions")
        .update({ status: "processing" })
        .eq("id", reaction.id);

      // Create proposal
      const result = await createProposalAndMaybeAutoApprove(sb, {
        agent_slug: reaction.target_agent,
        title: `Reaction: ${reaction.reaction_type} from ${reaction.source_agent ?? "system"}`,
        description: `Auto-generated reaction to event ${reaction.source_event_id}`,
        source: "reaction",
        step_kinds: [reaction.reaction_type],
        metadata: {
          reaction_id: reaction.id,
          source_event_id: reaction.source_event_id,
          source_agent: reaction.source_agent,
          ...reaction.input,
        },
      });

      if (result.success) {
        created++;
        await sb
          .from("ops_agent_reactions")
          .update({
            status: "completed",
            output: { proposal_id: result.proposal_id, mission_id: result.mission_id },
            processed_at: new Date().toISOString(),
          })
          .eq("id", reaction.id);
      } else {
        await sb
          .from("ops_agent_reactions")
          .update({
            status: "skipped",
            output: { reason: result.reject_reason },
            processed_at: new Date().toISOString(),
          })
          .eq("id", reaction.id);
      }
    }
  }

  // 2. Scan recent events for new reaction matches
  if (Date.now() - startTime < timeoutMs) {
    const newReactions = await scanForNewReactions(sb);
    created += newReactions;
  }

  return { processed, created };
}

/**
 * Scan recent events against the reaction matrix and queue new reactions.
 */
async function scanForNewReactions(sb: SupabaseClient): Promise<number> {
  const matrix = await getPolicy<{ patterns: ReactionPattern[] }>(sb, "reaction_matrix", {
    patterns: [],
  });

  if (!matrix.patterns || matrix.patterns.length === 0) return 0;

  // Get events from the last 10 minutes that haven't been reaction-matched
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: recentEvents } = await sb
    .from("ops_agent_events")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!recentEvents || recentEvents.length === 0) return 0;

  let queued = 0;

  for (const event of recentEvents) {
    for (const pattern of matrix.patterns) {
      // Check source match
      if (pattern.source !== "*" && pattern.source !== event.agent_slug) continue;

      // Check tag match (all pattern tags must be present in event tags)
      const eventTags = event.tags as string[];
      const allTagsMatch = pattern.tags.every((t: string) => eventTags.includes(t));
      if (!allTagsMatch) continue;

      // Check cooldown (avoid duplicate reactions for same event+pattern)
      const { count: existingCount } = await sb
        .from("ops_agent_reactions")
        .select("id", { count: "exact", head: true })
        .eq("source_event_id", event.id)
        .eq("target_agent", pattern.target)
        .eq("reaction_type", pattern.type);

      if ((existingCount ?? 0) > 0) continue;

      // Check cooldown for this target agent + reaction type
      const cooldownSince = new Date(
        Date.now() - pattern.cooldown * 60 * 1000
      ).toISOString();

      const { count: recentCount } = await sb
        .from("ops_agent_reactions")
        .select("id", { count: "exact", head: true })
        .eq("target_agent", pattern.target)
        .eq("reaction_type", pattern.type)
        .gte("created_at", cooldownSince);

      if ((recentCount ?? 0) > 0) continue;

      // Roll probability dice
      if (Math.random() > pattern.probability) continue;

      // Queue the reaction
      await sb.from("ops_agent_reactions").insert({
        source_event_id: event.id,
        source_agent: event.agent_slug,
        target_agent: pattern.target,
        reaction_type: pattern.type,
        status: "pending",
        input: { event_type: event.event_type, event_payload: event.payload },
      });

      await emitEvent(sb, {
        agent_slug: pattern.target,
        event_type: "reaction:queued",
        tags: ["reaction", "queued", pattern.type],
        payload: {
          source_event_id: event.id,
          source_agent: event.agent_slug,
          target_agent: pattern.target,
          reaction_type: pattern.type,
          probability: pattern.probability,
        },
      });

      queued++;
    }
  }

  return queued;
}
