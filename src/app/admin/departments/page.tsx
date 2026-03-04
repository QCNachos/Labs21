"use client";

import { useEffect, useState } from "react";
import { Department } from "@/types/admin";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Plus, FolderOpen, ExternalLink, X, Edit2 } from "lucide-react";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [form, setForm] = useState<Partial<Department>>({});
  const [saving, setSaving] = useState(false);

  const load = () => apiGet<Department[]>("/departments").then((data) => { setDepartments(data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ order_index: (departments.length + 1) * 10 }); setEditDept(null); setShowForm(true); };
  const openEdit = (d: Department) => { setForm({ ...d }); setEditDept(d); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editDept) {
        await apiPut("/departments", { ...form, id: editDept.id });
      } else {
        await apiPost("/departments", form);
      }
      setShowForm(false);
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
          <h1 className="text-2xl font-semibold text-surface-50">Departments</h1>
          <p className="text-sm text-surface-400 mt-1">Org structure &amp; Google Drive folders</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-16 text-surface-500 text-sm">No departments yet</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {departments.map((d) => (
            <div key={d.id} className="bg-surface-800 border border-surface-700 hover:border-surface-600 rounded-xl p-5 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {d.icon ? (
                    <span className="text-2xl">{d.icon}</span>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center text-surface-300 text-lg font-bold">
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-surface-100">{d.name}</h3>
                    {d.description && <p className="text-xs text-surface-400 mt-0.5">{d.description}</p>}
                  </div>
                </div>
                <button onClick={() => openEdit(d)} className="text-surface-500 hover:text-surface-300 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {d.drive_folder_url ? (
                <a
                  href={d.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-accent-light hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open Google Drive folder
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              ) : (
                <button onClick={() => openEdit(d)} className="flex items-center gap-2 text-xs text-surface-500 hover:text-surface-300 transition-colors">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Add Drive folder link
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
              <h2 className="text-base font-semibold text-surface-100">{editDept ? "Edit Department" : "New Department"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-surface-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-surface-400 mb-1">Name *</label>
                  <input type="text" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-surface-400 mb-1">Icon (emoji)</label>
                  <input type="text" value={form.icon ?? ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="e.g. 🧠"
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Description</label>
                <input type="text" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1">Google Drive folder URL</label>
                <input type="url" value={form.drive_folder_url ?? ""} onChange={(e) => setForm({ ...form, drive_folder_url: e.target.value })}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent placeholder:text-surface-600" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-surface-700 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name} className="px-5 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
