"use client";

import { useState } from "react";
import { Agent, Project, MissionProposal } from "@/types/admin";
import { useApi } from "@/hooks/useApi";
import { apiPost } from "@/lib/api";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import {
  Send,
  Zap,
  Bot,
  ChevronRight,
  CheckCircle,
  XCircle,
  FileText,
  Shield,
  BarChart3,
  Newspaper,
} from "lucide-react";

const STEP_KINDS = [
  "analyze",
  "write_content",
  "draft_tweet",
  "crawl",
  "diagnose",
  "review",
  "deploy",
  "generate_briefing",
  "financial_analysis",
  "scan_repos",
  "research_investors",
  "update_deck",
  "propose_hire",
  "send_daily_report",
] as const;

const QUICK_ACTIONS = [
  {
    label: "Generate daily briefing",
    icon: Newspaper,
    request: "Generate a comprehensive daily briefing summarizing all agent activity, key metrics, and items requiring attention.",
    stepKinds: ["generate_briefing"],
    priority: 2,
  },
  {
    label: "Run security scan",
    icon: Shield,
    request: "Run a full security scan across all active project repositories. Flag vulnerabilities, outdated dependencies, and exposed secrets.",
    stepKinds: ["scan_repos", "diagnose"],
    priority: 1,
  },
  {
    label: "Draft weekly recap",
    icon: FileText,
    request: "Draft a weekly recap email summarizing completed missions, key deliverables, blockers, and priorities for next week.",
    stepKinds: ["analyze", "write_content"],
    priority: 3,
  },
  {
    label: "Financial overview",
    icon: BarChart3,
    request: "Produce a financial overview of all active projects including burn rate, runway, MRR trends, and cost optimization recommendations.",
    stepKinds: ["financial_analysis", "analyze"],
    priority: 2,
  },
];

export default function RequestPage() {
  const { data: agents = [], loading: loadingAgents } = useApi<Agent[]>("/agents");
  const { data: projects = [], loading: loadingProjects } = useApi<Project[]>("/projects");
  const { data: proposals = [], loading: loadingProposals, reload: reloadProposals } = useApi<MissionProposal[]>("/proposals?limit=20");
  const loading = loadingAgents || loadingProjects || loadingProposals;

  const [request, setRequest] = useState("");
  const [agentSlug, setAgentSlug] = useState("auto");
  const [priority, setPriority] = useState(3);
  const [projectSlug, setProjectSlug] = useState("");
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const toggleStep = (step: string) => {
    setSelectedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  const applyQuickAction = (action: (typeof QUICK_ACTIONS)[number]) => {
    setRequest(action.request);
    setSelectedSteps(action.stepKinds);
    setPriority(action.priority);
  };

  const submit = async () => {
    if (!request.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = {
        title: request.slice(0, 120),
        description: request,
        agent_slug: agentSlug === "auto" ? agents[0]?.slug ?? "ceo" : agentSlug,
        priority,
        step_kinds: selectedSteps.length > 0 ? selectedSteps : ["analyze"],
        source: "api",
        project_slug: projectSlug || null,
      };
      await apiPost("/proposals", body);
      setFeedback({ type: "success", message: "Request submitted — proposal created successfully." });
      setRequest("");
      setSelectedSteps([]);
      setPriority(3);
      setProjectSlug("");
      setAgentSlug("auto");
      reloadProposals();
    } catch (e: unknown) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Failed to submit request" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-surface-50">Request Work</h1>
        <p className="text-sm text-surface-400 mt-1">
          Submit work requests that get converted into mission proposals for AI agents
        </p>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => applyQuickAction(action)}
              className="flex items-center gap-2.5 bg-surface-800 border border-surface-700 hover:border-accent/40 rounded-xl px-3.5 py-3 text-left transition-colors group"
            >
              <action.icon className="w-4 h-4 text-surface-500 group-hover:text-accent-light shrink-0" />
              <span className="text-xs text-surface-300 group-hover:text-surface-100">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Compose Request */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-surface-200">New Request</h2>
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1.5">What do you need done? *</label>
          <textarea
            rows={4}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="e.g. Draft a proposal for client X, Summarize this week's progress, Research competitors for project Y…"
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-100 resize-none focus:outline-none focus:border-accent placeholder:text-surface-600"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              <Bot className="w-3 h-3 inline mr-1 opacity-60" />
              Assign to agent
            </label>
            <select
              value={agentSlug}
              onChange={(e) => setAgentSlug(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent"
            >
              <option value="auto">Auto (system decides)</option>
              {agents.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}{a.title ? ` — ${a.title}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Priority (1 = highest)</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  P{p} {p === 1 ? "— Critical" : p === 2 ? "— High" : p === 3 ? "— Normal" : p === 4 ? "— Low" : "— Backlog"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Related project</label>
            <select
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent"
            >
              <option value="">None</option>
              {projects.filter((p) => p.is_active).map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-2">Step kinds</label>
          <div className="flex flex-wrap gap-1.5">
            {STEP_KINDS.map((sk) => (
              <button
                key={sk}
                onClick={() => toggleStep(sk)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  selectedSteps.includes(sk)
                    ? "bg-accent/20 text-accent-light border border-accent/30"
                    : "bg-surface-900 text-surface-400 border border-surface-700 hover:text-surface-200 hover:border-surface-600"
                }`}
              >
                {sk.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
              feedback.type === "success"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {feedback.message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={submitting || !request.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </div>

      {/* Recent Proposals */}
      <div>
        <h2 className="text-sm font-semibold text-surface-200 mb-3">Recent Proposals</h2>
        {proposals.length === 0 ? (
          <div className="text-center py-12 text-surface-500 text-sm">No proposals yet</div>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => (
              <div key={p.id} className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-surface-300">{p.agent_slug}</span>
                      <StatusBadge status={p.status} size="sm" />
                      <span className="text-[10px] text-surface-500">P{p.priority}</span>
                    </div>
                    <h3 className="text-sm font-medium text-surface-100 mb-0.5">{p.title}</h3>
                    {p.description && p.description !== p.title && (
                      <p className="text-xs text-surface-400 line-clamp-2">{p.description}</p>
                    )}
                    {p.step_kinds.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-2">
                        {p.step_kinds.map((sk, i) => (
                          <span key={i} className="flex items-center gap-1 text-[10px] bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">
                            {i > 0 && <ChevronRight className="w-2.5 h-2.5 opacity-40" />}
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-surface-500 shrink-0">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
