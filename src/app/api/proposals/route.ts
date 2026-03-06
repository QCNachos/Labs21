import { NextRequest } from "next/server";
import { getSupabase, isAuthorized, unauthorized } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const sb = getSupabase();
  let query = sb.from("ops_mission_proposals").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return Response.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  if (!body.agent_slug || !body.title) return Response.json({ error: "agent_slug and title required" }, { status: 400 });
  const sb = getSupabase();
  const stepKinds: string[] = body.step_kinds ?? [];

  // Check auto-approve policy
  const { data: policyRow } = await sb.from("ops_policy").select("value").eq("key", "auto_approve").single();
  const cfg = (policyRow?.value as Record<string, unknown>) ?? {};
  const allowedKinds = new Set((cfg.allowed_step_kinds as string[]) ?? []);
  const autoApprove = Boolean(cfg.enabled) && stepKinds.every((k) => allowedKinds.has(k));
  const now = new Date().toISOString();

  const { data: proposal } = await sb.from("ops_mission_proposals").insert({
    agent_slug: body.agent_slug, title: body.title,
    description: body.description, source: body.source ?? "api",
    priority: body.priority ?? 5, step_kinds: stepKinds,
    metadata: body.metadata ?? {},
    status: autoApprove ? "accepted" : "pending",
    decided_at: autoApprove ? now : null,
  }).select().single();

  let missionId: string | null = null;
  if (autoApprove && proposal) {
    const { data: mission } = await sb.from("ops_missions").insert({
      proposal_id: proposal.id, agent_slug: body.agent_slug,
      title: body.title, description: body.description,
      priority: body.priority ?? 5, status: "pending",
    }).select().single();
    missionId = mission?.id ?? null;
    if (mission) {
      for (let i = 0; i < stepKinds.length; i++) {
        await sb.from("ops_mission_steps").insert({
          mission_id: mission.id, agent_slug: body.agent_slug,
          step_kind: stepKinds[i], step_order: i, status: "queued",
          input: body.metadata ?? {},
        });
      }
    }
  }

  return Response.json({ success: true, proposal_id: proposal?.id, mission_id: missionId, auto_approved: autoApprove }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await req.json();
  const { id, action, reason } = body;
  if (!id || !action) return Response.json({ error: "id and action required" }, { status: 400 });
  const sb = getSupabase();
  const { data: proposal } = await sb.from("ops_mission_proposals").select("*").eq("id", id).single();
  if (!proposal) return Response.json({ error: "Not found" }, { status: 404 });
  const now = new Date().toISOString();

  if (action === "approve") {
    await sb.from("ops_mission_proposals").update({ status: "accepted", decided_at: now }).eq("id", id);
    const { data: mission } = await sb.from("ops_missions").insert({
      proposal_id: id, agent_slug: proposal.agent_slug,
      title: proposal.title, description: proposal.description,
      priority: proposal.priority ?? 5, status: "pending",
    }).select().single();
    if (mission) {
      for (let i = 0; i < (proposal.step_kinds?.length ?? 0); i++) {
        await sb.from("ops_mission_steps").insert({
          mission_id: mission.id, agent_slug: proposal.agent_slug,
          step_kind: proposal.step_kinds[i], step_order: i, status: "queued",
          input: proposal.metadata ?? {},
        });
      }
      return Response.json({ success: true, mission_id: mission.id });
    }
  } else {
    await sb.from("ops_mission_proposals").update({
      status: "rejected", decided_at: now,
      reject_reason: reason ?? "Rejected by Board Director",
    }).eq("id", id);
  }
  return Response.json({ success: true });
}
