"use client";

import { useEffect, useState } from "react";
import { Agent, Instruction, Project } from "@/types/admin";
import { apiGet, apiPost } from "@/lib/api";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { Send, ChevronDown } from "lucide-react";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export default function CommandPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetAgent, setTargetAgent] = useState("");
  const [instruction, setInstruction] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [projectSlug, setProjectSlug] = useState("");
  const [sending, setSending] = useState(false);

  const load = () =>
    Promise.all([
      apiGet<Agent[]>("/agents"),
      apiGet<Project[]>("/projects"),
      apiGet<Instruction[]>("/comms?resource=instructions&limit=50"),
    ]).then(([a, p, i]) => { setAgents(a); setProjects(p); setInstructions(i); setLoading(false); });

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!targetAgent || !instruction.trim()) return;
    setSending(true);
    try {
      await apiPost("/comms?resource=instructions", { target_agent: targetAgent, instruction, priority, project_slug: projectSlug || null });
      setInstruction("");
      load();
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-surface-50">Command</h1>
        <p className="text-sm text-surface-400 mt-1">Send direct instructions to agents as Board Director</p>
      </div>

      {/* Compose instruction */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-surface-200">New Instruction</h2>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Target agent *</label>
            <select value={targetAgent} onChange={(e) => setTargetAgent(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent">
              <option value="">Select agent…</option>
              {agents.map((a) => <option key={a.slug} value={a.slug}>{a.name} ({a.slug})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent capitalize">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Related project</label>
            <select value={projectSlug} onChange={(e) => setProjectSlug(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent">
              <option value="">None</option>
              {projects.filter((p) => p.is_active).map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1.5">Instruction *</label>
          <textarea
            rows={4}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Write a clear instruction for the agent…"
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 resize-none focus:outline-none focus:border-accent placeholder:text-surface-600"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={send}
            disabled={sending || !targetAgent || !instruction.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Send Instruction"}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-surface-200 mb-3">Recent Instructions</h2>
        {instructions.length === 0 ? (
          <div className="text-center py-12 text-surface-500 text-sm">No instructions sent yet</div>
        ) : (
          <div className="space-y-2">
            {instructions.map((inst) => (
              <div key={inst.id} className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-surface-300">{inst.target_agent}</span>
                    <StatusBadge status={inst.priority} size="sm" />
                    <StatusBadge status={inst.status} size="sm" />
                  </div>
                  <span className="text-[10px] text-surface-500">{formatDistanceToNow(new Date(inst.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm text-surface-300">{inst.instruction}</p>
                {inst.response && (
                  <div className="mt-2 pt-2 border-t border-surface-700">
                    <p className="text-[11px] text-surface-400">Response: {inst.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
