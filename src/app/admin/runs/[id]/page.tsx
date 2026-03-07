"use client";

import { useEffect, useState } from "react";
import { Mission, MissionStep } from "@/types/admin";
import { apiGet } from "@/lib/api";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format, differenceInSeconds } from "date-fns";
import {
  ArrowLeft,
  Clock,
  Cpu,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  SkipForward,
} from "lucide-react";

function formatDuration(startIso: string, endIso: string): string {
  const secs = differenceInSeconds(new Date(endIso), new Date(startIso));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  if (mins < 60) return `${mins}m ${rem}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

const stepStatusIcon: Record<string, React.ReactNode> = {
  queued: <Circle className="w-4 h-4 text-surface-400" />,
  running: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  succeeded: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  failed: <AlertCircle className="w-4 h-4 text-red-400" />,
  skipped: <SkipForward className="w-4 h-4 text-surface-400" />,
};

function JsonViewer({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-accent-light hover:text-accent transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {label}
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-surface-900 border border-surface-700 rounded-lg text-xs text-surface-300 overflow-x-auto max-h-80 overflow-y-auto font-mono leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function RunViewerPage() {
  const params = useParams();
  const id = params.id as string;

  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet<Mission[]>(`/missions?id=${id}`)
      .then((data) => {
        const m = Array.isArray(data) ? data[0] : data;
        if (!m) throw new Error("Mission not found");
        setMission(m);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-surface-500 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading mission...
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/admin/missions" className="inline-flex items-center gap-1.5 text-sm text-accent-light hover:text-accent transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Missions
        </Link>
        <div className="flex items-center gap-3 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error ?? "Mission not found"}</span>
        </div>
      </div>
    );
  }

  const steps = (mission.steps ?? []).sort((a, b) => a.step_order - b.step_order);
  const totalTokensIn = steps.reduce((s, st) => s + (st.token_count_in ?? 0), 0);
  const totalTokensOut = steps.reduce((s, st) => s + (st.token_count_out ?? 0), 0);
  const totalCost = steps.reduce((s, st) => s + (st.cost_estimate ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/admin/missions" className="inline-flex items-center gap-1.5 text-sm text-accent-light hover:text-accent transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Missions
      </Link>

      {/* Header */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-semibold text-surface-50 truncate">{mission.title}</h1>
              <StatusBadge status={mission.status} size="md" pulse={mission.status === "running"} />
            </div>
            {mission.description && (
              <p className="text-sm text-surface-400 mb-3">{mission.description}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-surface-300">
              <Cpu className="w-3.5 h-3.5 text-surface-500" />
              <span className="font-medium">{mission.agent_slug}</span>
              {mission.agent?.name && (
                <span className="text-surface-500">({mission.agent.name})</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-surface-700">
          {/* Timing */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <Clock className="w-3.5 h-3.5" /> Started
            </div>
            <p className="text-sm text-surface-200">
              {mission.started_at
                ? format(new Date(mission.started_at), "MMM d, HH:mm:ss")
                : "Not started"}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <Clock className="w-3.5 h-3.5" /> Completed
            </div>
            <p className="text-sm text-surface-200">
              {mission.completed_at
                ? format(new Date(mission.completed_at), "MMM d, HH:mm:ss")
                : "In progress"}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <Clock className="w-3.5 h-3.5" /> Duration
            </div>
            <p className="text-sm text-surface-200">
              {mission.started_at && mission.completed_at
                ? formatDuration(mission.started_at, mission.completed_at)
                : mission.started_at
                  ? formatDistanceToNow(new Date(mission.started_at), { addSuffix: false })
                  : "--"}
            </p>
          </div>
          {/* Cost */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <DollarSign className="w-3.5 h-3.5" /> Cost
            </div>
            <p className="text-sm text-surface-200">
              {formatCost(totalCost)}
              <span className="text-surface-500 ml-1.5 text-xs">
                ({totalTokensIn.toLocaleString()} in / {totalTokensOut.toLocaleString()} out)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main content: Timeline + Side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Step Timeline */}
        <div className="space-y-0">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">
            Steps ({steps.length})
          </h2>

          {steps.length === 0 ? (
            <div className="text-center py-12 text-surface-500 text-sm bg-surface-800 border border-surface-700 rounded-xl">
              No steps recorded
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-surface-700" />

              <div className="space-y-3">
                {steps.map((step) => (
                  <StepCard key={step.id} step={step} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
              Mission Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">ID</span>
                <span className="text-surface-300 font-mono text-xs truncate max-w-[160px]" title={mission.id}>
                  {mission.id.slice(0, 8)}...
                </span>
              </div>
              {mission.proposal_id && (
                <div className="flex justify-between">
                  <span className="text-surface-500">Proposal</span>
                  <span className="text-surface-300 font-mono text-xs truncate max-w-[160px]">
                    {mission.proposal_id.slice(0, 8)}...
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-surface-500">Priority</span>
                <span className="text-surface-300">{mission.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Created</span>
                <span className="text-surface-300 text-xs">
                  {formatDistanceToNow(new Date(mission.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Steps</span>
                <span className="text-surface-300">{steps.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Total tokens</span>
                <span className="text-surface-300">{(totalTokensIn + totalTokensOut).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {mission.result && Object.keys(mission.result).length > 0 && (
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                Result
              </h3>
              <pre className="text-xs text-surface-300 font-mono overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
                {JSON.stringify(mission.result, null, 2)}
              </pre>
            </div>
          )}

          <Link
            href="/admin/missions"
            className="block w-full text-center text-sm text-accent-light hover:text-accent transition-colors bg-surface-800 border border-surface-700 rounded-xl py-2.5"
          >
            View all missions
          </Link>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step }: { step: MissionStep }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div className="absolute left-2.5 top-4 z-10 bg-surface-900 p-0.5 rounded-full">
        {stepStatusIcon[step.status] ?? <Circle className="w-4 h-4 text-surface-400" />}
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-2">
        {/* Step header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-surface-500">#{step.step_order + 1}</span>
          <span className="px-2 py-0.5 rounded-md bg-surface-700 text-xs font-mono text-surface-200">
            {step.step_kind}
          </span>
          <StatusBadge status={step.status} size="sm" pulse={step.status === "running"} />
          {step.model_used && (
            <span className="flex items-center gap-1 text-xs text-surface-400">
              <Cpu className="w-3 h-3" />
              {step.model_used}
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto flex items-center gap-1 text-xs text-accent-light hover:text-accent transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>

        {/* Token / cost row */}
        {(step.token_count_in > 0 || step.token_count_out > 0) && (
          <div className="flex items-center gap-4 text-xs text-surface-400">
            <span>
              <Terminal className="w-3 h-3 inline mr-1" />
              {step.token_count_in.toLocaleString()} in / {step.token_count_out.toLocaleString()} out
            </span>
            {step.cost_estimate > 0 && (
              <span>
                <DollarSign className="w-3 h-3 inline mr-0.5" />
                {formatCost(step.cost_estimate)}
              </span>
            )}
          </div>
        )}

        {/* Timing row */}
        <div className="flex items-center gap-4 text-xs text-surface-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(step.created_at), "HH:mm:ss")}
            {step.completed_at && (
              <> &rarr; {format(new Date(step.completed_at), "HH:mm:ss")}</>
            )}
            {step.completed_at && (
              <span className="text-surface-400 ml-1">
                ({formatDuration(step.created_at, step.completed_at)})
              </span>
            )}
          </span>
          {step.claimed_by && (
            <span className="text-surface-500">
              worker: <span className="font-mono text-surface-400">{step.claimed_by}</span>
            </span>
          )}
        </div>

        {/* Error */}
        {step.last_error && (
          <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-400 break-all">{step.last_error}</span>
          </div>
        )}

        {/* Expanded: input/output JSON */}
        {expanded && (
          <div className="pt-2 border-t border-surface-700 space-y-1">
            <JsonViewer data={step.input} label="Input" />
            <JsonViewer data={step.output} label="Output" />
          </div>
        )}
      </div>
    </div>
  );
}
