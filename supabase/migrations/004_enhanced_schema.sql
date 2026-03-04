-- ============================================================
-- Labs21 Enhanced Schema
-- Run this migration on your Supabase project
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- AGENTS
-- ============================================================
create table if not exists ops_agents (
  id              serial primary key,
  slug            text unique not null,
  name            text not null,
  title           text,
  department      text,
  reports_to      text references ops_agents(slug),
  can_approve     boolean not null default false,
  role_desc       text,
  system_prompt   text,
  schedule        jsonb not null default '{}',
  avatar_url      text,
  status          text not null default 'idle' check (status in ('idle','working','thinking','offline')),
  last_active     timestamptz,
  config          jsonb not null default '{}',
  -- Enhanced fields
  model_provider      text,
  model_name          text,
  model_subscription  text,
  compute_provider    text,
  compute_details     jsonb,
  wallet_address      text,
  wallet_chain        text,
  daily_cost_usd      numeric(10,4),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
create table if not exists ops_departments (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  drive_folder_url text,
  icon            text,
  order_index     integer not null default 99,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists ops_projects (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text unique not null,
  description     text,
  stage           text not null default 'idea' check (stage in ('idea','mvp','beta','launched','scaling')),
  sector          text not null default 'others' check (sector in ('trading','platforms','marketing','art','others')),
  sub_sector      text,
  category        text not null default 'other',
  github_repos    text[] not null default '{}',
  website_url     text,
  tech_stack      text[] not null default '{}',
  goals           jsonb not null default '[]',
  financials      jsonb not null default '{}',
  team_notes      text,
  pitch_url       text,
  links           jsonb not null default '{}',
  is_active       boolean not null default true,
  priority        integer not null default 3 check (priority between 1 and 5),
  status          text not null default 'active' check (status in ('active','paused','archived')),
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- EVENTS
-- ============================================================
create table if not exists ops_agent_events (
  id          uuid primary key default uuid_generate_v4(),
  agent_slug  text references ops_agents(slug) on delete set null,
  event_type  text not null,
  tags        text[] not null default '{}',
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists idx_events_agent_slug on ops_agent_events(agent_slug);
create index if not exists idx_events_created_at on ops_agent_events(created_at desc);
create index if not exists idx_events_type on ops_agent_events(event_type);

-- ============================================================
-- MISSION PROPOSALS
-- ============================================================
create table if not exists ops_mission_proposals (
  id            uuid primary key default uuid_generate_v4(),
  agent_slug    text not null references ops_agents(slug),
  title         text not null,
  description   text,
  source        text not null default 'api' check (source in ('api','trigger','reaction')),
  status        text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reject_reason text,
  priority      integer not null default 5 check (priority between 1 and 10),
  step_kinds    text[] not null default '{}',
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

-- ============================================================
-- MISSIONS
-- ============================================================
create table if not exists ops_missions (
  id            uuid primary key default uuid_generate_v4(),
  proposal_id   uuid references ops_mission_proposals(id) on delete set null,
  agent_slug    text not null references ops_agents(slug),
  title         text not null,
  description   text,
  status        text not null default 'pending' check (status in ('pending','running','succeeded','failed','cancelled')),
  priority      integer not null default 5,
  result        jsonb,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_missions_agent_slug on ops_missions(agent_slug);
create index if not exists idx_missions_status on ops_missions(status);

-- ============================================================
-- MISSION STEPS
-- ============================================================
create table if not exists ops_mission_steps (
  id            uuid primary key default uuid_generate_v4(),
  mission_id    uuid not null references ops_missions(id) on delete cascade,
  agent_slug    text not null references ops_agents(slug),
  step_kind     text not null,
  step_order    integer not null default 0,
  status        text not null default 'queued' check (status in ('queued','running','succeeded','failed','skipped')),
  input         jsonb not null default '{}',
  output        jsonb,
  last_error    text,
  claimed_by    text,
  reserved_at   timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_steps_mission_id on ops_mission_steps(mission_id);
create index if not exists idx_steps_status on ops_mission_steps(status);

-- ============================================================
-- BRIEFINGS (CEO daily/weekly reports to Board Director)
-- ============================================================
create table if not exists ops_briefings (
  id              uuid primary key default uuid_generate_v4(),
  agent_slug      text not null references ops_agents(slug),
  briefing_type   text not null default 'daily' check (briefing_type in ('daily','weekly','monthly','alert','escalation')),
  title           text not null,
  content         text not null,
  priority        text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  read            boolean not null default false,
  projects        text[] not null default '{}',
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists idx_briefings_read on ops_briefings(read);
create index if not exists idx_briefings_created_at on ops_briefings(created_at desc);

-- ============================================================
-- INSTRUCTIONS (Board Director → Agents)
-- ============================================================
create table if not exists ops_instructions (
  id              uuid primary key default uuid_generate_v4(),
  target_agent    text not null references ops_agents(slug),
  instruction     text not null,
  priority        text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status          text not null default 'pending' check (status in ('pending','acknowledged','in_progress','completed','cancelled')),
  response        text,
  project_slug    text references ops_projects(slug) on delete set null,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

-- ============================================================
-- BOARD MEETINGS
-- ============================================================
create table if not exists ops_board_meetings (
  id              uuid primary key default uuid_generate_v4(),
  date            date not null,
  title           text not null,
  summary         text not null default '',
  decisions       jsonb not null default '[]',
  action_items    jsonb not null default '[]',
  created_by      text not null default 'board_director',
  created_at      timestamptz not null default now()
);

-- ============================================================
-- DAILY REPORTS (CEO to Board Director email)
-- ============================================================
create table if not exists ops_daily_reports (
  id              uuid primary key default uuid_generate_v4(),
  agent_slug      text not null references ops_agents(slug),
  date            date not null,
  report_type     text not null default 'daily' check (report_type in ('daily','weekly','monthly')),
  content         text not null,
  questions       jsonb not null default '[]',
  status          text not null default 'draft' check (status in ('draft','sent')),
  email_sent_at   timestamptz,
  created_at      timestamptz not null default now(),
  unique(agent_slug, date, report_type)
);

-- ============================================================
-- TRIGGER RULES
-- ============================================================
create table if not exists ops_trigger_rules (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  enabled         boolean not null default true,
  condition       jsonb not null default '{}',
  action          jsonb not null default '{}',
  cooldown_min    integer not null default 60,
  last_fired_at   timestamptz,
  fire_count      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- AGENT REACTIONS
-- ============================================================
create table if not exists ops_agent_reactions (
  id              uuid primary key default uuid_generate_v4(),
  trigger_event   text not null,
  source_agent    text references ops_agents(slug),
  target_agent    text not null references ops_agents(slug),
  reaction_type   text not null,
  status          text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ============================================================
-- POLICY
-- ============================================================
create table if not exists ops_policy (
  id      serial primary key,
  key     text unique not null,
  value   jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Default policy: auto-approve disabled
insert into ops_policy (key, value) values
  ('auto_approve', '{"enabled": false, "allowed_step_kinds": []}')
on conflict (key) do nothing;

-- ============================================================
-- SEED DATA: Default departments
-- ============================================================
insert into ops_departments (name, description, icon, order_index) values
  ('Executive',    'CEO, CFO and senior leadership',       '🎯', 10),
  ('Engineering',  'Technical development and R&D',        '⚙️', 20),
  ('Growth',       'Marketing, sales and user acquisition','📈', 30),
  ('Content',      'Content strategy and creation',        '✍️', 40),
  ('Finance',      'Financial management and reporting',   '💰', 50),
  ('Operations',   'Day-to-day operations management',     '🔧', 60),
  ('Legal',        'Legal and compliance',                 '⚖️', 70)
on conflict do nothing;

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tg_agents_updated_at     before update on ops_agents     for each row execute procedure set_updated_at();
create trigger tg_departments_updated_at before update on ops_departments for each row execute procedure set_updated_at();
create trigger tg_projects_updated_at   before update on ops_projects   for each row execute procedure set_updated_at();
