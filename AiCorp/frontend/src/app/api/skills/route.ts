import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";

/**
 * GET /api/skills - List all skills with agent assignments
 * POST /api/skills - Create a new skill
 */
export async function GET(_request: NextRequest) {
  const sb = createServiceClient();

  const { data: skills, error } = await sb
    .from("ops_agent_skills")
    .select("*, assignments:ops_agent_skill_assignments(agent_slug, priority)")
    .order("name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(skills);
}

export async function POST(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();
  const body = await request.json();

  const { slug, name, description, content, category, source, source_url, assign_to } = body;

  if (!slug || !name || !content) {
    return Response.json({ error: "slug, name, and content required" }, { status: 400 });
  }

  // Create the skill
  const { data: skill, error: createErr } = await sb
    .from("ops_agent_skills")
    .insert({
      slug,
      name,
      description,
      content,
      category: category ?? "general",
      source: source ?? "custom",
      source_url,
    })
    .select("id")
    .single();

  if (createErr) {
    return Response.json({ error: createErr.message }, { status: 500 });
  }

  // Assign to agents if specified
  if (assign_to && Array.isArray(assign_to) && skill) {
    const assignments = assign_to.map((agent_slug: string) => ({
      agent_slug,
      skill_id: skill.id,
      priority: 5,
    }));

    await sb.from("ops_agent_skill_assignments").insert(assignments);
  }

  return Response.json({ success: true, skill_id: skill?.id }, { status: 201 });
}
