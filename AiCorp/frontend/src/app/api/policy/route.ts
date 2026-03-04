import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";

/**
 * GET /api/policy - List all policies
 * PUT /api/policy - Update a policy
 */
export async function GET(_request: NextRequest) {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("ops_policy")
    .select("*")
    .order("key");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function PUT(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();
  const { key, value } = await request.json();

  if (!key || value === undefined) {
    return Response.json(
      { error: "key and value required" },
      { status: 400 }
    );
  }

  const { error } = await sb
    .from("ops_policy")
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, key });
}
