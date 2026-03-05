"""
CEO Daily/Weekly/Monthly Email Reporter

Run via crontab on VPS:
  # Daily at 7am
  0 7 * * *   /path/to/venv/bin/python /path/to/ceo_daily.py daily

  # Weekly recap every Monday 7am
  0 7 * * 1   /path/to/venv/bin/python /path/to/ceo_daily.py weekly

  # Monthly board meeting prep on 1st of each month 7am
  0 7 1 * *   /path/to/venv/bin/python /path/to/ceo_daily.py monthly

Usage:
  python ceo_daily.py [daily|weekly|monthly]
"""

import sys
import logging
import json
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ceo_daily")

from config import Config
from supabase_client import get_supabase
from llm import call_llm
from email_sender import send_email, build_html_report


CEO_AGENT_SLUG = "ceo"


def gather_context(sb, report_type: str) -> dict:
    """Gather all relevant context for the CEO report."""
    now = datetime.now(timezone.utc)

    if report_type == "daily":
        cutoff = now - timedelta(hours=24)
    elif report_type == "weekly":
        cutoff = now - timedelta(days=7)
    else:  # monthly
        cutoff = now - timedelta(days=30)

    cutoff_iso = cutoff.isoformat()

    # Recent events
    events = (
        sb.table("ops_agent_events")
        .select("agent_slug, event_type, payload, created_at")
        .gte("created_at", cutoff_iso)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )

    # Active projects
    projects = (
        sb.table("ops_projects")
        .select("name, slug, sector, sub_sector, stage, status, description, links, priority")
        .eq("is_active", True)
        .order("priority")
        .execute()
    )

    # Missions in period
    missions_recent = (
        sb.table("ops_missions")
        .select("title, agent_slug, status, created_at, completed_at")
        .gte("created_at", cutoff_iso)
        .order("created_at", desc=True)
        .execute()
    )

    # Active missions
    missions_active = (
        sb.table("ops_missions")
        .select("title, agent_slug, status")
        .in_("status", ["pending", "running"])
        .execute()
    )

    # Pending proposals
    proposals = (
        sb.table("ops_mission_proposals")
        .select("title, agent_slug, priority, created_at")
        .eq("status", "pending")
        .execute()
    )

    # Agents status
    agents = (
        sb.table("ops_agents")
        .select("slug, name, title, status, last_active")
        .execute()
    )

    # Pending instructions
    instructions = (
        sb.table("ops_instructions")
        .select("instruction, target_agent, priority, created_at")
        .in_("status", ["pending", "acknowledged", "in_progress"])
        .execute()
    )

    # Recent board meetings (for monthly)
    board_meetings = None
    if report_type == "monthly":
        board_meetings = (
            sb.table("ops_board_meetings")
            .select("date, title, summary, decisions, action_items")
            .order("date", desc=True)
            .limit(3)
            .execute()
        )

    return {
        "events": events.data or [],
        "projects": projects.data or [],
        "missions_recent": missions_recent.data or [],
        "missions_active": missions_active.data or [],
        "proposals": proposals.data or [],
        "agents": agents.data or [],
        "instructions": instructions.data or [],
        "board_meetings": board_meetings.data if board_meetings else [],
        "report_type": report_type,
        "period_start": cutoff_iso,
    }


