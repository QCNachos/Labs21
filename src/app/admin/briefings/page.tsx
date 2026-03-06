"use client";

import { useEffect, useState } from "react";
import { Briefing } from "@/types/admin";
import { apiGet, apiPatch } from "@/lib/api";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Filter } from "lucide-react";

const TYPES = ["all", "daily", "weekly", "monthly", "alert", "escalation"];

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = () => {
    let url = "/comms?resource=briefings&limit=100";
    if (filter !== "all") url += `&type=${filter}`;
    if (unreadOnly) url += "&unread=true";
    apiGet<Briefing[]>(url).then((data) => { setBriefings(data); setLoading(false); });
  };

  useEffect(() => { load(); }, [filter, unreadOnly]);

  const markRead = async (id: string) => {
    await apiPatch("/comms?resource=briefings", { id, read: true });
    setBriefings((prev) => prev.map((b) => (b.id === id ? { ...b, read: true } : b)));
  };

  const markAllRead = async () => {
    const unread = briefings.filter((b) => !b.read);
    await Promise.all(unread.map((b) => apiPatch("/comms?resource=briefings", { id: b.id, read: true })));
    setBriefings((prev) => prev.map((b) => ({ ...b, read: true })));
  };

  const unreadCount = briefings.filter((b) => !b.read).length;

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-50">Briefings</h1>
          <p className="text-sm text-surface-400 mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm rounded-lg transition-colors">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === t ? "bg-accent text-white" : "bg-surface-800 text-surface-400 hover:text-surface-200 border border-surface-700"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setUnreadOnly(!unreadOnly)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${unreadOnly ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-surface-800 border-surface-700 text-surface-400"}`}>
          <Filter className="w-3 h-3" /> Unread only
        </button>
      </div>

      {/* Briefing list */}
      {briefings.length === 0 ? (
        <div className="text-center py-16 text-surface-500 text-sm">No briefings</div>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => (
            <div key={b.id} className={`bg-surface-800 border rounded-xl p-5 transition-colors ${b.read ? "border-surface-700/50 opacity-60" : "border-surface-600"}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-surface-300">{b.agent_slug}</span>
                  <StatusBadge status={b.briefing_type} size="sm" />
                  <StatusBadge status={b.priority} size="sm" />
                  {!b.read && <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-surface-500">{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
                  {!b.read && (
                    <button onClick={() => markRead(b.id)} className="text-[11px] text-accent-light hover:underline">Mark read</button>
                  )}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-surface-100 mb-2">{b.title}</h3>
              <p className="text-sm text-surface-300 whitespace-pre-wrap leading-relaxed">{b.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
