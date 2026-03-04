-- ============================================================
-- AiCorp Corporate Structure Migration
-- 8 AI agents with executive hierarchy
-- Board Director (human) -> CEO + CFO -> 6 operational leads
-- ============================================================

-- ============================================================
-- 1. Add hierarchy columns to ops_agents
-- ============================================================
alter table public.ops_agents add column if not exists
  title text;                                    -- corporate title

alter table public.ops_agents add column if not exists
  department text;                               -- executive | engineering | growth | content | finance | operations

alter table public.ops_agents add column if not exists
  reports_to text references public.ops_agents(slug); -- who this agent reports to

alter table public.ops_agents add column if not exists
  can_approve boolean not null default false;    -- can this agent approve proposals from others

alter table public.ops_agents add column if not exists
  system_prompt text;                            -- the agent's core personality/instructions

alter table public.ops_agents add column if not exists
  schedule jsonb not null default '{}';          -- cron-like schedule for recurring tasks

-- ============================================================
-- 2. Replace placeholder agents with corporate structure
-- ============================================================
delete from public.ops_agents;

insert into public.ops_agents (slug, name, title, department, reports_to, can_approve, role_desc, system_prompt, schedule) values

  -- EXECUTIVES (report to Board Director = human user)
  ('ceo', 'Atlas', 'Chief Executive Officer', 'executive', null, true,
   'Top-level strategic direction across all portfolio companies. Prioritizes work, resolves cross-team conflicts, produces daily briefings for the Board Director. Can approve or reject proposals from any agent.',
   'You are Atlas, the CEO of AiCorp. You oversee a portfolio of companies on behalf of the Board Director. Your job is to:
- Set strategic priorities across all projects
- Produce daily executive briefings for the Board Director
- Approve or reject proposals from other agents when they exceed auto-approve thresholds
- Resolve conflicts between agents or between projects competing for resources
- Escalate critical decisions to the Board Director
You are decisive, data-driven, and always thinking about ROI and runway. You communicate clearly and concisely.',
   '{"daily_briefing": "0 8 * * *", "weekly_review": "0 9 * * 1", "priority_check": "0 */4 * * *"}'),

  ('cfo', 'Ledger', 'Chief Financial Officer', 'finance', null, true,
   'Financial oversight across all portfolio companies. Tracks runway, burn rate, revenue, fundraising pipeline. Produces financial reports. Validates any decision with cost implications.',
   'You are Ledger, the CFO of AiCorp. You are responsible for the financial health of all portfolio companies. Your job is to:
- Track runway, burn rate, and revenue for each project
- Produce weekly financial summaries for the Board Director
- Flag any spending or resource decisions that affect runway
- Analyze unit economics and pricing strategies
- Support fundraising with financial models, projections, and due diligence prep
- Review any proposal that has cost implications before approval
You are conservative with money, precise with numbers, and always thinking about sustainability.',
   '{"daily_finance_check": "0 7 * * *", "weekly_report": "0 10 * * 5", "runway_alert": "0 */6 * * *"}'),

  -- OPERATIONAL LEADS (report to CEO)
  ('cto', 'Forge', 'Chief Technology Officer', 'engineering', 'ceo', false,
   'Technical oversight across all codebases. Monitors GitHub repos, reviews code quality, suggests architecture improvements, tracks technical debt, identifies security issues.',
   'You are Forge, the CTO of AiCorp. You are responsible for technical excellence across all portfolio projects. Your job is to:
- Monitor all GitHub repositories for new commits, PRs, and issues
- Review code quality and suggest improvements
- Identify technical debt and security vulnerabilities
- Propose architecture improvements and refactors
- Evaluate build/buy decisions for new features
- Produce technical status reports for the CEO
You think in systems, care deeply about code quality, and balance speed with sustainability.',
   '{"repo_scan": "0 */3 * * *", "daily_tech_review": "0 9 * * *", "security_audit": "0 10 * * 3"}'),

  ('strategist', 'Compass', 'Head of Strategy', 'growth', 'ceo', false,
   'Market analysis, competitive intelligence, and growth strategy. Tracks competitors, identifies market opportunities, benchmarks progress against milestones for each project.',
   'You are Compass, Head of Strategy at AiCorp. You are the eyes and ears on the market. Your job is to:
- Monitor competitive landscape for each portfolio company
- Identify market trends and opportunities
- Track project milestones and flag when things are off-track
- Propose growth experiments and go-to-market strategies
- Research potential partnerships and distribution channels
- Produce market intelligence briefs for the CEO
You are curious, analytical, and always looking around corners for the next opportunity or threat.',
   '{"market_scan": "0 8 * * *", "competitor_watch": "0 14 * * *", "weekly_intel": "0 11 * * 1"}'),

  ('content', 'Quill', 'Head of Content', 'content', 'ceo', false,
   'Content creation across all channels. Writes blog posts, social media content, product updates, documentation, newsletters. Maintains brand voice consistency.',
   'You are Quill, Head of Content at AiCorp. You own the voice of every portfolio company. Your job is to:
- Write blog posts, articles, and thought leadership pieces
- Create social media content (X/Twitter, LinkedIn, etc.)
- Produce product updates and changelogs
- Write and maintain documentation
- Draft newsletters and email campaigns
- Ensure brand voice consistency across all content
You are a clear, compelling writer who can adapt tone for different audiences and platforms.',
   '{"daily_content": "0 10 * * *", "social_posts": "0 11,15 * * *", "weekly_newsletter": "0 9 * * 4"}'),

  ('scout', 'Radar', 'Head of Investor Relations', 'finance', 'cfo', false,
   'Investor research and relationship management. Identifies matching investors, tracks funding rounds, monitors investor activity, manages the fundraising pipeline.',
   'You are Radar, Head of Investor Relations at AiCorp. You find and cultivate investor relationships. Your job is to:
- Research investors that match each company''s stage, sector, and geography
- Track recent funding rounds in relevant sectors
- Monitor investor social media and blog posts for signals
- Maintain a CRM-like pipeline of investor leads
- Draft outreach messages and follow-ups
- Report fundraising pipeline status to the CFO
You are methodical, relationship-focused, and always building a warm pipeline before it''s needed.',
   '{"investor_scan": "0 9 * * *", "pipeline_update": "0 16 * * *", "weekly_pipeline": "0 14 * * 2"}'),

  ('pitch', 'Deck', 'Head of Product & Pitch', 'growth', 'ceo', false,
   'Pitch deck creation and product positioning. Maintains pitch decks, one-pagers, competitive comparisons. Tailors materials per investor or audience.',
   'You are Deck, Head of Product & Pitch at AiCorp. You package each company''s story for maximum impact. Your job is to:
- Create and maintain pitch decks for each portfolio company
- Write one-pagers, executive summaries, and teasers
- Build competitive comparison matrices
- Tailor materials for specific investors or audiences
- Collaborate with Radar (IR) on investor-specific versions
- Update decks whenever the Strategist or CTO reports new milestones
You are a storyteller who thinks visually and knows what investors want to see at each stage.',
   '{"deck_review": "0 11 * * 1,4", "milestone_check": "0 15 * * *"}'),

  ('observer', 'Sentinel', 'Chief of Staff', 'operations', 'ceo', false,
   'Quality assurance, cross-team coordination, and internal audit. Reviews everything before it goes out. Flags inconsistencies between agents. Produces daily ops reports.',
   'You are Sentinel, Chief of Staff at AiCorp. You are the quality gate and the connective tissue. Your job is to:
- Review all content before it''s published
- Audit code review suggestions for accuracy
- Flag contradictions or misalignment between agents
- Track cross-project dependencies and blockers
- Produce daily operations summaries for the CEO
- Ensure no agent goes rogue or produces low-quality work
You are meticulous, fair, and the last line of defense before anything reaches the Board Director or the public.',
   '{"morning_audit": "0 8 * * *", "evening_summary": "0 18 * * *", "quality_sweep": "0 */4 * * *"}');

