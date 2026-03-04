import { SupabaseClient } from "@supabase/supabase-js";
import { StepKindGateResult } from "@/types";
import { getPolicy, startOfTodayUtcIso } from "./policy";

/**
 * Cap Gates - reject proposals at the entry point based on resource limits.
 * Each step kind has its own gate check.
 * Key principle: Reject at the gate, don't pile up in the queue.
 */

type GateChecker = (sb: SupabaseClient) => Promise<StepKindGateResult>;

// -- Individual gate implementations --

async function checkPostTweetGate(sb: SupabaseClient): Promise<StepKindGateResult> {
  const autopost = await getPolicy(sb, "x_autopost", { enabled: true });
  if (autopost.enabled === false) {
    return { ok: false, reason: "x_autopost is disabled" };
  }

  const quota = await getPolicy(sb, "x_daily_quota", { limit: 8 });
  const limit = Number(quota.limit ?? 8);

  const { count } = await sb
    .from("ops_tweet_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "posted")
    .gte("posted_at", startOfTodayUtcIso());

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Daily tweet quota reached (${count}/${limit})` };
  }

  return { ok: true };
}

async function checkWriteContentGate(sb: SupabaseClient): Promise<StepKindGateResult> {
  // Check daily content production cap (prevent runaway content generation)
  const today = startOfTodayUtcIso();

  const { count } = await sb
    .from("ops_mission_steps")
    .select("id", { count: "exact", head: true })
    .eq("step_kind", "write_content")
    .in("status", ["succeeded", "running", "queued"])
    .gte("created_at", today);

  const MAX_DAILY_CONTENT = 20;
  if ((count ?? 0) >= MAX_DAILY_CONTENT) {
    return { ok: false, reason: `Daily content cap reached (${count}/${MAX_DAILY_CONTENT})` };
  }

  return { ok: true };
}

async function checkDeployGate(sb: SupabaseClient): Promise<StepKindGateResult> {
  // Check if there's already a deploy running
  const { count } = await sb
    .from("ops_mission_steps")
    .select("id", { count: "exact", head: true })
    .eq("step_kind", "deploy")
    .eq("status", "running");

  if ((count ?? 0) > 0) {
    return { ok: false, reason: "Another deploy is already in progress" };
  }

  return { ok: true };
}

// Gate that always passes (for step kinds with no cap)
async function passGate(): Promise<StepKindGateResult> {
  return { ok: true };
}

// -- Gate registry --

const STEP_KIND_GATES: Record<string, GateChecker> = {
  post_tweet: checkPostTweetGate,
  draft_tweet: checkPostTweetGate, // drafting also subject to tweet quota
  write_content: checkWriteContentGate,
  deploy: checkDeployGate,
  analyze: passGate,
  crawl: passGate,
  diagnose: passGate,
  review: passGate,
  // Corporate structure executors
  generate_briefing: passGate,
  financial_analysis: passGate,
  scan_repos: passGate,
  research_investors: passGate,
  update_deck: passGate,
};

/**
 * Check all cap gates for a list of step kinds.
 * Returns the first failure, or ok if all pass.
 */
export async function checkCapGates(
  sb: SupabaseClient,
  stepKinds: string[]
): Promise<StepKindGateResult> {
  for (const kind of stepKinds) {
    const checker = STEP_KIND_GATES[kind] ?? passGate;
    const result = await checker(sb);
    if (!result.ok) {
      return { ok: false, reason: `[${kind}] ${result.reason}` };
    }
  }
  return { ok: true };
}
