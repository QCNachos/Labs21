"""
Scan Repos executor - CTO monitors GitHub repositories.
"""

import time
import requests
from executors.base import call_agent_llm, emit_event, log_action_run, complete_action_run
from config import Config


def execute_scan_repos(supabase, step: dict) -> dict:
    """Scan GitHub repositories for activity."""
    agent_slug = step["agent_slug"]
    step_input = step.get("input", {})
    step_id = step["id"]

    run_id = log_action_run(supabase, step_id, agent_slug, "scan_repos")
    start = time.time()

    try:
        # Get all active projects with GitHub repos
        projects = (
            supabase.table("ops_projects")
            .select("name, slug, github_repos, tech_stack")
            .eq("status", "active")
            .execute()
        )

        all_repos = []
        for project in (projects.data or []):
            for repo_url in project.get("github_repos", []):
                all_repos.append({"project": project["name"], "url": repo_url})

        if not all_repos:
            output = {"message": "No repositories configured", "repos_scanned": 0}
            complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=0)
            return output

        repo_reports = []
        github_token = step_input.get("github_token") or Config.__dict__.get("GITHUB_TOKEN")
        headers = {"Accept": "application/vnd.github.v3+json"}
        if github_token:
            headers["Authorization"] = f"token {github_token}"

        for repo_info in all_repos[:10]:  # Limit to 10 repos
            repo_url = repo_info["url"]
            # Extract owner/repo from URL
            parts = repo_url.rstrip("/").split("/")
            if len(parts) >= 2:
                owner, repo = parts[-2], parts[-1]
            else:
                continue

            try:
                # Get recent commits
                commits_resp = requests.get(
                    f"https://api.github.com/repos/{owner}/{repo}/commits",
                    headers=headers,
                    params={"per_page": 5},
                    timeout=10,
                )

                # Get open issues/PRs
                issues_resp = requests.get(
                    f"https://api.github.com/repos/{owner}/{repo}/issues",
                    headers=headers,
                    params={"state": "open", "per_page": 10},
                    timeout=10,
                )

                commits = commits_resp.json() if commits_resp.ok else []
                issues = issues_resp.json() if issues_resp.ok else []

                recent_commits = [
                    {
                        "sha": c.get("sha", "")[:7],
                        "message": c.get("commit", {}).get("message", "")[:100],
                        "author": c.get("commit", {}).get("author", {}).get("name", "unknown"),
                        "date": c.get("commit", {}).get("author", {}).get("date", ""),
                    }
                    for c in (commits if isinstance(commits, list) else [])[:5]
                ]

                open_prs = [
                    {"title": i["title"][:100], "number": i["number"]}
                    for i in (issues if isinstance(issues, list) else [])
                    if i.get("pull_request")
                ]

                open_issues = [
                    {"title": i["title"][:100], "number": i["number"]}
                    for i in (issues if isinstance(issues, list) else [])
                    if not i.get("pull_request")
                ]

                repo_reports.append({
                    "project": repo_info["project"],
                    "repo": f"{owner}/{repo}",
                    "recent_commits": recent_commits,
                    "open_prs": len(open_prs),
                    "open_issues": len(open_issues),
                    "pr_titles": [p["title"] for p in open_prs[:5]],
                })

            except requests.RequestException as e:
                repo_reports.append({
                    "project": repo_info["project"],
                    "repo": repo_url,
                    "error": str(e),
                })

        # Use Claude to synthesize the scan
        agent_data = (
            supabase.table("ops_agents")
            .select("system_prompt")
            .eq("slug", agent_slug)
            .single()
            .execute()
        )

        system_prompt = agent_data.data.get("system_prompt", "") if agent_data.data else ""

        scan_data = "\n\n".join(
            [f"REPO: {r['repo']} (Project: {r['project']})\n"
             f"Recent commits: {r.get('recent_commits', [])}\n"
             f"Open PRs: {r.get('open_prs', 0)}\n"
             f"Open Issues: {r.get('open_issues', 0)}"
             for r in repo_reports if "error" not in r]
        )

        user_message = f"""Analyze the following repository scan results:

{scan_data or 'No repository data available'}

Provide a CTO-level technical brief:
1. Activity Summary (what's been happening across repos)
2. Code Quality Concerns (anything that looks risky from commit messages)
3. Open Work (PRs/issues that need attention)
4. Recommendations (prioritized actions)"""

        synthesis = call_agent_llm(supabase, agent_slug, system_prompt, user_message)
        duration = int((time.time() - start) * 1000)

        # Emit events for notable findings
        for report in repo_reports:
            if report.get("recent_commits") and len(report["recent_commits"]) > 0:
                emit_event(
                    supabase,
                    agent_slug,
                    "repo:activity_detected",
                    ["code", "repo", "activity"],
                    {
                        "repo": report["repo"],
                        "project": report["project"],
                        "commit_count": len(report["recent_commits"]),
                    },
                )

        emit_event(
            supabase,
            agent_slug,
            "repo:scan_completed",
            ["code", "scan", "completed"],
            {"repos_scanned": len(repo_reports), "preview": synthesis[:300]},
        )

        output = {"synthesis": synthesis, "repos_scanned": len(repo_reports), "reports": repo_reports}
        complete_action_run(supabase, run_id, "succeeded", output=output, duration_ms=duration)
        return output

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        complete_action_run(supabase, run_id, "failed", error=str(e), duration_ms=duration)
        raise
