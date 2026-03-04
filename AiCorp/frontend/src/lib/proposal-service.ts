import { SupabaseClient } from "@supabase/supabase-js";
import { ProposalServiceInput, ProposalServiceResult } from "@/types";
import { checkCapGates } from "./cap-gates";
import { evaluateAutoApprove } from "./auto-approve";
import { createMissionFromProposal } from "./mission-service";
import { emitEvent } from "./events";
import { getPolicy, startOfTodayUtcIso } from "./policy";

/**
 * THE single entry point for all proposal creation.
 *
 * All sources (API, triggers, reactions) call this one function.
 * This is the hub of the entire closed loop.
 *
 * Flow:
 * 1. Check daily limit
 * 2. Check Cap Gates (resource limits)
 * 3. Insert proposal
 * 4. Emit event
 * 5. Evaluate auto-approve
 * 6. If approved -> create mission + steps
 * 7. Return result
 */
export async function createProposalAndMaybeAutoApprove(
  sb: SupabaseClient,
  input: ProposalServiceInput
): Promise<ProposalServiceResult> {
  // 1. Check daily proposal limit
  const limitPolicy = await getPolicy(sb, "daily_proposal_limit", { limit: 50 });
  const dailyLimit = Number(limitPolicy.limit ?? 50);

  const { count: todayCount } = await sb
    .from("ops_mission_proposals")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfTodayUtcIso());

  if ((todayCount ?? 0) >= dailyLimit) {
    await emitEvent(sb, {
      agent_slug: input.agent_slug,
      event_type: "proposal:rate_limited",
      tags: ["proposal", "rate_limited"],
      payload: { reason: `Daily proposal limit reached (${todayCount}/${dailyLimit})` },
    });

    return {
      success: false,
      reject_reason: `Daily proposal limit reached (${todayCount}/${dailyLimit})`,
    };
  }

  // 2. Check Cap Gates
  const gateResult = await checkCapGates(sb, input.step_kinds);
  if (!gateResult.ok) {
    // Insert as rejected (for auditing), not silently dropped
    const { data: rejectedProposal } = await sb
      .from("ops_mission_proposals")
      .insert({
        agent_slug: input.agent_slug,
        title: input.title,
        description: input.description,
        source: input.source,
        status: "rejected",
        reject_reason: gateResult.reason,
        priority: input.priority ?? 5,
        step_kinds: input.step_kinds,
        metadata: input.metadata ?? {},
        decided_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    await emitEvent(sb, {
      agent_slug: input.agent_slug,
      event_type: "proposal:gate_rejected",
      tags: ["proposal", "rejected", "gate"],
      payload: {
        proposal_id: rejectedProposal?.id,
        reason: gateResult.reason,
        step_kinds: input.step_kinds,
      },
    });

    return {
      success: false,
      proposal_id: rejectedProposal?.id,
      reject_reason: gateResult.reason,
    };
  }

  // 3. Insert proposal as pending
  const { data: proposal, error: insertErr } = await sb
    .from("ops_mission_proposals")
    .insert({
      agent_slug: input.agent_slug,
      title: input.title,
      description: input.description,
      source: input.source,
      status: "pending",
      priority: input.priority ?? 5,
      step_kinds: input.step_kinds,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertErr || !proposal) {
    console.error("[proposalService] Insert failed:", insertErr?.message);
    return { success: false, reject_reason: "Failed to insert proposal" };
  }

  // 4. Emit event
  await emitEvent(sb, {
    agent_slug: input.agent_slug,
    event_type: "proposal:created",
    tags: ["proposal", "created", input.source],
    payload: {
      proposal_id: proposal.id,
      title: input.title,
      source: input.source,
      step_kinds: input.step_kinds,
    },
  });

  // 5. Evaluate auto-approve
  const approvalResult = await evaluateAutoApprove(sb, input.step_kinds);

  if (!approvalResult.approved) {
    // Leave as pending for manual approval
    return {
      success: true,
      proposal_id: proposal.id,
      auto_approved: false,
    };
  }

  // 6. Auto-approved -> update proposal and create mission
  await sb
    .from("ops_mission_proposals")
    .update({
      status: "accepted",
      decided_at: new Date().toISOString(),
    })
    .eq("id", proposal.id);

  await emitEvent(sb, {
    agent_slug: input.agent_slug,
    event_type: "proposal:auto_approved",
    tags: ["proposal", "approved", "auto"],
    payload: { proposal_id: proposal.id },
  });

  const missionId = await createMissionFromProposal(sb, {
    id: proposal.id,
    agent_slug: input.agent_slug,
    title: input.title,
    description: input.description,
    priority: input.priority ?? 5,
    step_kinds: input.step_kinds,
    metadata: input.metadata,
  });

  return {
    success: true,
    proposal_id: proposal.id,
    mission_id: missionId ?? undefined,
    auto_approved: true,
  };
}