def build_llm_prompt(ctx: dict, report_type: str, agent_name: str) -> tuple[str, str]:
    """Build system + user prompt for the CEO to generate the report."""

    date_label = {"daily": "today", "weekly": "this week", "monthly": "this month"}[report_type]

    report_titles = {
        "daily": "Daily Briefing",
        "weekly": "Weekly Recap",
        "monthly": "Monthly Board Meeting Preparation",
    }

    system = f"""You are {agent_name}, the CEO of Labs21 — an organization building innovative technologies, products and art since 2021.
You are writing a {report_titles[report_type]} for the Board Director (your principal).
Your tone is direct, data-driven, and action-oriented. You are proactive about surfacing blockers and opportunities.
You speak as a capable executive who takes ownership."""

    events_txt = "\n".join(
        f"- [{e.get('agent_slug','?')}] {e['event_type']}"
        for e in ctx["events"][:30]
    ) or "None"

    projects_txt = "\n".join(
        f"- {p['name']} ({p.get('sector','?')}{f'/{p[\"sub_sector\"]}' if p.get('sub_sector') else ''}) — {p['stage']} / {p['status']}"
        + (f": {p['description'][:100]}" if p.get("description") else "")
        for p in ctx["projects"]
    ) or "No active projects"

    missions_txt = "\n".join(
        f"- [{m['agent_slug']}] {m['title']} ({m['status']})"
        for m in ctx["missions_recent"][:15]
    ) or "None"

    active_missions_txt = "\n".join(
        f"- [{m['agent_slug']}] {m['title']}"
        for m in ctx["missions_active"]
    ) or "None"

    pending_proposals_txt = "\n".join(
        f"- [{p['agent_slug']}] {p['title']} (P{p['priority']})"
        for p in ctx["proposals"]
    ) or "None"

    instructions_txt = "\n".join(
        f"- To {i['target_agent']}: {i['instruction'][:120]} [{i['priority']}]"
        for i in ctx["instructions"]
    ) or "None"

    agents_txt = "\n".join(
        f"- {a['name']} ({a['slug']}): {a['status']}"
        for a in ctx["agents"]
    ) or "None"

    board_txt = ""
    if ctx["board_meetings"]:
        board_txt = "\nLAST BOARD MEETINGS:\n" + "\n".join(
            f"- {m['date']}: {m['title']} — {m['summary'][:200]}"
            for m in ctx["board_meetings"]
        )

    report_instructions = {
        "daily": """Write a concise Daily Briefing with these sections:

## Executive Summary
2-3 sentences on the state of operations today.

## Key Highlights
Top 3-5 items that need attention (bullets).

## Project Status
One line per active project with current status.

## Active Missions & Pipeline
What's running, what's pending.

## Blockers & Risks
Any issues I need to know about.

## Recommendations
Specific actions for the Board Director to take or approve today.

## My Questions
Ask 3-5 specific questions for the Board Director to answer that would help me execute better.

Keep the total under 600 words. Be sharp, specific, and actionable.""",

        "weekly": """Write a Weekly Recap with these sections:

## Week in Review
Key accomplishments and milestones this week (3-5 bullets).

## Project Progress
Status update per project — what moved, what stalled.

## Metrics & Output
What got shipped, built, or completed this week.

## Team Performance
Agent activity summary.

## Blockers Encountered
Issues that slowed us down and how they were resolved (or not).

## Next Week Priorities
Top 3-5 priorities for next week.

## Questions for Board Director
5-7 questions to align on strategy and priorities for next week.

Keep under 800 words. Data-driven and honest.""",

        "monthly": """Write a Monthly Board Meeting Preparation with these sections:

## Month in Review
High-level summary of the month.

## Portfolio Status
Each sector (Trading, Platforms, Marketing, Art, Others) with key highlights.

## Financial & Resource Overview
Burn, costs, significant expenses (if known).

## Strategic Progress
Are we on track with our goals? What shifted?

## Key Decisions Needed
Top 3-5 decisions that require Board Director input this month.

## Risks & Opportunities
Major risks to address and opportunities to capitalize on.

## Next Month Plan
High-level priorities and goals.

## Board Questions
7-10 strategic questions for the Board Director.

Keep under 1200 words. Executive level, no fluff.""",
    }

    user = f"""Generate the {report_titles[report_type]} for {date_label}.

ACTIVE PROJECTS:
{projects_txt}

RECENT ACTIVITY ({date_label}):
{events_txt}

MISSIONS COMPLETED/RUNNING ({date_label}):
{missions_txt}

CURRENTLY ACTIVE MISSIONS:
{active_missions_txt}

PENDING PROPOSALS (awaiting approval):
{pending_proposals_txt}

PENDING INSTRUCTIONS FROM BOARD:
{instructions_txt}

TEAM STATUS:
{agents_txt}
{board_txt}

{report_instructions[report_type]}"""

    return system, user


def extract_questions(content: str) -> list[dict]:
    """Parse questions from the My Questions / Board Questions section."""
    questions = []
    in_questions = False
    for line in content.split("\n"):
        stripped = line.strip()
        if any(h in stripped.lower() for h in ["## my questions", "## board questions", "## questions for board"]):
            in_questions = True
            continue
        if stripped.startswith("## ") and in_questions:
            break
        if in_questions and stripped:
            # Remove list markers
            q = stripped.lstrip("0123456789.-) ").strip()
            if len(q) > 10:
                questions.append({"q": q, "answered": False})
    return questions[:10]


