"use client";

import { useEffect, useState } from "react";
import { BoardMeeting } from "@/types/admin";
import { apiGet, apiPost } from "@/lib/api";
import { format } from "date-fns";
import { Plus, X, ChevronDown, ChevronUp, CheckSquare } from "lucide-react";

export default function BoardPage() {
  const [meetings, setMeetings] = useState<BoardMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: new Date().toISOString().split("T")[0], summary: "", decisions: "", action_items: "" });
  const [saving, setSaving] = useState(false);

  const load = () => apiGet<BoardMeeting[]>("/reports?resource=board").then((data) => { setMeetings(data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const decisions = form.decisions.split("\n").filter(Boolean).map((d) => ({ item: d.trim(), owner: "Board" }));
      const action_items = form.action_items.split("\n").filter(Boolean).map((a) => ({ task: a.trim(), owner: "TBD" }));
      await apiPost("/reports?resource=board", { title: form.title, date: form.date, summary: form.summary, decisions, action_items });
      setShowForm(false);
      setForm({ title: "", date: new Date().toISOString().split("T")[0], summary: "", decisions: "", action_items: "" });
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-50">Board Meetings</h1>
          <p className="text-sm text-surface-400 mt-1">Monthly high-level planning sessions</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Meeting
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-16 text-surface-500 text-sm">No board meetings recorded yet</div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-750 transition-colors"
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-surface-400">{format(new Date(m.date), "MMM")}</p>
                    <p className="text-2xl font-bold text-surface-100">{format(new Date(m.date), "d")}</p>
                    <p className="text-[10px] text-surface-500">{format(new Date(m.date), "yyyy")}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-surface-100">{m.title}</p>
                    <p className="text-xs text-surface-400 mt-0.5 line-clamp-1">{m.summary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-4 text-[11px] text-surface-500">
                    <span>{m.decisions?.length ?? 0} decisions</span>
                    <span>{m.action_items?.length ?? 0} actions</span>
                  </div>
                  {expanded === m.id ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
                </div>
              </button>

              {expanded === m.id && (
                <div className="px-5 pb-5 space-y-4 border-t border-surface-700 pt-4">
                  {m.summary && <p className="text-sm text-surface-300 leading-relaxed">{m.summary}</p>}
                  {m.decisions?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Decisions</h4>
                      <ul className="space-y-1">
                        {m.decisions.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                            <CheckSquare className="w-4 h-4 text-accent-light mt-0.5 shrink-0" />
                            <span>{d.item}</span>
                            {d.owner && <span className="text-surface-500 text-xs ml-auto">— {d.owner}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.action_items?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Action Items</h4>
                      <ul className="space-y-1">
                        {m.action_items.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                            <span className="w-5 h-5 rounded bg-surface-700 flex items-center justify-center text-[10px] shrink-0 mt-0.5">{i + 1}</span>
                            <span>{a.task}</span>
                            {a.owner && <span className="text-surface-500 text-xs ml-auto">→ {a.owner}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-8 overflow-y-auto">
          <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-2xl my-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
              <h2 className="text-base font-semibold text-surface-100">New Board Meeting</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-surface-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-surface-400 mb-1">Title *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-surface-400 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Summary</label>
                <textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 resize-none focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Decisions (one per line)</label>
                <textarea rows={3} value={form.decisions} onChange={(e) => setForm({ ...form, decisions: e.target.value })}
                  placeholder="e.g. Focus on Trading sector for Q1"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 resize-none focus:outline-none focus:border-accent placeholder:text-surface-600" />
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Action Items (one per line)</label>
                <textarea rows={3} value={form.action_items} onChange={(e) => setForm({ ...form, action_items: e.target.value })}
                  placeholder="e.g. CEO to review Q1 budget with CFO"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 resize-none focus:outline-none focus:border-accent placeholder:text-surface-600" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-surface-700 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.title || !form.date} className="px-5 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Record Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
