"use client";

import { useEffect, useState, useCallback } from "react";
import { Agent, Instruction, Project } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send, Crown } from "lucide-react";

export default function CommandPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [targetAgent, setTargetAgent] = useState("");
  const [instruction, setInstruction] = useState("");
  const [priority, setPriority] = useState("normal");
  const [projectSlug, setProjectSlug] = useState("");
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, projectsRes, instrRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/projects"),
        fetch("/api/instructions?limit=20"),
      ]);

      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (instrRes.ok) setInstructions(await instrRes.json());
    } catch (err) {
      console.error("Failed to fetch command data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSend = async () => {
    if (!targetAgent || !instruction.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/instructions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPS_API_SECRET ?? ""}`,
        },
        body: JSON.stringify({
          target_agent: targetAgent,
          instruction: instruction.trim(),
          priority,
          project_slug: projectSlug || undefined,
        }),
      });

      if (res.ok) {
        setInstruction("");
        fetchData();
      }
    } catch (err) {
      console.error("Failed to send instruction:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent-light" />
          Command Center
        </h1>
        <p className="text-sm text-surface-400 mt-0.5">
          Give direct instructions to any agent as Board Director
        </p>
      </div>

      {/* Instruction form */}
      <div className="bg-surface-800 border border-accent/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-medium text-surface-200">
            Board Director Directive
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Target agent */}
          <div>
            <label className="block text-xs text-surface-400 mb-1">
              To Agent
            </label>
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent"
            >
              <option value="">Select agent...</option>
              {agents.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name} ({a.title ?? a.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Project context */}
          <div>
            <label className="block text-xs text-surface-400 mb-1">
              Project (optional)
            </label>
            <select
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-surface-400 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Instruction text */}
        <div className="mb-3">
          <label className="block text-xs text-surface-400 mb-1">
            Instruction
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Review the latest commits on Project X and prepare a tech summary for our investor meeting..."
            rows={3}
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={!targetAgent || !instruction.trim() || sending}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending..." : "Send Directive"}
          </button>
        </div>
      </div>

      {/* Recent instructions */}
      <section className="bg-surface-800 border border-surface-700 rounded-xl">
        <div className="px-4 py-3 border-b border-surface-700">
          <h2 className="text-sm font-medium text-surface-200">
            Recent Directives
          </h2>
        </div>
        <div className="divide-y divide-surface-700/50">
          {loading ? (
            <div className="p-4 text-center text-surface-500 text-sm">
              Loading...
            </div>
          ) : instructions.length === 0 ? (
            <div className="p-6 text-center text-surface-500 text-sm">
              No directives sent yet
            </div>
          ) : (
            instructions.map((inst) => (
              <div key={inst.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-accent-light">
                      {inst.target_agent}
                    </span>
                    {inst.project_slug && (
                      <span className="text-[10px] bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded">
                        {inst.project_slug}
                      </span>
                    )}
                    <StatusBadge status={inst.status} />
                  </div>
                  <span className="text-[10px] text-surface-600">
                    {formatDistanceToNow(new Date(inst.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="text-sm text-surface-300">{inst.instruction}</p>
                {inst.response && (
                  <div className="mt-2 pl-3 border-l-2 border-accent/30">
                    <p className="text-xs text-surface-400">{inst.response}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
