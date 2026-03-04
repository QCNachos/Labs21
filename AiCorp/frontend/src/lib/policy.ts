import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get a policy value by key. Returns the fallback if not found.
 */
export async function getPolicy<T>(
  sb: SupabaseClient,
  key: string,
  fallback: T
): Promise<T> {
  const { data, error } = await sb
    .from("ops_policy")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return fallback;
  return data.value as T;
}

/**
 * Update a policy value.
 */
export async function setPolicy(
  sb: SupabaseClient,
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  await sb
    .from("ops_policy")
    .upsert({ key, value, updated_at: new Date().toISOString() });
}

/**
 * Get the start of today in UTC as ISO string.
 */
export function startOfTodayUtcIso(): string {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return start.toISOString();
}
