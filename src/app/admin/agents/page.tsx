"use client";

import { useEffect, useState } from "react";
import { Agent } from "@/types/admin";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { AgentCard } from "@/components/admin/AgentCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ModelPicker } from "@/components/admin/ModelPicker";
import { Plus, Crown, Server, Wallet, X } from "lucide-react";

const DEPARTMENTS = ["executive", "engineering", "growth", "content", "finance", "operations", "legal"];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Agent>>({});
  const [saving, setSaving] = useState(false);

  const load = () =>
    apiGet<Agent[]>("/agents").then((data) => {
      setAgents(data);
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({}); setSelected(null); setShowForm(true); };
  const openEdit = (a: Agent) => { setForm({ ...a }); setSelected(a); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (selected) {
        await apiPut("/agents", { ...form, id: selected.id });
      } else {
        await apiPost("/agents", form);
      }
      setShowForm(false);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const byDept = DEPARTMENTS.reduce<Record<string, Agent[]>>((acc, d) => {
    acc[d] = agents.filter((a) => a.department === d);
    return acc;
  }, {});
  const ungrouped = agents.filter((a) => !a.department || !DEPARTMENTS.includes(a.department));

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-50">Agents</h1>
          <p className="text-sm text-surface-400 mt-1">{agents.length} agents across {DEPARTMENTS.length} departments</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Agent
        </button>
      </div>

      {/* Org chart by department */}
      {DEPARTMENTS.map((dept) => {
        const deptAgents = byDept[dept];
        if (!deptAgents?.length) return null;
        return (
          <div key={dept}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-3 capitalize">{dept}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {deptAgents.map((a) => <AgentCard key={a.id} agent={a} onClick={() => openEdit(a)} />)}
            </div>
          </div>
        );
      })}
      {ungrouped.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-3">Unassigned</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ungrouped.map((a) => <AgentCard key={a.id} agent={a} onClick={() => openEdit(a)} />)}
          </div>
        </div>
      )}

      {/* Agent form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-8 overflow-y-auto">
          <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-2xl my-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
              <h2 className="text-base font-semibold text-surface-100">{selected ? "Edit Agent" : "New Agent"}</h2>
              <button onClick={() => setShowForm(false)} className="text-surface-400 hover:text-surface-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <Field label="Slug *" value={form.slug ?? ""} onChange={(v) => setForm({ ...form, slug: v })} disabled={!!selected} />
              <Field label="Name *" value={form.name ?? ""} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Title" value={form.title ?? ""} onChange={(v) => setForm({ ...form, title: v })} />
              <SelectField label="Department" value={form.department ?? ""} options={DEPARTMENTS} onChange={(v) => setForm({ ...form, department: v })} />
              <Field label="Reports To (slug)" value={form.reports_to ?? ""} onChange={(v) => setForm({ ...form, reports_to: v })} />
              <div className="flex items-center gap-3 col-span-2">
                <input type="checkbox" checked={form.can_approve ?? false} onChange={(e) => setForm({ ...form, can_approve: e.target.checked })} className="w-4 h-4" />
                <label className="text-sm text-surface-300 flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-amber-400" /> Can approve proposals</label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-surface-400 mb-1">Role Description</label>
                <textarea rows={2} className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 resize-none focus:outline-none focus:border-accent" value={form.role_desc ?? ""} onChange={(e) => setForm({ ...form, role_desc: e.target.value })} />
              </div>
              <hr className="col-span-2 border-surface-700" />
              <div className="col-span-2 flex items-center gap-1 text-xs font-semibold text-surface-400 uppercase tracking-wide">
                <Server className="w-3.5 h-3.5" /> Model
              </div>
              <div className="col-span-2">
                <ModelPicker
                  label="AI Model (sets model_override in config)"
                  value={(form.config as Record<string, string> | undefined)?.model_override ?? ""}
                  onChange={(id) => setForm({ ...form, config: { ...(form.config ?? {}), model_override: id } })}
                />
              </div>
              <Field label="Subscription / billing notes" value={form.model_subscription ?? ""} onChange={(v) => setForm({ ...form, model_subscription: v })} placeholder="e.g. Claude Pro $20/mo" />
              <Field label="Daily cost USD" value={form.daily_cost_usd?.toString() ?? ""} onChange={(v) => setForm({ ...form, daily_cost_usd: v ? parseFloat(v) : null })} type="number" />
              <hr className="col-span-2 border-surface-700" />
              <div className="col-span-2 flex items-center gap-1 text-xs font-semibold text-surface-400 uppercase tracking-wide"><Server className="w-3.5 h-3.5" /> Compute</div>
              <Field label="Provider (e.g. AWS Lightsail)" value={form.compute_provider ?? ""} onChange={(v) => setForm({ ...form, compute_provider: v })} />
              <hr className="col-span-2 border-surface-700" />
              <div className="col-span-2 flex items-center gap-1 text-xs font-semibold text-surface-400 uppercase tracking-wide"><Wallet className="w-3.5 h-3.5" /> Wallet (future)</div>
              <Field label="Wallet address" value={form.wallet_address ?? ""} onChange={(v) => setForm({ ...form, wallet_address: v })} />
              <Field label="Chain" value={form.wallet_chain ?? ""} onChange={(v) => setForm({ ...form, wallet_chain: v })} placeholder="e.g. ETH, SOL" />
            </div>
            <div className="px-6 py-4 border-t border-surface-700 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false, placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-surface-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent disabled:opacity-50"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-surface-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent"
      >
        <option value="">— none —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
