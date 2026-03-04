import { SupabaseClient } from "@supabase/supabase-js";
import { getPolicy } from "./policy";

interface AutoApproveConfig {
  enabled: boolean;
  allowed_step_kinds: string[];
}

/**
 * Evaluate whether a proposal can be auto-approved.
 * Checks the auto_approve policy to determine if all step kinds are whitelisted.
 */
export async function evaluateAutoApprove(
  sb: SupabaseClient,
  stepKinds: string[]
): Promise<{ approved: boolean; reason?: string }> {
  const config = await getPolicy<AutoApproveConfig>(sb, "auto_approve", {
    enabled: false,
    allowed_step_kinds: [],
  });

  if (!config.enabled) {
    return { approved: false, reason: "Auto-approve is disabled" };
  }

  const allowed = new Set(config.allowed_step_kinds);
  const disallowed = stepKinds.filter((kind) => !allowed.has(kind));

  if (disallowed.length > 0) {
    return {
      approved: false,
      reason: `Step kinds not whitelisted for auto-approve: ${disallowed.join(", ")}`,
    };
  }

  return { approved: true };
}
