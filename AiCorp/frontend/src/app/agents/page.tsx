"use client";

import { useEffect, useState, useCallback } from "react";
import { Agent } from "@/types";
import { AgentCard } from "@/components/AgentCard";
import { Users, Crown, ArrowDown } from "lucide-react";

type AgentWithStats = Agent & {
  stats: {
    completed_missions: number;
    active_missions: number;
    events_24h: number;
  };
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) setAgents(await res.json());
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const executives = agents.filter((a) => a.reports_to === null);
  const ceoReports = agents.filter((a) => a.reports_to === "ceo");
  const cfoReports = agents.filter((a) => a.reports_to === "cfo");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-surface-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-accent-light" />
          Organization
        </h1>
        <p className="text-sm text-surface-400 mt-0.5">
          Corporate hierarchy -- you are the Board Director
        </p>
      </div>

      {/* Board Director (You) */}
      <section>
        <div className="flex items-center justify-center mb-4">
          <div className="bg-surface-800 border-2 border-amber-500/30 rounded-xl px-6 py-3 flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Board Director</p>
              <p className="text-xs text-surface-400">You</p>
            </div>
          </div>
        </div>
        <div className="flex justify-center mb-4">
          <ArrowDown className="w-4 h-4 text-surface-600" />
        </div>
      </section>

      {/* Executive team */}
      <section>
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          Executive Team (reports to you)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {executives.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      {/* CEO reports */}
      {ceoReports.length > 0 && (
        <section>
          <div className="flex justify-center mb-3">
            <ArrowDown className="w-4 h-4 text-surface-600" />
          </div>
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            Reports to CEO (Atlas)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {ceoReports.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {/* CFO reports */}
      {cfoReports.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            Reports to CFO (Ledger)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {cfoReports.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
