"use client";

import { useEffect, useState, useCallback } from "react";
import { AgentCard } from "@/components/AgentCard";
import { EventFeed } from "@/components/EventFeed";
import { StatusBadge } from "@/components/StatusBadge";
import { Agent, AgentEvent, Mission, MissionProposal } from "@/types";
import {
  Activity,
  Target,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

export default function DashboardPage() {
  const [agents, setAgents] = useState<
    (Agent & { stats: { completed_missions: number; active_missions: number; events_24h: number } })[]
  >([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [proposals, setProposals] = useState<MissionProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, eventsRes, missionsRes, proposalsRes] =
        await Promise.all([
          fetch("/api/agents"),
          fetch("/api/events?limit=20"),
          fetch("/api/missions?limit=10"),
          fetch("/api/proposals?limit=10"),
        ]);

      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (missionsRes.ok) setMissions(await missionsRes.json());
      if (proposalsRes.ok) setProposals(await proposalsRes.json());
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalEvents = agents.reduce(
    (sum, a) => sum + (a.stats?.events_24h ?? 0),
    0
  );
  const activeMissions = missions.filter(
    (m) => m.status === "running" || m.status === "pending"
  ).length;
  const successRate =
    missions.length > 0
      ? Math.round(
          (missions.filter((m) => m.status === "succeeded").length /
            missions.filter((m) =>
              ["succeeded", "failed"].includes(m.status)
            ).length || 1) * 100
        )
      : 0;
  const pendingProposals = proposals.filter(
    (p) => p.status === "pending"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-surface-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-100">Dashboard</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Real-time autonomous operations overview
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
          Auto-refreshing
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Signals Today"
          value={totalEvents}
          color="text-accent-light"
        />
        <StatCard
          icon={Target}
          label="Active Missions"
          value={activeMissions}
          color="text-blue-400"
        />
        <StatCard
          icon={CheckCircle}
          label="Success Rate"
          value={`${successRate}%`}
          color="text-green-400"
        />
        <StatCard
          icon={FileText}
          label="Pending Proposals"
          value={pendingProposals}
          color="text-amber-400"
        />
      </div>

      {/* Agent grid */}
      <section>
        <h2 className="text-sm font-medium text-surface-300 mb-3">
          Agent Team
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      {/* Two column: missions + events */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent missions */}
        <section className="bg-surface-800 border border-surface-700 rounded-xl">
          <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-surface-200">
              Recent Missions
            </h2>
            <a
              href="/missions"
              className="text-xs text-accent-light hover:text-accent"
            >
              View all
            </a>
          </div>
          <div className="divide-y divide-surface-700/50">
            {missions.length === 0 ? (
              <div className="p-4 text-center text-surface-500 text-sm">
                No missions yet
              </div>
            ) : (
              missions.slice(0, 6).map((mission) => (
                <div
                  key={mission.id}
                  className="px-4 py-2.5 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-surface-200 truncate">
                      {mission.title}
                    </p>
                    <p className="text-[11px] text-surface-500">
                      {mission.agent_slug}
                    </p>
                  </div>
                  <StatusBadge status={mission.status} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Event feed */}
        <section className="bg-surface-800 border border-surface-700 rounded-xl">
          <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-surface-200">
              Live Events
            </h2>
            <a
              href="/events"
              className="text-xs text-accent-light hover:text-accent"
            >
              View all
            </a>
          </div>
          <div className="max-h-[350px] overflow-y-auto">
            <EventFeed events={events} compact />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-surface-400">{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
