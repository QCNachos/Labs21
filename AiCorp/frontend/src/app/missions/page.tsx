"use client";

import { useEffect, useState, useCallback } from "react";
import { Mission } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { Target, ChevronDown, ChevronRight } from "lucide-react";

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMissions = useCallback(async () => {
    try {
      const url =
        filter === "all"
          ? "/api/missions?limit=100"
          : `/api/missions?status=${filter}&limit=100`;
      const res = await fetch(url);
      if (res.ok) setMissions(await res.json());
    } catch (err) {
      console.error("Failed to fetch missions:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 15000);
    return () => clearInterval(interval);
  }, [fetchMissions]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
          <Target className="w-5 h-5 text-accent-light" />
          Missions
        </h1>
        <p className="text-sm text-surface-400 mt-0.5">
          Execution pipeline: proposals become missions with executable steps
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1 w-fit">
        {(
          ["all", "pending", "running", "succeeded", "failed"] as const
        ).map((tab) => (
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
          </button>
        ))}
      </div>

      {/* Missions list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-surface-500">Loading...</div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-surface-500">
            No missions found
          </div>
        ) : (
          missions.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              expanded={expandedId === mission.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === mission.id ? null : mission.id
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function MissionRow({
  mission,
  expanded,
  onToggle,
}: {
  mission: Mission;
  expanded: boolean;
  onToggle: () => void;
}) {
  const steps = mission.steps ?? [];
  const completedSteps = steps.filter(
    (s) => s.status === "succeeded"
  ).length;
  const totalSteps = steps.length;
  const progressPct =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      {/* Mission header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-700/30 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-surface-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-surface-500 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-surface-200 font-medium truncate">
              {mission.title}
            </span>
            <StatusBadge
              status={mission.status}
              pulse={mission.status === "running"}
            />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-surface-500">
              {mission.agent_slug}
            </span>
            <span className="text-xs text-surface-600">
              {formatDistanceToNow(new Date(mission.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-32 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-surface-500 mb-1">
            <span>
              {completedSteps}/{totalSteps} steps
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                mission.status === "failed"
                  ? "bg-red-400"
                  : mission.status === "succeeded"
                  ? "bg-green-400"
                  : "bg-accent"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </button>

      {/* Expanded steps */}
      {expanded && steps.length > 0 && (
        <div className="border-t border-surface-700 px-4 py-3">
          <div className="space-y-2">
            {steps
              .sort((a, b) => a.step_order - b.step_order)
              .map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 py-1.5"
                >
                  <span className="text-xs text-surface-600 font-mono w-6 text-right">
                    #{step.step_order + 1}
                  </span>
                  <span className="text-xs text-surface-300 font-medium w-28">
                    {step.step_kind}
                  </span>
                  <StatusBadge status={step.status} />
                  {step.last_error && (
                    <span className="text-[11px] text-red-400 truncate">
                      {step.last_error}
                    </span>
                  )}
                  {step.completed_at && (
                    <span className="text-[10px] text-surface-600 ml-auto">
                      {formatDistanceToNow(new Date(step.completed_at), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
