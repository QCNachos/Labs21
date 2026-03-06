import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  const secret = process.env.OPS_API_SECRET ?? "";
  return Boolean(secret) && token === secret;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
