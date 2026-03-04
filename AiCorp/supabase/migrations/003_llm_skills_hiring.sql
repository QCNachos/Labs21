-- ============================================================
-- Migration 003: LLM Model Config + Agent Skills + Hiring System
-- ============================================================

-- ============================================================
-- 1. AGENT SKILLS (knowledge/capabilities loaded into prompts)
-- ============================================================
create table public.ops_agent_skills (
  id            serial primary key,
  slug          text unique not null,                -- e.g. 'supabase-postgres', 'pitch-deck-framework'
  name          text not null,
  description   text,
  content       text not null,                       -- the skill prompt/knowledge (loaded into agent context)
  category      text not null default 'general',     -- coding | strategy | content | finance | research | general
  source        text not null default 'custom',      -- custom | skills.sh | github
  source_url    text,                                -- original URL if imported
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Link skills to agents (many-to-many)
create table public.ops_agent_skill_assignments (
  agent_slug    text not null references public.ops_agents(slug) on delete cascade,
  skill_id      int not null references public.ops_agent_skills(id) on delete cascade,
  priority      int not null default 5,              -- 1=always load, 10=load if relevant
  primary key (agent_slug, skill_id)
);

create index idx_skill_assignments_agent on public.ops_agent_skill_assignments(agent_slug);

alter table public.ops_agent_skills enable row level security;
alter table public.ops_agent_skill_assignments enable row level security;
create policy "anon_read_skills" on public.ops_agent_skills for select to anon using (true);
create policy "service_all_skills" on public.ops_agent_skills for all to service_role using (true) with check (true);
create policy "anon_read_skill_assign" on public.ops_agent_skill_assignments for select to anon using (true);
create policy "service_all_skill_assign" on public.ops_agent_skill_assignments for all to service_role using (true) with check (true);

create trigger trg_skills_updated_at
  before update on public.ops_agent_skills
  for each row execute function public.update_updated_at();

-- ============================================================
-- 2. SEED BUILT-IN SKILLS
-- ============================================================
insert into public.ops_agent_skills (slug, name, description, content, category, source) values

('supabase-best-practices', 'Supabase & Postgres Best Practices', 'Database design, RLS policies, query optimization for Supabase/Postgres',
'## Supabase & Postgres Best Practices

### Schema Design
- Use UUIDs for primary keys (gen_random_uuid())
- Always add created_at/updated_at timestamps
- Use JSONB for flexible data, but index commonly queried fields
- Normalize data properly, denormalize only for proven performance needs

### Row Level Security
- ALWAYS enable RLS on every table
- Use service_role for backend operations, anon for client reads
- Policy pattern: create policy "name" on table for select/insert/update/delete to role using (condition)
- Test RLS policies: SET ROLE anon; SELECT * FROM table;

### Performance
- Add indexes on foreign keys and commonly filtered columns
- Use partial indexes (WHERE clause) for status fields
- Use .select("id", { count: "exact", head: true }) for counts
- Avoid SELECT * in production queries
- Use connection pooling (Supavisor) for serverless', 'coding', 'custom'),

('nextjs-patterns', 'Next.js App Router Patterns', 'Server components, API routes, data fetching for Next.js 15+',
'## Next.js App Router Patterns

### API Routes
- Use route.ts with exported GET/POST/PUT/DELETE functions
- Validate input early, return proper HTTP status codes
- Use createServiceClient() for server-side Supabase access
- Implement proper error handling with try/catch

### Data Fetching
- Server Components fetch data directly (no useEffect)
- Client Components use fetch() + useState/useEffect
- Implement polling for real-time data (setInterval + fetch)
- Use Supabase Realtime for truly live updates

### Performance
- Use dynamic imports for heavy components
- Implement proper loading states
- Cache API responses where appropriate', 'coding', 'custom'),

('pitch-deck-framework', 'Pitch Deck Framework', 'Structured framework for creating investor pitch decks',
'## Pitch Deck Framework (10-15 slides)

### Slide Structure
1. **Cover**: Company name, one-line description, logo
2. **Problem**: Pain point with data/stories (make it visceral)
3. **Solution**: Your product, 1-2 screenshots/demo
4. **Market**: TAM > SAM > SOM with sources
5. **Business Model**: How you make money, pricing, unit economics
6. **Traction**: Metrics, growth rate, key milestones (hockey stick if possible)
7. **Competition**: 2x2 matrix (not a feature table), explain your moat
8. **Team**: Relevant experience, why YOU can build this
9. **Financials**: 3-year projection, key assumptions
10. **The Ask**: Amount, use of funds, timeline to next milestone

### Key Principles
- Each slide = one idea, max 30 words text
- Lead with the strongest metric you have
- Address the "why now" question
- Show you understand the risks
- End with a clear, specific ask', 'strategy', 'custom'),

('investor-research', 'Investor Research Methodology', 'Systematic approach to finding and qualifying investors',
'## Investor Research Methodology

### Qualification Criteria
- Stage match: Pre-seed ($100K-$500K), Seed ($500K-$3M), Series A ($3M-$15M)
- Sector focus: Must have invested in similar companies
- Geography: Check if they invest in your region
- Check size: Align with your fundraising target
- Portfolio conflicts: No direct competitors

### Research Sources
- Crunchbase: Recent investments, fund size, partners
- LinkedIn: Partner backgrounds, mutual connections
- Twitter/X: Investment thesis posts, what they share
- Blog posts: Published investment criteria
- AngelList: Active deal flow signals

### Signal Scoring
- Recently raised new fund = HIGH (deploying capital)
- Invested in adjacent space = HIGH (understands market)
- Publicly stated thesis match = MEDIUM
- Generic VC with no clear focus = LOW

### Outreach Best Practices
- Warm intro > cold email (3x response rate)
- Reference their portfolio company by name
- Lead with your strongest metric
- Keep email under 150 words
- Follow up at day 3, day 7, day 14', 'research', 'custom'),

('content-strategy', 'Content & Social Media Strategy', 'Frameworks for creating engaging content across platforms',
'## Content & Social Media Strategy

### Platform Guidelines
**Twitter/X**: Max 280 chars. Hook in first line. Thread for long-form (1/ format). No hashtag spam (max 2). Best times: 8-10am, 12-1pm, 5-6pm EST.
**LinkedIn**: Professional tone, 1300 char sweet spot. Use line breaks. Tag relevant people. Best for B2B content.
**Blog**: 800-1500 words. SEO-aware titles. Clear H2/H3 structure. Include 1 actionable takeaway.

### Content Pillars
1. **Build in public**: Share progress, metrics, learnings
2. **Thought leadership**: Industry insights, contrarian takes
3. **Product updates**: Features, milestones, changelog
4. **Community**: Reply, engage, amplify others

### Writing Rules
- Write like you talk (conversational > formal)
- One idea per post
- Specific > generic ("grew 40% MoM" > "growing fast")
- End with a question or CTA when appropriate
- Never use AI-obvious phrases ("In today''s rapidly evolving landscape...")', 'content', 'custom'),

('financial-modeling', 'Financial Modeling for Startups', 'Burn rate, runway, unit economics, projections',
'## Startup Financial Modeling

### Key Metrics
- **Runway**: Cash / Monthly Burn Rate = months until $0
- **Burn Rate**: Total monthly expenses (include payroll, hosting, tools, etc.)
- **MRR**: Monthly Recurring Revenue (only count contracted recurring)
- **ARR**: MRR * 12
- **CAC**: Total acquisition cost / New customers
- **LTV**: Average revenue per customer * Average lifespan
- **LTV:CAC ratio**: Target > 3:1

### Red Flags to Watch
- Runway < 6 months without active fundraise
- Burn increasing faster than revenue
- CAC > LTV
- Revenue growth < 10% MoM for early stage

### Projection Framework
- Bottom-up: start from unit economics, grow users
- Top-down: only for TAM/SAM/SOM, never for revenue projections
- Always state key assumptions explicitly
- Show 3 scenarios: conservative, base, optimistic
- Investors will believe your conservative case', 'finance', 'custom'),

('code-review-practices', 'Code Review Best Practices', 'How to review code for quality, security, and maintainability',
'## Code Review Checklist

### Security
- [ ] No hardcoded secrets/API keys
- [ ] Input validation on all user data
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized output)
- [ ] Authentication/authorization checks
- [ ] Rate limiting on public endpoints

### Quality
- [ ] Functions are single-responsibility
- [ ] Error handling is comprehensive
- [ ] No obvious performance issues (N+1 queries, missing indexes)
- [ ] Types are correct (TypeScript/Python type hints)
- [ ] No dead code or commented-out blocks

### Architecture
- [ ] Follows existing patterns in the codebase
- [ ] Dependencies are justified
- [ ] API contracts are backward-compatible
- [ ] Database migrations are reversible', 'coding', 'custom');

-- Assign skills to agents
insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'cto', id, 1 from public.ops_agent_skills where slug in ('supabase-best-practices', 'nextjs-patterns', 'code-review-practices');

insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'strategist', id, 1 from public.ops_agent_skills where slug in ('pitch-deck-framework', 'investor-research', 'content-strategy');

insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'content', id, 1 from public.ops_agent_skills where slug in ('content-strategy');

insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'scout', id, 1 from public.ops_agent_skills where slug in ('investor-research');

insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'pitch', id, 1 from public.ops_agent_skills where slug in ('pitch-deck-framework', 'investor-research');

insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'cfo', id, 1 from public.ops_agent_skills where slug in ('financial-modeling', 'investor-research');

insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'ceo', id, 2 from public.ops_agent_skills where slug in ('pitch-deck-framework', 'financial-modeling', 'content-strategy');

insert into public.ops_agent_skill_assignments (agent_slug, skill_id, priority)
select 'observer', id, 1 from public.ops_agent_skills where slug in ('code-review-practices', 'content-strategy');

-- ============================================================
-- 3. HIRING PROPOSALS (CEO proposes new agents to Board)
-- ============================================================
create table public.ops_hiring_proposals (
  id            uuid primary key default gen_random_uuid(),
  proposed_by   text not null references public.ops_agents(slug),
  proposed_slug text not null,
  proposed_name text not null,
  proposed_title text not null,
  department    text not null,
  reports_to    text not null references public.ops_agents(slug),
  justification text not null,                       -- why this role is needed
  role_desc     text not null,
  system_prompt text,
  model_tier    text not null default 'fast',         -- smart | fast | free
  estimated_cost text,                               -- estimated monthly LLM cost
  status        text not null default 'proposed',    -- proposed | approved | rejected | hired | terminated
  board_notes   text,                                -- Board Director's notes
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.ops_hiring_proposals enable row level security;
create policy "anon_read_hiring" on public.ops_hiring_proposals for select to anon using (true);
create policy "service_all_hiring" on public.ops_hiring_proposals for all to service_role using (true) with check (true);

-- ============================================================
-- 4. UPDATE AGENT CONFIG for model tiers
-- ============================================================

-- CEO and CFO get the smart model (they make important decisions)
update public.ops_agents
set config = jsonb_set(coalesce(config, '{}'), '{model_tier}', '"smart"')
where slug in ('ceo', 'cfo');

-- CTO and Observer get smart (code review needs accuracy)
update public.ops_agents
set config = jsonb_set(coalesce(config, '{}'), '{model_tier}', '"smart"')
where slug in ('cto', 'observer');

-- Strategist and Pitch Builder get smart (analysis quality matters)
update public.ops_agents
set config = jsonb_set(coalesce(config, '{}'), '{model_tier}', '"smart"')
where slug in ('strategist', 'pitch');

-- Content and Scout can use fast (volume tasks)
update public.ops_agents
set config = jsonb_set(coalesce(config, '{}'), '{model_tier}', '"fast"')
where slug in ('content', 'scout');

-- Add hiring trigger rule
insert into public.ops_trigger_rules (name, description, condition, action, cooldown_min) values
  ('ceo_org_review',
   'CEO periodically reviews org structure and may propose new hires',
   '{"event_type": "schedule:ceo:weekly_review"}',
   '{"agent_slug": "ceo", "title": "Weekly org structure review", "step_kinds": ["analyze"], "priority": 4}',
   10080);
