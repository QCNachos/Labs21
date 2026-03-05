"use client";

import { Agent } from "@/types/admin";
import { StatusBadge } from "./StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { Crown, Shield, Server, Cpu, DollarSign } from "lucide-react";

const departmentColors: Record<string, string> = {
  executive: "border-amber-500/30 bg-amber-500/5",
  engineering: "border-blue-500/30 bg-blue-500/5",
  growth: "border-green-500/30 bg-green-500/5",
  content: "border-purple-500/30 bg-purple-500/5",
  finance: "border-emerald-500/30 bg-emerald-500/5",
  operations: "border-orange-500/30 bg-orange-500/5",
};

const avatarColors: Record<string, string> = {
  executive: "bg-amber-500/20 text-amber-400",
  engineering: "bg-blue-500/20 text-blue-400",
  growth: "bg-green-500/20 text-green-400",
  content: "bg-purple-500/20 text-purple-400",
  finance: "bg-emerald-500/20 text-emerald-400",
  operations: "bg-orange-500/20 text-orange-400",
};

interface AgentCardProps {
  agent: Agent;
  compact?: boolean;
  onClick?: () => void;
}

export function AgentCard({ agent, compact = false, onClick }: AgentCardProps) {
  const isExec = agent.department === "executive" || (agent.department === "finance" && agent.can_approve);
  const deptColor = departmentColors[agent.department ?? "operations"] ?? "border-surface-700";
  const avatarColor = avatarColors[agent.department ?? "operations"] ?? "bg-surface-700 text-surface-400";

  return (
    <div
      className={`border rounded-xl p-4 transition-colors bg-surface-800 ${deptColor} ${onClick ? "cursor-pointer hover:border-opacity-60" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${avatarColor}`}>
            {agent.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-surface-100">{agent.name}</h3>
              {isExec && <Crown className="w-3 h-3 text-amber-400" />}
              {agent.can_approve && !isExec && <Shield className="w-3 h-3 text-accent-light" />}
            </div>
            <p className="text-[11px] text-surface-400 mt-0.5">{agent.title ?? agent.slug}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} pulse={agent.status === "working" || agent.status === "thinking"} />
      </div>

      {!compact && (
        <>
          <p className="text-xs text-surface-500 line-clamp-2 mb-3">{agent.role_desc}</p>

          {/* Model + compute info */}
          <div className="flex flex-wrap gap-2 mb-3">
            {((agent.config as Record<string, string> | undefined)?.model_override || agent.model_name) && (
              <span className="flex items-center gap-1 text-[10px] bg-accent/10 text-accent-light px-2 py-0.5 rounded-full">
                <Cpu className="w-2.5 h-2.5" />
                {((agent.config as Record<string, string> | undefined)?.model_override ?? agent.model_name ?? "").split(":").slice(1).join(":") || agent.model_name}
              </span>
            )}
            {agent.compute_provider && (
              <span className="flex items-center gap-1 text-[10px] bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">
                <Server className="w-2.5 h-2.5" />
                {agent.compute_provider}
              </span>
            )}
            {agent.daily_cost_usd != null && (
              <span className="flex items-center gap-1 text-[10px] bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">
                <DollarSign className="w-2.5 h-2.5" />
                ${agent.daily_cost_usd}/day
              </span>
            )}
          </div>
        </>
      )}

      {agent.stats && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-700/50">
          <div>
            <p className="text-lg font-semibold text-surface-100">{agent.stats.completed_missions}</p>
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">Done</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-accent-light">{agent.stats.active_missions}</p>
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">Active</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-surface-100">{agent.stats.events_24h}</p>
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">Signals</p>
          </div>
        </div>
      )}

      {agent.last_active && (
        <p className="text-[10px] text-surface-500 mt-2">
          Last active {formatDistanceToNow(new Date(agent.last_active), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