def run(report_type: str = "daily"):
    logger.info(f"Starting CEO {report_type} report")

    sb = get_supabase()
    to_email = Config.CEO_EMAIL_TO

    if not to_email:
        logger.error("CEO_EMAIL_TO not set — aborting")
        sys.exit(1)

    # Get CEO agent info
    ceo = sb.table("ops_agents").select("name, title, system_prompt").eq("slug", CEO_AGENT_SLUG).single().execute()
    agent_name = ceo.data["name"] if ceo.data else "CEO"
    system_prompt_override = ceo.data.get("system_prompt") if ceo.data else None

    today = datetime.now(timezone.utc).date()

    # Check if already sent today (for daily)
    if report_type == "daily":
        existing = (
            sb.table("ops_daily_reports")
            .select("id, status")
            .eq("agent_slug", CEO_AGENT_SLUG)
            .eq("date", today.isoformat())
            .eq("report_type", "daily")
            .execute()
        )
        if existing.data and existing.data[0]["status"] == "sent":
            logger.info("Daily report already sent today — skipping")
            return

    # Gather context and generate
    ctx = gather_context(sb, report_type)
    system, user_message = build_llm_prompt(ctx, report_type, agent_name)
    if system_prompt_override:
        system = system_prompt_override + "\n\n" + system

    logger.info("Calling LLM to generate report content…")
    # Smart tier for CEO reports; fall back to fast (Groq) if no premium key
    if Config.ANTHROPIC_API_KEY:
        model = Config.MODEL_TIER_SMART
    elif Config.OPENAI_API_KEY:
        model = "openai:gpt-4o"
    else:
        model = Config.MODEL_TIER_FAST  # Groq free tier
    logger.info(f"Using model: {model}")
    content = call_llm(system, user_message, model=model, max_tokens=3000)

    questions = extract_questions(content)
    date_str = today.strftime("%B %-d, %Y")

    # Build email
    html = build_html_report(report_type, date_str, agent_name, content, questions)
    text = f"Labs21 {report_type.capitalize()} Report — {date_str}\n\n{content}"

    report_titles = {"daily": "Daily Briefing", "weekly": "Weekly Recap", "monthly": "Monthly Board Meeting Prep"}
    subject = f"[Labs21 CEO] {report_titles[report_type]} — {date_str}"

    # Send email
    logger.info(f"Sending email to {to_email}…")
    sent = send_email(to_email, subject, html, text)

    # Save to ops_daily_reports
    try:
        sb.table("ops_daily_reports").insert({
            "agent_slug": CEO_AGENT_SLUG,
            "date": today.isoformat(),
            "report_type": report_type,
            "content": content,
            "questions": questions,
            "status": "sent" if sent else "draft",
            "email_sent_at": datetime.now(timezone.utc).isoformat() if sent else None,
        }).execute()
    except Exception as e:
        # unique constraint: update existing draft
        existing_reports = (
            sb.table("ops_daily_reports")
            .select("id")
            .eq("agent_slug", CEO_AGENT_SLUG)
            .eq("date", today.isoformat())
            .eq("report_type", report_type)
            .execute()
        )
        if existing_reports.data:
            sb.table("ops_daily_reports").update({
                "content": content,
                "questions": questions,
                "status": "sent" if sent else "draft",
                "email_sent_at": datetime.now(timezone.utc).isoformat() if sent else None,
            }).eq("id", existing_reports.data[0]["id"]).execute()

    # Also create a briefing entry so it shows in admin portal
    sb.table("ops_briefings").insert({
        "agent_slug": CEO_AGENT_SLUG,
        "briefing_type": report_type,
        "title": f"{report_titles[report_type]} — {date_str}",
        "content": content,
        "priority": "urgent" if report_type == "monthly" else ("high" if report_type == "weekly" else "normal"),
        "projects": [p["slug"] for p in ctx["projects"] if p.get("slug")][:10],
        "metadata": {"questions_count": len(questions), "email_sent": sent},
    }).execute()

    # Emit event
    sb.table("ops_agent_events").insert({
        "agent_slug": CEO_AGENT_SLUG,
        "event_type": f"report:{report_type}_sent" if sent else f"report:{report_type}_draft",
        "tags": ["report", report_type, "email"],
        "payload": {"date": today.isoformat(), "questions": len(questions), "email_sent": sent, "to": to_email},
    }).execute()

    logger.info(f"Done — report {'sent' if sent else 'saved as draft (email failed)'}")


if __name__ == "__main__":
    report_type = sys.argv[1] if len(sys.argv) > 1 else "daily"
    if report_type not in ("daily", "weekly", "monthly"):
        print(f"Usage: python ceo_daily.py [daily|weekly|monthly]")
        sys.exit(1)
    run(report_type)
