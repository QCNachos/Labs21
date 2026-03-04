/**
 * Frontend API client - all data flows through Python serverless functions.
 * Never imports Supabase directly.
 */

export function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPS_API_SECRET ?? ""}`,
    "Content-Type": "application/json",
  };
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown
): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function apiPut<T = unknown>(
  path: string,
  body: unknown
): Promise<T> {
  return apiFetch<T>(path, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T = unknown>(
  path: string,
  body: unknown
): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
