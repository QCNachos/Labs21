// ============================================================
// Core types for the AiCorp autonomous agent system
// ============================================================

export type AgentStatus = "idle" | "working" | "thinking" | "offline";
export type ProposalStatus = "pending" | "accepted" | "rejected";
export type MissionStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type StepStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";
export type ProposalSource = "api" | "trigger" | "reaction";
export type ReactionStatus = "pending" | "processing" | "completed" | "skipped";
export type TweetStatus = "draft" | "approved" | "posted" | "rejected";

export type AgentDepartment = "executive" | "engineering" | "growth" | "content" | "finance" | "operations";
export type BriefingPriority = "low" | "normal" | "high" | "urgent";
export type InstructionStatus = "pending" | "acknowledged" | "in_progress" | "completed" | "cancelled";
export type ProjectStage = "idea" | "mvp" | "beta" | "launched" | "scaling";

export interface Agent {
  id: number;
  slug: string;
  name: string;
  title: string | null;
  department: AgentDepartment | null;
  reports_to: string | null;
  can_approve: boolean;
  role_desc: string | null;
  system_prompt: string | null;
  schedule: Record<string, string>;
  avatar_url: string | null;
  status: AgentStatus;
  last_active: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  stage: ProjectStage;
  category: string;
  github_repos: string[];
  website_url: string | null;
  tech_stack: string[];
  goals: Record<string, unknown>[];
  financials: Record<string, unknown>;
  team_notes: string | null;
  pitch_url: string | null;
  status: "active" | "paused" | "archived";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Briefing {
  id: string;
  agent_slug: string;
  briefing_type: "daily" | "weekly" | "alert" | "escalation";
  title: string;
  content: string;
  priority: BriefingPriority;
  read: boolean;
  projects: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined
  agent?: Agent;
}

export interface Instruction {
  id: string;
  target_agent: string;
  instruction: string;
  priority: BriefingPriority;
  status: InstructionStatus;
  response: string | null;
  project_slug: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Policy {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
}

export interface MissionProposal {
  id: string;
  agent_slug: string;
  title: string;
  description: string | null;
  source: ProposalSource;
  status: ProposalStatus;
  reject_reason: string | null;
  priority: number;
  step_kinds: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  decided_at: string | null;
}

export interface Mission {
  id: string;
  proposal_id: string | null;
  agent_slug: string;
  title: string;
  description: string | null;
  status: MissionStatus;
  priority: number;
  result: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  // Joined
  steps?: MissionStep[];
  agent?: Agent;
}

export interface MissionStep {
  id: string;
  mission_id: string;
  agent_slug: string;
  step_kind: string;
  step_order: number;
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  last_error: string | null;
  claimed_by: string | null;
  reserved_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AgentEvent {
  id: string;
  agent_slug: string | null;
  event_type: string;
  tags: string[];
  payload: Record<string, unknown>;
  created_at: string;
  // Joined
  agent?: Agent;
}

export interface TriggerRule {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  cooldown_min: number;
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
}

export interface AgentReaction {
  id: string;
  source_event_id: string | null;
  source_agent: string | null;
  target_agent: string;
  reaction_type: string;
  status: ReactionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  created_at: string;
  processed_at: string | null;
}

export interface ActionRun {
  id: string;
  step_id: string | null;
  agent_slug: string | null;
  action_type: string;
  status: "running" | "succeeded" | "failed";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface AgentMemory {
  id: string;
  agent_slug: string;
  category: string;
  content: string;
  importance: number;
  source_event_id: string | null;
  promoted: boolean;
  created_at: string;
}

// Service input/output types

export interface ProposalServiceInput {
  agent_slug: string;
  title: string;
  description?: string;
  source: ProposalSource;
  priority?: number;
  step_kinds: string[];
  metadata?: Record<string, unknown>;
}

export interface ProposalServiceResult {
  success: boolean;
  proposal_id?: string;
  mission_id?: string;
  auto_approved?: boolean;
  reject_reason?: string;
}

export interface StepKindGateResult {
  ok: boolean;
  reason?: string;
}

export interface HeartbeatResult {
  triggers: { evaluated: number; fired: number };
  reactions: { processed: number; created: number };
  insights: { promoted: number };
  stale: { recovered: number };
  timestamp: string;
}

export interface ReactionPattern {
  source: string;
  tags: string[];
  target: string;
  type: string;
  probability: number;
  cooldown: number;
}
