"use client";

import { useEffect, useState, useCallback } from "react";
import { Agent, AgentEvent } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { Zap } from "lucide-react";

/**
 * Stage page - Live view of all agents working.
 * Shows agents in a visual workspace with their current activity.
 */
export default function StagePage() {
  const [agents, setAgents] = useState<
    (Agent & {
      stats: {
        completed_missions: number;
        active_missions: number;
        events_24h: number;
      };
    })[]
  >([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [totalSignals, setTotalSignals] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, eventsRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/events?limit=30"),
      ]);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data);
        setTotalSignals(
          data.reduce(
            (sum: number, a: { stats?: { events_24h?: number } }) =>
              sum + (a.stats?.events_24h ?? 0),
            0
          )
        );
      }
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } catch (err) {
      console.error("Stage fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
              Live
            </div>
            <span className="text-sm text-surface-400">
              {totalSignals} signals processed today
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-surface-100 mt-2">
            The Stage
          </h1>
          <p className="text-sm text-surface-400">
            Watch AI agents work in real-time
          </p>
        </div>
      </div>

      {/* Agent workspace grid */}
      <div className="grid grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentWorkstation key={agent.id} agent={agent} events={events} />
        ))}
      </div>

      {/* Live event stream */}
      <section className="bg-surface-800 border border-surface-700 rounded-xl">
        <div className="px-4 py-3 border-b border-surface-700">
          <h2 className="text-sm font-medium text-surface-200 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-accent-light" />
            Live Activity Stream
          </h2>
        </div>
        <div className="max-h-[300px] overflow-y-auto divide-y divide-surface-700/30">
          {events.map((event) => (
            <div key={event.id} className="px-4 py-2 flex items-center gap-3">
              <span className="text-[10px] text-surface-600 font-mono w-12 shrink-0">
                {new Date(event.created_at).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              {event.agent_slug && (
                <span className="text-xs text-surface-300 font-medium w-16 shrink-0 truncate">
                  {event.agent_slug}
                </span>
              )}
              <span className="text-xs text-surface-400 truncate">
                {event.event_type}
              </span>
              <span className="text-[11px] text-surface-600 truncate ml-auto">
                {event.tags.join(", ")}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <div className="p-6 text-center text-surface-500 text-sm">
              Waiting for activity...
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AgentWorkstation({
  agent,
  events,
}: {
  agent: Agent & {
    stats: {
      completed_missions: number;
      active_missions: number;
      events_24h: number;
    };
  };
  events: AgentEvent[];
}) {
  const agentEvents = events
    .filter((e) => e.agent_slug === agent.slug)
    .slice(0, 3);

  const isActive = agent.status === "working" || agent.status === "thinking";

  return (
    <div
      className={`bg-surface-800 border rounded-xl p-4 transition-all ${
        isActive
          ? "border-accent/40 shadow-lg shadow-accent/5"
          : "border-surface-700"
      }`}
    >
      {/* Agent header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
              isActive
                ? "bg-accent/20 text-accent-light"
                : "bg-surface-700 text-surface-400"
            }`}
          >
            {agent.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-100">
              {agent.name}
            </h3>
            <p className="text-[11px] text-surface-500">
              {agent.role_desc ?? agent.slug}
            </p>
          </div>
        </div>
        <StatusBadge
          status={agent.status}
          pulse={isActive}
          size="md"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-center py-2 border-t border-b border-surface-700/50 my-2">
        <div className="flex-1">
          <p className="text-lg font-semibold text-surface-200">
            {agent.stats.events_24h}
          </p>
          <p className="text-[9px] text-surface-500 uppercase tracking-wider">
            Signals
          </p>
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold text-surface-200">
            {agent.stats.active_missions}
          </p>
          <p className="text-[9px] text-surface-500 uppercase tracking-wider">
            Active
          </p>
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold text-surface-200">
            {agent.stats.completed_missions}
          </p>
          <p className="text-[9px] text-surface-500 uppercase tracking-wider">
            Done
          </p>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-2 space-y-1">
        {agentEvents.length > 0 ? (
          agentEvents.map((evt) => (
            <div key={evt.id} className="flex items-center gap-2">
              <span className="text-[10px] text-surface-600 font-mono">
                {formatDistanceToNow(new Date(evt.created_at), {
                  addSuffix: true,
                })}
              </span>
              <span className="text-[11px] text-surface-400 truncate">
                {evt.event_type}
              </span>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-surface-600 text-center py-2">
            No recent activity
          </p>
        )}
      </div>
    </div>
  );
}