-- ============================================================
-- 3. PROJECTS TABLE (what the agents are working on)
-- ============================================================
create table public.ops_projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  description   text,
  stage         text not null default 'idea',       -- idea | mvp | beta | launched | scaling
  category      text not null default 'saas',       -- saas | marketplace | tool | service | other
  github_repos  text[] not null default '{}',       -- GitHub repo URLs
  website_url   text,
  tech_stack    text[] not null default '{}',
  goals         jsonb not null default '[]',         -- current goals/milestones
  financials    jsonb not null default '{}',         -- runway, burn, revenue
  team_notes    text,                                -- context about human team
  pitch_url     text,                                -- link to current pitch deck
  status        text not null default 'active',      -- active | paused | archived
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_projects_status on public.ops_projects(status);

-- RLS for projects
alter table public.ops_projects enable row level security;
create policy "anon_read_projects" on public.ops_projects for select to anon using (true);
create policy "service_all_projects" on public.ops_projects for all to service_role using (true) with check (true);

-- Updated_at trigger
create trigger trg_projects_updated_at
  before update on public.ops_projects
  for each row execute function public.update_updated_at();

-- ============================================================
-- 4. AGENT DAILY BRIEFINGS (CEO/CFO reports to Board Director)
-- ============================================================
create table public.ops_briefings (
  id            uuid primary key default gen_random_uuid(),
  agent_slug    text not null references public.ops_agents(slug),
  briefing_type text not null default 'daily',       -- daily | weekly | alert | escalation
  title         text not null,
  content       text not null,
  priority      text not null default 'normal',      -- low | normal | high | urgent
  read          boolean not null default false,       -- has the Board Director read it
  projects      text[] not null default '{}',         -- which projects this briefing covers
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index idx_briefings_agent on public.ops_briefings(agent_slug);
create index idx_briefings_unread on public.ops_briefings(read) where read = false;
create index idx_briefings_type on public.ops_briefings(briefing_type);

alter table public.ops_briefings enable row level security;
create policy "anon_read_briefings" on public.ops_briefings for select to anon using (true);
create policy "service_all_briefings" on public.ops_briefings for all to service_role using (true) with check (true);

-- ============================================================
-- 5. DIRECT INSTRUCTIONS (Board Director -> Agent)
-- ============================================================
create table public.ops_instructions (
  id            uuid primary key default gen_random_uuid(),
  target_agent  text not null references public.ops_agents(slug),
  instruction   text not null,
  priority      text not null default 'normal',      -- low | normal | high | urgent
  status        text not null default 'pending',     -- pending | acknowledged | in_progress | completed | cancelled
  response      text,                                -- agent's response
  project_slug  text references public.ops_projects(slug),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index idx_instructions_status on public.ops_instructions(status);
create index idx_instructions_agent on public.ops_instructions(target_agent);

alter table public.ops_instructions enable row level security;
create policy "anon_read_instructions" on public.ops_instructions for select to anon using (true);
create policy "service_all_instructions" on public.ops_instructions for all to service_role using (true) with check (true);

-- ============================================================
-- 6. UPDATE POLICIES for new structure
-- ============================================================

-- Update auto-approve to include new step kinds
update public.ops_policy
set value = '{"enabled": true, "allowed_step_kinds": ["analyze", "crawl", "write_content", "draft_tweet", "review", "diagnose", "research_investors", "scan_repos", "generate_briefing", "update_deck", "financial_analysis"]}'
where key = 'auto_approve';

-- Update reaction matrix for corporate hierarchy
update public.ops_policy
set value = '{
  "patterns": [
    {"source": "cto", "tags": ["code","review"], "target": "observer", "type": "review", "probability": 0.5, "cooldown": 120},
    {"source": "cto", "tags": ["security","alert"], "target": "ceo", "type": "analyze", "probability": 1.0, "cooldown": 30},
    {"source": "content", "tags": ["content","published"], "target": "observer", "type": "review", "probability": 0.6, "cooldown": 120},
    {"source": "scout", "tags": ["investor","leads_found"], "target": "pitch", "type": "update_deck", "probability": 0.7, "cooldown": 240},
    {"source": "scout", "tags": ["investor","leads_found"], "target": "cfo", "type": "analyze", "probability": 0.5, "cooldown": 120},
    {"source": "strategist", "tags": ["milestone","reached"], "target": "pitch", "type": "update_deck", "probability": 0.8, "cooldown": 120},
    {"source": "strategist", "tags": ["milestone","reached"], "target": "ceo", "type": "generate_briefing", "probability": 1.0, "cooldown": 60},
    {"source": "strategist", "tags": ["competitor","alert"], "target": "ceo", "type": "analyze", "probability": 0.8, "cooldown": 120},
    {"source": "*", "tags": ["mission","failed"], "target": "ceo", "type": "diagnose", "probability": 1.0, "cooldown": 60},
    {"source": "*", "tags": ["cost","incurred"], "target": "cfo", "type": "financial_analysis", "probability": 1.0, "cooldown": 60},
    {"source": "ceo", "tags": ["priority","changed"], "target": "observer", "type": "analyze", "probability": 1.0, "cooldown": 30},
    {"source": "*", "tags": ["tweet","posted"], "target": "strategist", "type": "analyze", "probability": 0.3, "cooldown": 120},
    {"source": "pitch", "tags": ["deck","updated"], "target": "observer", "type": "review", "probability": 0.7, "cooldown": 120},
    {"source": "cto", "tags": ["milestone","reached"], "target": "content", "type": "write_content", "probability": 0.6, "cooldown": 240}
  ]
}'
where key = 'reaction_matrix';

-- Add approval routing policy (proposals above certain threshold need CEO/CFO approval)
insert into public.ops_policy (key, value, description) values
  ('approval_routing', '{
    "rules": [
      {"condition": "step_kind:post_tweet", "requires": "ceo", "reason": "Public-facing content needs CEO sign-off"},
      {"condition": "step_kind:deploy", "requires": "ceo", "reason": "Deployments need CEO approval"},
      {"condition": "priority:<=2", "requires": "ceo", "reason": "High-priority proposals need CEO approval"},
      {"condition": "step_kind:financial_analysis", "requires": "cfo", "reason": "Financial work routes through CFO"},
      {"condition": "step_kind:research_investors", "requires": "cfo", "reason": "Investor work routes through CFO"}
    ]
  }', 'Routes proposals to executives for approval based on type/priority'),
  ('agent_schedules', '{
    "description": "Cron schedules for each agent recurring tasks. Processed by heartbeat.",
    "enabled": true
  }', 'Master switch for agent scheduled tasks'),
  ('escalation_policy', '{
    "to_board": {
      "conditions": ["runway_below_3_months", "security_critical", "agent_conflict", "budget_exceeded"],
      "channel": "briefing:urgent"
    },
    "to_ceo": {
      "conditions": ["mission_failed_3x", "cross_project_conflict", "priority_1_proposal"],
      "channel": "briefing:alert"
    }
  }', 'When and how to escalate issues up the chain');

-- ============================================================
-- 7. UPDATE TRIGGER RULES for corporate structure
-- ============================================================
delete from public.ops_trigger_rules;

insert into public.ops_trigger_rules (name, description, condition, action, cooldown_min) values
  ('daily_ceo_briefing',
   'CEO produces daily briefing for Board Director every morning',
   '{"event_type": "schedule:ceo:daily_briefing"}',
   '{"agent_slug": "ceo", "title": "Daily executive briefing", "step_kinds": ["generate_briefing"], "priority": 2}',
   1380),

  ('daily_cfo_finance_check',
   'CFO runs daily financial health check across all projects',
   '{"event_type": "schedule:cfo:daily_finance_check"}',
   '{"agent_slug": "cfo", "title": "Daily financial health check", "step_kinds": ["financial_analysis"], "priority": 3}',
   1380),

  ('repo_activity_review',
   'CTO reviews new code activity across repos',
   '{"event_type": "schedule:cto:repo_scan"}',
   '{"agent_slug": "cto", "title": "Scan repositories for new activity", "step_kinds": ["scan_repos", "analyze"], "priority": 4}',
   120),

  ('market_intelligence',
   'Strategist scans market for competitive intel',
   '{"event_type": "schedule:strategist:market_scan"}',
   '{"agent_slug": "strategist", "title": "Market intelligence scan", "step_kinds": ["crawl", "analyze"], "priority": 4}',
   360),

  ('investor_pipeline_scan',
   'Investor Scout searches for new matching investors',
   '{"event_type": "schedule:scout:investor_scan"}',
   '{"agent_slug": "scout", "title": "Scan for new investor leads", "step_kinds": ["research_investors"], "priority": 5}',
   720),

  ('content_calendar',
   'Content Lead produces scheduled social/blog content',
   '{"event_type": "schedule:content:daily_content"}',
   '{"agent_slug": "content", "title": "Create scheduled content", "step_kinds": ["write_content", "draft_tweet"], "priority": 5}',
   360),

  ('quality_sweep',
   'Observer runs periodic quality audit',
   '{"event_type": "schedule:observer:quality_sweep"}',
   '{"agent_slug": "observer", "title": "Quality audit sweep", "step_kinds": ["review"], "priority": 6}',
   240),

  ('viral_content_analysis',
   'When content engagement spikes, Strategist analyzes why',
   '{"event_type": "tweet:metrics", "field": "engagement_rate", "operator": "gt", "value": 0.05}',
   '{"agent_slug": "strategist", "title": "Analyze viral content performance", "step_kinds": ["analyze"], "priority": 3}',
   120),

  ('mission_failure_escalation',
   'When a mission fails, CEO is notified for diagnosis',
   '{"event_type": "mission:failed"}',
   '{"agent_slug": "ceo", "title": "Review mission failure", "step_kinds": ["diagnose"], "priority": 2}',
   60),

  ('runway_alert',
   'CFO alerts when runway drops below threshold',
   '{"event_type": "financial:runway_check", "field": "months_remaining", "operator": "lt", "value": 3}',
   '{"agent_slug": "cfo", "title": "Runway alert - below 3 months", "step_kinds": ["financial_analysis", "generate_briefing"], "priority": 1}',
   1440);
