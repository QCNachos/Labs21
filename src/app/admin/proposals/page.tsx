"use client";

import { useState } from "react";
import { MissionProposal } from "@/types/admin";
import { apiPatch } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { Check, X, ChevronRight } from "lucide-react";

const STATUSES = ["all", "pending", "accepted", "rejected"];

export default function ProposalsPage() {
  const [filter, setFilter] = useState("pending");
  const [acting, setActing] = useState<string | null>(null);
  const apiPath = filter === "all" ? "/proposals" : `/proposals?status=${filter}`;
  const { data: proposals = [], loading, reload } = useApi<MissionProposal[]>(apiPath);

  const decide = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    try {
      await apiPatch("/proposals", { id, action });
      reload();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update proposal");
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-surface-50">Proposals</h1>
        <p className="text-sm text-surface-400 mt-1">Agent mission proposals awaiting Board Director decision</p>
      </div>

      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === s ? "bg-accent text-white" : "bg-surface-800 text-surface-400 hover:text-surface-200 border border-surface-700"}`}>
            {s}
          </button>
        ))}
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-16 text-surface-500 text-sm">No proposals</div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <div key={p.id} className="bg-surface-800 border border-surface-700 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-semibold text-surface-300">{p.agent_slug}</span>
                    <StatusBadge status={p.status} size="sm" />
                    <span className="text-[10px] text-surface-500">P{p.priority}</span>
                    <span className="text-[10px] text-surface-500">{p.source}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-surface-100 mb-1">{p.title}</h3>
                  {p.description && <p className="text-xs text-surface-400 mb-2">{p.description}</p>}
                  {p.step_kinds.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.step_kinds.map((sk, i) => (
                        <span key={i} className="flex items-center gap-1 text-[10px] bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">
                          {i > 0 && <ChevronRight className="w-2.5 h-2.5 opacity-40" />}
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-surface-500 mt-2">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                </div>
                {p.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => decide(p.id, "reject")}
                      disabled={acting === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => decide(p.id, "approve")}
                      disabled={acting === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
