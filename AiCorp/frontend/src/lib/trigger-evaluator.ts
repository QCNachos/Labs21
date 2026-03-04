import { SupabaseClient } from "@supabase/supabase-js";
import { TriggerRule } from "@/types";
import { createProposalAndMaybeAutoApprove } from "./proposal-service";
import { emitEvent } from "./events";

/**
 * Evaluate all enabled trigger rules.
 * Triggers detect conditions and hand proposal templates to the proposal service.
 * All cap gates and auto-approve logic apply automatically.
 *
 * @param timeoutMs - max time to spend evaluating
 */
export async function evaluateTriggers(
  sb: SupabaseClient,
  timeoutMs: number = 4000
): Promise<{ evaluated: number; fired: number }> {
  const startTime = Date.now();
  let evaluated = 0;
  let fired = 0;

  // Get all enabled trigger rules
  const { data: rules } = await sb
    .from("ops_trigger_rules")
    .select("*")
    .eq("enabled", true);

  if (!rules || rules.length === 0) return { evaluated: 0, fired: 0 };

  for (const rule of rules as TriggerRule[]) {
    // Respect timeout
    if (Date.now() - startTime > timeoutMs) break;

    evaluated++;

    // Check cooldown
    if (rule.last_fired_at) {
      const cooldownMs = rule.cooldown_min * 60 * 1000;
      const lastFired = new Date(rule.last_fired_at).getTime();
      if (Date.now() - lastFired < cooldownMs) continue;
    }

    // Evaluate condition against recent events
    const outcome = await evaluateCondition(sb, rule);

    if (outcome.fired && outcome.proposal) {
      // Trigger fires -> create proposal through the service
      const result = await createProposalAndMaybeAutoApprove(sb, {
        ...outcome.proposal,
        source: "trigger",
      });

      if (result.success) {
        fired++;

        // Update trigger tracking
        await sb
          .from("ops_trigger_rules")
          .update({
            last_fired_at: new Date().toISOString(),
            fire_count: rule.fire_count + 1,
          })
          .eq("id", rule.id);

        await emitEvent(sb, {
          event_type: "trigger:fired",
          tags: ["trigger", "fired", rule.name],
          payload: {
            rule_id: rule.id,
            rule_name: rule.name,
            proposal_id: result.proposal_id,
          },
        });
      }
    }
  }

  return { evaluated, fired };
}

/**
 * Evaluate a single trigger condition against recent events.
 */
async function evaluateCondition(
  sb: SupabaseClient,
  rule: TriggerRule
): Promise<{
  fired: boolean;
  proposal?: {
    agent_slug: string;
    title: string;
    description?: string;
    priority: number;
    step_kinds: string[];
    metadata?: Record<string, unknown>;
  };
}> {
  const condition = rule.condition as {
    event_type: string;
    field?: string;
    operator?: string;
    value?: number;
  };

  const action = rule.action as {
    agent_slug: string;
    title: string;
    step_kinds: string[];
    priority: number;
  };

  // Look for matching events in the last evaluation window (since last fired or last 5 minutes)
  const since = rule.last_fired_at
    ? rule.last_fired_at
    : new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: events } = await sb
    .from("ops_agent_events")
    .select("*")
    .eq("event_type", condition.event_type)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!events || events.length === 0) {
    return { fired: false };
  }

  // If there's a metric condition, check it
  if (condition.field && condition.operator && condition.value !== undefined) {
    const matchingEvent = events.find((evt) => {
      const fieldValue = Number(evt.payload?.[condition.field!] ?? 0);
      switch (condition.operator) {
        case "gt":
          return fieldValue > condition.value!;
        case "gte":
          return fieldValue >= condition.value!;
        case "lt":
          return fieldValue < condition.value!;
        case "lte":
          return fieldValue <= condition.value!;
        case "eq":
          return fieldValue === condition.value!;
        default:
          return false;
      }
    });

    if (!matchingEvent) return { fired: false };

    return {
      fired: true,
      proposal: {
        agent_slug: action.agent_slug,
        title: action.title,
        priority: action.priority,
        step_kinds: action.step_kinds,
        metadata: { trigger_rule: rule.name, source_event_id: matchingEvent.id },
      },
    };
  }

  // Simple event existence trigger (no metric condition)
  return {
    fired: true,
    proposal: {
      agent_slug: action.agent_slug,
      title: action.title,
      priority: action.priority,
      step_kinds: action.step_kinds,
      metadata: {
        trigger_rule: rule.name,
        source_event_id: events[0].id,
      },
    },
  };
}
