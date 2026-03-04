"use client";

import { AgentEvent } from "@/types/admin";
import { formatDistanceToNow } from "date-fns";
import { Zap, CheckCircle, XCircle, FileText, Target, AlertTriangle, Activity } from "lucide-react";

const eventIcons: Record<string, typeof Zap> = {
  "proposal:created": FileText,
  "proposal:auto_approved": CheckCircle,
  "proposal:manually_approved": CheckCircle,
  "proposal:gate_rejected": XCircle,
  "mission:created": Target,
  "mission:succeeded": CheckCircle,
  "mission:failed": XCircle,
  "step:succeeded": CheckCircle,
  "step:failed": XCircle,
  "step:stale_recovered": AlertTriangle,
  "trigger:fired": Zap,
  "reaction:queued": Activity,
  "instruction:received": FileText,
};

const eventColors: Record<string, string> = {
  "proposal:created": "text-blue-400",
  "proposal:auto_approved": "text-green-400",
  "proposal:manually_approved": "text-green-400",
  "proposal:gate_rejected": "text-red-400",
  "mission:created": "text-accent-light",
  "mission:succeeded": "text-green-400",
  "mission:failed": "text-red-400",
  "step:succeeded": "text-green-400",
  "step:failed": "text-red-400",
  "step:stale_recovered": "text-amber-400",
  "trigger:fired": "text-amber-400",
  "reaction:queued": "text-purple-400",
  "instruction:received": "text-accent-light",
};

export function EventFeed({ events, compact = false }: { events: AgentEvent[]; compact?: boolean }) {
  if (events.length === 0) {
    return <div className="text-center py-8 text-surface-500 text-sm">No events yet</div>;
  }
  return (
    <div className="space-y-0">
      {events.map((event) => {
        const Icon = eventIcons[event.event_type] ?? Activity;
        const color = eventColors[event.event_type] ?? "text-surface-400";
        return (
          <div key={event.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-800/50 rounded-lg transition-colors">
            <div className={`mt-0.5 ${color}`}><Icon className="w-3.5 h-3.5" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {event.agent_slug && <span className="text-xs font-medium text-surface-300">{event.agent_slug}</span>}
                <span className="text-xs text-surface-400">{event.event_type}</span>
              </div>
              {!compact && event.payload && Object.keys(event.payload).length > 0 && (
                <p className="text-[11px] text-surface-500 mt-0.5 truncate">{JSON.stringify(event.payload).slice(0, 120)}</p>
              )}
            </div>
            <span className="text-[10px] text-surface-600 whitespace-nowrap shrink-0">
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
