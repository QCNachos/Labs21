import { NextRequest } from "next/server";

/**
 * Verify the bearer token for protected API routes (heartbeat, ops endpoints).
 * The VPS crontab and backend worker authenticate with this token.
 */
export function verifyOpsToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace("Bearer ", "");
  return token === process.env.OPS_API_SECRET;
}

/**
 * Return a 401 response for unauthorized requests.
 */
export function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
