import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { verifyOpsToken, unauthorizedResponse } from "@/lib/auth";

/**
 * GET /api/projects - List all portfolio projects
 * POST /api/projects - Add a new project to the portfolio
 */
export async function GET(_request: NextRequest) {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("ops_projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();
  const body = await request.json();

  const { name, slug, description, stage, category, github_repos, website_url, tech_stack, goals, financials, team_notes } = body;

  if (!name || !slug) {
    return Response.json({ error: "name and slug required" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("ops_projects")
    .insert({
      name,
      slug,
      description,
      stage: stage ?? "idea",
      category: category ?? "saas",
      github_repos: github_repos ?? [],
      website_url,
      tech_stack: tech_stack ?? [],
      goals: goals ?? [],
      financials: financials ?? {},
      team_notes,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!verifyOpsToken(request)) {
    return unauthorizedResponse();
  }

  const sb = createServiceClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await sb
    .from("ops_projects")
    .update(updates)
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
