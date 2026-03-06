"use client";

import { useState } from "react";
import { AgentEvent } from "@/types/admin";
import { EventFeed } from "@/components/admin/EventFeed";
import { RefreshCw } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import useSWR from "swr";

export default function EventsPage() {
  const [agentFilter, setAgentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const apiPath = (() => {
    let url = "/events?limit=100";
    if (agentFilter) url += `&agent=${agentFilter}`;
    if (typeFilter) url += `&type=${typeFilter}`;
    return url;
  })();

  const { data: events = [], loading, reload } = useApi<AgentEvent[]>(apiPath);
  useSWR(autoRefresh ? apiPath : null, null, { refreshInterval: 5000 });

  const agents = [...new Set(events.map((e) => e.agent_slug).filter(Boolean))] as string[];
  const types = [...new Set(events.map((e) => e.event_type))] as string[];

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-50">Signal Feed</h1>
          <p className="text-sm text-surface-400 mt-1">{events.length} events</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${autoRefresh ? "bg-success/10 border-success/30 text-success" : "bg-surface-800 border-surface-700 text-surface-400"}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            Auto-refresh
          </button>
          <button onClick={() => reload()} className="px-3 py-2 bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 text-xs rounded-lg transition-colors">
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-accent">
          <option value="">All agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-accent">
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl">
        <EventFeed events={events} />
      </div>
    </div>
  );
}
