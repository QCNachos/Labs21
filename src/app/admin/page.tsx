"use client";

import { useEffect, useState } from "react";
import { Agent, Briefing, AgentEvent, MissionProposal } from "@/types/admin";
import { apiGet } from "@/lib/api";
import { AgentCard } from "@/components/admin/AgentCard";
import { EventFeed } from "@/components/admin/EventFeed";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { Users, Target, Inbox, Activity, Bell, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [proposals, setProposals] = useState<MissionProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<Agent[]>("/agents"),
      apiGet<Briefing[]>("/briefings?unread=true&limit=5"),
      apiGet<AgentEvent[]>("/events?limit=30"),
      apiGet<MissionProposal[]>("/proposals?status=pending"),
    ]).then(([a, b, e, p]) => {
      setAgents(a);
      setBriefings(b);
      setEvents(e);
      setProposals(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const working = agents.filter((a) => a.status === "working" || a.status === "thinking").length;
  const totalMissions = agents.reduce((s, a) => s + (a.stats?.active_missions ?? 0), 0);
  const unreadBriefings = briefings.length;

  const kpis = [
    { label: "Active Agents", value: working, total: agents.length, icon: Users, color: "text-accent-light" },
    { label: "Running Missions", value: totalMissions, icon: Target, color: "text-blue-400" },
    { label: "Unread Briefings", value: unreadBriefings, icon: Inbox, color: "text-amber-400" },
    { label: "Pending Proposals", value: proposals.length, icon: Activity, color: "text-purple-400" },
  ];

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-surface-50">Command Center</h1>
        <p className="text-sm text-surface-400 mt-1">Labs21 — Board Director view</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-surface-800 border border-surface-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-surface-400 uppercase tracking-wide">{k.label}</span>
                <Icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
              {"total" in k && <p className="text-xs text-surface-500 mt-0.5">of {(k as typeof k & { total: number }).total} total</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Agents */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-200">Agents</h2>
            <Link href="/admin/agents" className="flex items-center gap-1 text-xs text-accent-light hover:underline">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {agents.slice(0, 4).map((a) => <AgentCard key={a.id} agent={a} compact />)}
          </div>
        </div>

        {/* Side panels */}
        <div className="space-y-4">
          {/* Unread briefings */}
          {briefings.length > 0 && (
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-surface-200">Unread Briefings</h3>
                </div>
                <Link href="/admin/briefings" className="text-xs text-accent-light hover:underline">All</Link>
              </div>
              <div className="space-y-2">
                {briefings.map((b) => (
                  <div key={b.id} className="p-2.5 bg-surface-700/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium text-surface-300">{b.agent_slug}</span>
                      <StatusBadge status={b.priority} size="sm" />
                    </div>
                    <p className="text-xs text-surface-200 line-clamp-2">{b.title}</p>
                    <p className="text-[10px] text-surface-500 mt-1">{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending proposals */}
          {proposals.length > 0 && (
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-surface-200">Pending Approval</h3>
                <Link href="/admin/proposals" className="text-xs text-accent-light hover:underline">All</Link>
              </div>
              <div className="space-y-2">
                {proposals.slice(0, 3).map((p) => (
                  <div key={p.id} className="p-2.5 bg-surface-700/50 rounded-lg">
                    <p className="text-xs font-medium text-surface-200">{p.title}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">{p.agent_slug}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live event feed */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
            <h2 className="text-sm font-semibold text-surface-200">Live Signal Feed</h2>
          </div>
          <Link href="/admin/events" className="text-xs text-accent-light hover:underline flex items-center gap-1">All events <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="p-2">
          <EventFeed events={events} compact />
        </div>
      </div>
    </div>
  );
}
