import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";
import { evaluateTriggers } from "@/lib/trigger-evaluator";
import { processReactionQueue } from "@/lib/reaction-processor";
import { promoteInsights } from "@/lib/insight-promoter";
import { recoverStaleSteps } from "@/lib/stale-recovery";
import { HeartbeatResult } from "@/types";

/**
 * POST /api/ops/heartbeat
 *
 * The heartbeat is the control plane. It runs every 5 minutes via VPS crontab.
 * Vercel only runs the lightweight control plane (evaluate triggers,
 * process reaction queue, promote insights, clean up stuck tasks).
 * VPS is the sole executor of actual work.
 */
export async function POST(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();

  try {
    // Run all four control plane tasks
    const [triggerResult, reactionResult, learningResult, staleResult] =
      await Promise.all([
        evaluateTriggers(sb, 4000),
        processReactionQueue(sb, 3000),
        promoteInsights(sb),
        recoverStaleSteps(sb),
      ]);

    const result: HeartbeatResult = {
      triggers: triggerResult,
      reactions: reactionResult,
      insights: learningResult,
      stale: staleResult,
      timestamp: new Date().toISOString(),
    };

    return Response.json(result);
  } catch (err) {
    console.error("[heartbeat] Error:", err);
    return Response.json(
      { error: "Heartbeat failed", detail: String(err) },
      { status: 500 }
    );
  }
}

// Also support GET for simple health checks
export async function GET(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}
