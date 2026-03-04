-- ============================================================
-- AiCorp Autonomous Agent Operations Schema
-- 6 AI agents, closed-loop execution system
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ============================================================
-- 1. AGENTS
-- ============================================================
create table public.ops_agents (
  id          serial primary key,
  slug        text unique not null,          -- e.g. 'role-1', 'role-2'
  name        text not null,                 -- display name
  role_desc   text,                          -- what this agent does
  avatar_url  text,
  status      text not null default 'idle',  -- idle | working | thinking | offline
  last_active timestamptz,
  config      jsonb not null default '{}',   -- agent-specific config
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed 6 placeholder agents
insert into public.ops_agents (slug, name, role_desc) values
  ('role-1', 'Agent 1', 'Role 1 - to be defined'),
  ('role-2', 'Agent 2', 'Role 2 - to be defined'),
  ('role-3', 'Agent 3', 'Role 3 - to be defined'),
  ('role-4', 'Agent 4', 'Role 4 - to be defined'),
  ('role-5', 'Agent 5', 'Role 5 - to be defined'),
  ('role-6', 'Agent 6', 'Role 6 - to be defined');

-- ============================================================
-- 2. POLICIES (config store)
-- ============================================================
create table public.ops_policy (
  key         text primary key,
  value       jsonb not null default '{}',
  description text,
  updated_at  timestamptz not null default now()
);

-- Seed default policies
insert into public.ops_policy (key, value, description) values
  ('auto_approve', '{"enabled": true, "allowed_step_kinds": ["analyze", "crawl", "write_content", "draft_tweet", "review", "diagnose"]}', 'Auto-approval configuration'),
  ('x_daily_quota', '{"limit": 8}', 'Daily tweet posting limit'),
  ('x_autopost', '{"enabled": true}', 'Whether auto-posting to X is enabled'),
  ('worker_policy', '{"enabled": false}', 'Whether Vercel executes steps (false = VPS only)'),
  ('daily_proposal_limit', '{"limit": 50}', 'Max proposals per day across all agents'),
  ('reaction_matrix', '{
    "patterns": [
      {"source": "*", "tags": ["tweet","posted"], "target": "role-3", "type": "analyze", "probability": 0.3, "cooldown": 120},
      {"source": "*", "tags": ["mission:failed"], "target": "role-2", "type": "diagnose", "probability": 1.0, "cooldown": 60},
      {"source": "*", "tags": ["content","published"], "target": "role-6", "type": "review", "probability": 0.5, "cooldown": 120},
      {"source": "*", "tags": ["insight","promoted"], "target": "role-2", "type": "analyze", "probability": 0.4, "cooldown": 240}
    ]
  }', 'Inter-agent reaction probability matrix');

-- ============================================================
-- 3. MISSION PROPOSALS
-- ============================================================
create table public.ops_mission_proposals (
  id            uuid primary key default gen_random_uuid(),
  agent_slug    text not null references public.ops_agents(slug),
  title         text not null,
  description   text,
  source        text not null default 'api',  -- api | trigger | reaction
  status        text not null default 'pending', -- pending | accepted | rejected
  reject_reason text,
  priority      int not null default 5,       -- 1 (highest) to 10 (lowest)
  step_kinds    text[] not null default '{}',  -- planned step kinds
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create index idx_proposals_status on public.ops_mission_proposals(status);
create index idx_proposals_agent on public.ops_mission_proposals(agent_slug);
create index idx_proposals_created on public.ops_mission_proposals(created_at desc);

-- ============================================================
-- 4. MISSIONS
-- ============================================================
create table public.ops_missions (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid references public.ops_mission_proposals(id),
  agent_slug    text not null references public.ops_agents(slug),
  title         text not null,
  description   text,
  status        text not null default 'pending', -- pending | running | succeeded | failed | cancelled
  priority      int not null default 5,
  result        jsonb,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_missions_status on public.ops_missions(status);
create index idx_missions_agent on public.ops_missions(agent_slug);

-- ============================================================
-- 5. MISSION STEPS
-- ============================================================
create table public.ops_mission_steps (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references public.ops_missions(id) on delete cascade,
  agent_slug    text not null references public.ops_agents(slug),
  step_kind     text not null,                -- analyze | write_content | post_tweet | crawl | diagnose | review | draft_tweet | deploy
  step_order    int not null default 0,
  status        text not null default 'queued', -- queued | running | succeeded | failed | skipped
  input         jsonb not null default '{}',
  output        jsonb,
  last_error    text,
  claimed_by    text,                          -- worker id that claimed this step
  reserved_at   timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_steps_status on public.ops_mission_steps(status);
create index idx_steps_mission on public.ops_mission_steps(mission_id);
create index idx_steps_queued on public.ops_mission_steps(status, step_order) where status = 'queued';

-- ============================================================
-- 6. AGENT EVENTS (activity stream)
-- ============================================================
create table public.ops_agent_events (
  id            uuid primary key default gen_random_uuid(),
  agent_slug    text references public.ops_agents(slug),
  event_type    text not null,                 -- proposal:created | mission:started | step:completed | tweet:posted | trigger:fired | reaction:queued | error | system
  tags          text[] not null default '{}',
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index idx_events_type on public.ops_agent_events(event_type);
create index idx_events_agent on public.ops_agent_events(agent_slug);
create index idx_events_created on public.ops_agent_events(created_at desc);
create index idx_events_tags on public.ops_agent_events using gin(tags);

-- ============================================================
-- 7. TRIGGER RULES
-- ============================================================
create table public.ops_trigger_rules (
  id            serial primary key,
  name          text not null unique,
  description   text,
  enabled       boolean not null default true,
  condition     jsonb not null,                -- e.g. {"event_type": "tweet:posted", "metric": "engagement_rate", "threshold": 0.05}
  action        jsonb not null,                -- proposal template to create
  cooldown_min  int not null default 120,      -- minutes between firings
  last_fired_at timestamptz,
  fire_count    int not null default 0,
  created_at    timestamptz not null default now()
);

-- Seed default trigger rules
insert into public.ops_trigger_rules (name, description, condition, action, cooldown_min) values
  ('viral_tweet_analysis',
   'When tweet engagement > 5%, analyze why it went viral',
   '{"event_type": "tweet:metrics", "field": "engagement_rate", "operator": "gt", "value": 0.05}',
   '{"agent_slug": "role-3", "title": "Analyze viral tweet performance", "step_kinds": ["analyze"], "priority": 3}',
   120),
  ('mission_failure_diagnosis',
   'When a mission fails, diagnose root cause',
   '{"event_type": "mission:failed"}',
   '{"agent_slug": "role-2", "title": "Diagnose mission failure", "step_kinds": ["diagnose"], "priority": 2}',
   60),
  ('content_quality_review',
   'When new content is published, review quality',
   '{"event_type": "content:published"}',
   '{"agent_slug": "role-6", "title": "Review published content quality", "step_kinds": ["review"], "priority": 5}',
   120),
  ('insight_auto_promote',
   'When insight gets multiple upvotes, promote to permanent memory',
   '{"event_type": "insight:upvoted", "field": "upvote_count", "operator": "gte", "value": 3}',
   '{"agent_slug": "role-2", "title": "Promote insight to permanent memory", "step_kinds": ["analyze"], "priority": 4}',
   240);

-- ============================================================
-- 8. AGENT REACTIONS (queue)
-- ============================================================
create table public.ops_agent_reactions (
  id            uuid primary key default gen_random_uuid(),
  source_event_id uuid references public.ops_agent_events(id),
  source_agent  text references public.ops_agents(slug),
  target_agent  text not null references public.ops_agents(slug),
  reaction_type text not null,                 -- analyze | diagnose | review | respond
  status        text not null default 'pending', -- pending | processing | completed | skipped
  input         jsonb not null default '{}',
  output        jsonb,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

create index idx_reactions_status on public.ops_agent_reactions(status);
create index idx_reactions_target on public.ops_agent_reactions(target_agent);

-- ============================================================
-- 9. ACTION RUNS (execution logs)
-- ============================================================
create table public.ops_action_runs (
  id            uuid primary key default gen_random_uuid(),
  step_id       uuid references public.ops_mission_steps(id),
  agent_slug    text references public.ops_agents(slug),
  action_type   text not null,
  status        text not null default 'running', -- running | succeeded | failed
  input         jsonb not null default '{}',
  output        jsonb,
  error         text,
  duration_ms   int,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index idx_action_runs_step on public.ops_action_runs(step_id);
create index idx_action_runs_status on public.ops_action_runs(status);

-- ============================================================
-- 10. AGENT MEMORIES (long-term knowledge store)
-- ============================================================
create table public.ops_agent_memories (
  id            uuid primary key default gen_random_uuid(),
  agent_slug    text not null references public.ops_agents(slug),
  category      text not null default 'general', -- general | insight | learning | strategy
  content       text not null,
  importance    int not null default 5,          -- 1-10
  source_event_id uuid references public.ops_agent_events(id),
  promoted      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_memories_agent on public.ops_agent_memories(agent_slug);
create index idx_memories_promoted on public.ops_agent_memories(promoted) where promoted = true;

-- ============================================================
-- 11. TWEET DRAFTS (content pipeline)
-- ============================================================
create table public.ops_tweet_drafts (
  id            uuid primary key default gen_random_uuid(),
  agent_slug    text not null references public.ops_agents(slug),
  mission_id    uuid references public.ops_missions(id),
  content       text not null,
  status        text not null default 'draft',   -- draft | approved | posted | rejected
  platform      text not null default 'x',
  posted_at     timestamptz,
  external_id   text,                            -- tweet ID from X API
  metrics       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index idx_tweets_status on public.ops_tweet_drafts(status);
create index idx_tweets_posted on public.ops_tweet_drafts(posted_at desc) where status = 'posted';

-- ============================================================
-- Updated_at trigger function
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_agents_updated_at
  before update on public.ops_agents
  for each row execute function public.update_updated_at();

create trigger trg_policy_updated_at
  before update on public.ops_policy
  for each row execute function public.update_updated_at();

-- ============================================================
-- RLS Policies (service role bypasses, anon gets read-only on select tables)
-- ============================================================
alter table public.ops_agents enable row level security;
alter table public.ops_policy enable row level security;
alter table public.ops_mission_proposals enable row level security;
alter table public.ops_missions enable row level security;
alter table public.ops_mission_steps enable row level security;
alter table public.ops_agent_events enable row level security;
alter table public.ops_trigger_rules enable row level security;
alter table public.ops_agent_reactions enable row level security;
alter table public.ops_action_runs enable row level security;
alter table public.ops_agent_memories enable row level security;
alter table public.ops_tweet_drafts enable row level security;

-- Anon read access for public-facing data
create policy "anon_read_agents" on public.ops_agents for select to anon using (true);
create policy "anon_read_events" on public.ops_agent_events for select to anon using (true);
create policy "anon_read_missions" on public.ops_missions for select to anon using (true);
create policy "anon_read_proposals" on public.ops_mission_proposals for select to anon using (true);
create policy "anon_read_steps" on public.ops_mission_steps for select to anon using (true);

-- Service role full access (for backend operations)
create policy "service_all_agents" on public.ops_agents for all to service_role using (true) with check (true);
create policy "service_all_policy" on public.ops_policy for all to service_role using (true) with check (true);
create policy "service_all_proposals" on public.ops_mission_proposals for all to service_role using (true) with check (true);
create policy "service_all_missions" on public.ops_missions for all to service_role using (true) with check (true);
create policy "service_all_steps" on public.ops_mission_steps for all to service_role using (true) with check (true);
create policy "service_all_events" on public.ops_agent_events for all to service_role using (true) with check (true);
create policy "service_all_triggers" on public.ops_trigger_rules for all to service_role using (true) with check (true);
create policy "service_all_reactions" on public.ops_agent_reactions for all to service_role using (true) with check (true);
create policy "service_all_action_runs" on public.ops_action_runs for all to service_role using (true) with check (true);
create policy "service_all_memories" on public.ops_agent_memories for all to service_role using (true) with check (true);
create policy "service_all_tweets" on public.ops_tweet_drafts for all to service_role using (true) with check (true);
