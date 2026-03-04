"use client";

import { useEffect, useState, useCallback } from "react";
import { Briefing } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Inbox, AlertTriangle, Clock, CheckCircle, ChevronDown, ChevronRight, Crown } from "lucide-react";

const priorityStyles: Record<string, { badge: string; border: string }> = {
  urgent: { badge: "bg-red-500/10 text-red-400", border: "border-l-red-500" },
  high: { badge: "bg-amber-500/10 text-amber-400", border: "border-l-amber-400" },
  normal: { badge: "bg-surface-700/50 text-surface-300", border: "border-l-surface-600" },
  low: { badge: "bg-surface-700/50 text-surface-500", border: "border-l-surface-700" },
};

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [loading, setLoading] = useState(true);

  const fetchBriefings = useCallback(async () => {
    try {
      const url = filter === "unread"
        ? "/api/briefings?unread=true&limit=50"
        : "/api/briefings?limit=50";
      const res = await fetch(url);
      if (res.ok) setBriefings(await res.json());
    } catch (err) {
      console.error("Failed to fetch briefings:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBriefings();
    const interval = setInterval(fetchBriefings, 30000);
    return () => clearInterval(interval);
  }, [fetchBriefings]);

  const unreadCount = briefings.filter((b) => !b.read).length;
  const urgentCount = briefings.filter(
    (b) => !b.read && (b.priority === "urgent" || b.priority === "high")
  ).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-accent-light" />
            Briefings
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Executive reports from your CEO and CFO
          </p>
        </div>
        <div className="flex items-center gap-3">
          {urgentCount > 0 && (
            <span className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-full text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {urgentCount} urgent
            </span>
          )}
          <span className="text-sm text-surface-400">{unreadCount} unread</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1 w-fit">
        {(["unread", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setFilter(tab); setLoading(true); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === tab
                ? "bg-surface-700 text-surface-100"
                : "text-surface-400 hover:text-surface-200"
            }`}
          >
            {tab === "unread" ? "Unread" : "All Briefings"}
          </button>
        ))}
      </div>

      {/* Briefings list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-surface-500">Loading...</div>
        ) : briefings.length === 0 ? (
          <div className="text-center py-12 text-surface-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-surface-600" />
            <p>All caught up. No unread briefings.</p>
          </div>
        ) : (
          briefings.map((briefing) => {
            const styles = priorityStyles[briefing.priority] ?? priorityStyles.normal;
            const isExpanded = expandedId === briefing.id;

            return (
              <div
                key={briefing.id}
                className={`bg-surface-800 border border-surface-700 rounded-xl overflow-hidden border-l-4 ${styles.border} ${
                  !briefing.read ? "" : "opacity-60"
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : briefing.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-700/30 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-surface-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-surface-500 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-surface-200 truncate">
                        {briefing.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles.badge}`}>
                        {briefing.priority}
                      </span>
                      <span className="text-[10px] bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded">
                        {briefing.briefing_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-surface-400">
                        {(briefing.agent as unknown as { name: string })?.name ?? briefing.agent_slug}
                      </span>
                      {briefing.projects.length > 0 && (
                        <span className="text-xs text-surface-500">
                          -- {briefing.projects.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-surface-600 whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(briefing.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-surface-700/50">
                    <div className="prose prose-sm prose-invert mt-3 max-w-none">
                      <div className="text-sm text-surface-300 whitespace-pre-wrap leading-relaxed">
                        {briefing.content}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
