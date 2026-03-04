"use client";

import { useEffect, useState, useCallback } from "react";
import { MissionProposal } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { FileText, Filter } from "lucide-react";

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<MissionProposal[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const url =
        filter === "all"
          ? "/api/proposals?limit=100"
          : `/api/proposals?status=${filter}&limit=100`;
      const res = await fetch(url);
      if (res.ok) setProposals(await res.json());
    } catch (err) {
      console.error("Failed to fetch proposals:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchProposals();
    const interval = setInterval(fetchProposals, 15000);
    return () => clearInterval(interval);
  }, [fetchProposals]);

  const counts = {
    all: proposals.length,
    pending: proposals.filter((p) => p.status === "pending").length,
    accepted: proposals.filter((p) => p.status === "accepted").length,
    rejected: proposals.filter((p) => p.status === "rejected").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent-light" />
          Proposals
        </h1>
        <p className="text-sm text-surface-400 mt-0.5">
          Agent proposals awaiting approval or auto-approved
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1 w-fit">
        {(["all", "pending", "accepted", "rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilter(tab);
              setLoading(true);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === tab
                ? "bg-surface-700 text-surface-100"
                : "text-surface-400 hover:text-surface-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="ml-1.5 text-surface-500">
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Proposals table */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide">
                Agent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide">
                Steps
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700/50">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-surface-500"
                >
                  Loading...
                </td>
              </tr>
            ) : proposals.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-surface-500"
                >
                  No proposals found
                </td>
              </tr>
            ) : (
              proposals.map((proposal) => (
                <tr
                  key={proposal.id}
                  className="hover:bg-surface-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-surface-300 font-medium">
                      {proposal.agent_slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-surface-200 truncate max-w-xs">
                        {proposal.title}
                      </p>
                      {proposal.reject_reason && (
                        <p className="text-[11px] text-red-400 mt-0.5 truncate max-w-xs">
                          {proposal.reject_reason}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        proposal.source === "trigger"
                          ? "bg-amber-500/10 text-amber-400"
                          : proposal.source === "reaction"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-surface-700/50 text-surface-400"
                      }`}
                    >
                      {proposal.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {proposal.step_kinds.map((kind, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-surface-700 text-surface-300 px-1.5 py-0.5 rounded"
                        >
                          {kind}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={proposal.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-surface-500">
                    {formatDistanceToNow(new Date(proposal.created_at), {
                      addSuffix: true,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
