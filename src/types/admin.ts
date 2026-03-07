// ============================================================
// Labs21 Admin Portal Types
// ============================================================

export type AgentStatus = "idle" | "working" | "thinking" | "offline";
export type ProposalStatus = "pending" | "accepted" | "rejected";
export type MissionStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type StepStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";
export type BriefingPriority = "low" | "normal" | "high" | "urgent";
export type InstructionStatus = "pending" | "acknowledged" | "in_progress" | "completed" | "cancelled";
export type ProjectStage = "idea" | "mvp" | "beta" | "launched" | "scaling";
export type ProjectStatus = "active" | "paused" | "archived";

export type ProjectSector =
  | "trading"
  | "platforms"
  | "marketing"
  | "art"
  | "others";

export const SECTOR_LABELS: Record<ProjectSector, string> = {
  trading: "Trading",
  platforms: "Platforms",
  marketing: "Marketing",
  art: "Art",
  others: "Others",
};

export const TRADING_SUBSECTORS = ["Onchain", "Perps", "Launches", "Others"];
export const PLATFORM_SUBSECTORS = ["Rewynd", "Tindai", "LHL", "Youmaxing"];
export const SUBSECTORS_BY_SECTOR: Record<ProjectSector, string[]> = {
  trading: TRADING_SUBSECTORS,
  platforms: PLATFORM_SUBSECTORS,
  marketing: ["Social", "Content", "SEO", "Ads", "Others"],
  art: ["Digital", "NFT", "Physical", "Generative", "Others"],
  others: ["Others"],
};

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  tier: "smart" | "fast" | "private" | "free";
  ctx: number;
  ctx_label: string;
  cost: string;
  env: string;
  env_label: string;
  description: string;
  available: boolean;
  unavailable_reason: string | null;
}

export interface Agent {
  id: number;
  slug: string;
  name: string;
  title: string | null;
  department: string | null;
  reports_to: string | null;
  can_approve: boolean;
  role_desc: string | null;
  system_prompt: string | null;
  schedule: Record<string, string>;
  avatar_url: string | null;
  status: AgentStatus;
  last_active: string | null;
  config: Record<string, unknown>;
  model_override?: string;  // surfaced from config.model_override by API
  // Enhanced fields
  model_provider: string | null;
  model_name: string | null;
  model_subscription: string | null;
  compute_provider: string | null;
  compute_details: {
    instance_type?: string;
    region?: string;
    ip?: string;
    monthly_cost_usd?: number;
  } | null;
  wallet_address: string | null;
  wallet_chain: string | null;
  daily_cost_usd: number | null;
  created_at: string;
  updated_at: string;
  // Computed
  stats?: {
    completed_missions: number;
    active_missions: number;
    events_24h: number;
  };
}

export interface ProjectLinks {
  website?: string;
  github?: string;
  drive_folder?: string;
  docs?: string;
  pitch?: string;
  [key: string]: string | undefined;
}

export type NoteTag = "note" | "task" | "prompt";

export interface ProjectNote {
  id: string;
  text: string;
  tag: NoteTag;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  stage: ProjectStage;
  sector: ProjectSector;
  sub_sector: string | null;
  category: string;
  github_repos: string[];
  website_url: string | null;
  tech_stack: string[];
  goals: Record<string, unknown>[];
  financials: {
    runway_months?: number;
    mrr?: number;
    burn_rate?: number;
  };
  team_notes: string | null;
  pitch_url: string | null;
  links: ProjectLinks;
  is_active: boolean;
  priority: number;
  status: ProjectStatus;
  metadata: Record<string, unknown>;
  notes: ProjectNote[];
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  drive_folder_url: string | null;
  icon: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Briefing {
  id: string;
  agent_slug: string;
  briefing_type: "daily" | "weekly" | "alert" | "escalation" | "monthly";
  title: string;
  content: string;
  priority: BriefingPriority;
  read: boolean;
  projects: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  agent?: { slug: string; name: string; title: string | null };
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

export interface BoardMeeting {
  id: string;
  date: string;
  title: string;
  summary: string;
  decisions: { item: string; owner: string }[];
  action_items: { task: string; owner: string; due?: string }[];
  created_by: string;
  created_at: string;
}

export interface DailyReport {
  id: string;
  agent_slug: string;
  date: string;
  report_type: "daily" | "weekly" | "monthly";
  content: string;
  questions: { q: string; answered?: boolean }[];
  status: "draft" | "sent";
  email_sent_at: string | null;
  created_at: string;
}

export interface MissionProposal {
  id: string;
  agent_slug: string;
  title: string;
  description: string | null;
  source: "api" | "trigger" | "reaction";
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
  agent?: Agent;
}
