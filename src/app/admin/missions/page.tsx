"use client";

import { useState } from "react";
import { Mission } from "@/types/admin";
import { useApi } from "@/hooks/useApi";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

const STATUSES = ["all", "pending", "running", "succeeded", "failed"];

export default function MissionsPage() {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const apiPath = filter === "all" ? "/missions" : `/missions?status=${filter}`;
  const { data: missions = [], loading } = useApi<Mission[]>(apiPath);

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-surface-50">Missions</h1>
        <p className="text-sm text-surface-400 mt-1">{missions.length} missions</p>
      </div>

      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === s ? "bg-accent text-white" : "bg-surface-800 text-surface-400 hover:text-surface-200 border border-surface-700"}`}>
            {s}
          </button>
        ))}
      </div>

      {missions.length === 0 ? (
        <div className="text-center py-16 text-surface-500 text-sm">No missions</div>
      ) : (
        <div className="space-y-2">
          {missions.map((m) => (
            <div key={m.id} className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-750 transition-colors text-left"
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-surface-300">{m.agent_slug}</span>
                    <StatusBadge status={m.status} size="sm" pulse={m.status === "running"} />
                  </div>
                  <p className="text-sm font-medium text-surface-100 truncate">{m.title}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.steps && <span className="text-[11px] text-surface-500">{m.steps.length} steps</span>}
                  <span className="text-[10px] text-surface-500">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  {expanded === m.id ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
                </div>
              </button>

              {expanded === m.id && (
                <div className="px-5 pb-4 border-t border-surface-700 pt-3">
                  {m.steps && m.steps.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {m.steps.sort((a, b) => a.step_order - b.step_order).map((step) => (
                        <div key={step.id} className="flex items-center gap-3 py-1.5">
                          <span className="text-[10px] w-4 text-center text-surface-500">{step.step_order + 1}</span>
                          <span className="text-xs font-mono text-surface-300">{step.step_kind}</span>
                          <StatusBadge status={step.status} size="sm" />
                          {step.last_error && <span className="text-[11px] text-red-400 truncate">{step.last_error}</span>}
                          {step.completed_at && <span className="text-[10px] text-surface-500 ml-auto">{formatDistanceToNow(new Date(step.completed_at), { addSuffix: true })}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/admin/runs/${m.id}`}
                    className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:text-accent transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View full run details
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
