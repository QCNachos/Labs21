"use client";

import { useEffect, useState } from "react";
import { Project, ProjectSector, SECTOR_LABELS, SUBSECTORS_BY_SECTOR, ProjectStage } from "@/types/admin";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Plus, Globe, Github, FolderOpen, FileText, X, ExternalLink } from "lucide-react";

const SECTORS: ProjectSector[] = ["trading", "platforms", "marketing", "art", "others"];
const STAGES: ProjectStage[] = ["idea", "mvp", "beta", "launched", "scaling"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSector, setActiveSector] = useState<ProjectSector | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState<Partial<Project & { website_str: string; github_str: string; drive_str: string; docs_str: string }>>({});

  const load = () => apiGet<Project[]>("/projects").then((data) => { setProjects(data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const visible = activeSector === "all" ? projects : projects.filter((p) => p.sector === activeSector);

  const openNew = () => {
    setForm({ status: "active", stage: "idea", sector: "others", is_active: true, links: {} });
    setEditProject(null);
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    setForm({
      ...p,
      website_str: p.links?.website ?? "",
      github_str: p.links?.github ?? "",
      drive_str: p.links?.drive_folder ?? "",
      docs_str: p.links?.docs ?? "",
    });
    setEditProject(p);
    setShowForm(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      links: {
        ...(form.links ?? {}),
        ...(form.website_str ? { website: form.website_str } : {}),
        ...(form.github_str ? { github: form.github_str } : {}),
        ...(form.drive_str ? { drive_folder: form.drive_str } : {}),
        ...(form.docs_str ? { docs: form.docs_str } : {}),
      },
    };
    if (editProject) {
      await apiPut("/projects", { ...payload, id: editProject.id });
    } else {
      await apiPost("/projects", payload);
    }
    setShowForm(false);
    load();
  };

  const sectorCounts = SECTORS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.sector === s).length;
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-50">Projects</h1>
          <p className="text-sm text-surface-400 mt-1">{projects.length} projects across portfolio</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Sector tabs */}
      <div className="flex gap-2 flex-wrap">
        <SectorTab label="All" count={projects.length} active={activeSector === "all"} onClick={() => setActiveSector("all")} />
        {SECTORS.map((s) => (
          <SectorTab key={s} label={SECTOR_LABELS[s]} count={sectorCounts[s] ?? 0} active={activeSector === s} onClick={() => setActiveSector(s)} />
        ))}
      </div>

      {/* Projects grid */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-surface-500 text-sm">No projects found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => <ProjectCard key={p.id} project={p} onEdit={() => openEdit(p)} />)}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-8 overflow-y-auto">
          <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-2xl my-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
              <h2 className="text-base font-semibold text-surface-100">{editProject ? "Edit Project" : "New Project"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-surface-400" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <Field label="Name *" value={form.name ?? ""} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Slug *" value={form.slug ?? ""} onChange={(v) => setForm({ ...form, slug: v })} disabled={!!editProject} />
              <div className="col-span-2">
                <label className="block text-xs text-surface-400 mb-1">Description</label>
                <textarea rows={2} className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 resize-none focus:outline-none focus:border-accent" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <SelectField label="Sector" value={form.sector ?? "others"} options={SECTORS.map((s) => ({ value: s, label: SECTOR_LABELS[s] }))} onChange={(v) => setForm({ ...form, sector: v as ProjectSector, sub_sector: undefined })} />
              <SelectField label="Sub-sector" value={form.sub_sector ?? ""} options={(SUBSECTORS_BY_SECTOR[form.sector ?? "others"] ?? []).map((s) => ({ value: s, label: s }))} onChange={(v) => setForm({ ...form, sub_sector: v })} />
              <SelectField label="Stage" value={form.stage ?? "idea"} options={STAGES.map((s) => ({ value: s, label: s }))} onChange={(v) => setForm({ ...form, stage: v as ProjectStage })} />
              <SelectField label="Status" value={form.status ?? "active"} options={["active", "paused", "archived"].map((s) => ({ value: s, label: s }))} onChange={(v) => setForm({ ...form, status: v as Project["status"] })} />
              <Field label="Priority (1=high, 5=low)" value={form.priority?.toString() ?? "3"} onChange={(v) => setForm({ ...form, priority: parseInt(v) || 3 })} type="number" />
              <div className="col-span-2">
                <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">Links</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Website" value={form.website_str ?? ""} onChange={(v) => setForm({ ...form, website_str: v })} placeholder="https://" />
                  <Field label="GitHub" value={form.github_str ?? ""} onChange={(v) => setForm({ ...form, github_str: v })} placeholder="https://github.com/..." />
                  <Field label="Google Drive folder" value={form.drive_str ?? ""} onChange={(v) => setForm({ ...form, drive_str: v })} placeholder="https://drive.google.com/..." />
                  <Field label="Docs" value={form.docs_str ?? ""} onChange={(v) => setForm({ ...form, docs_str: v })} placeholder="https://..." />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-surface-700 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">Cancel</button>
              <button onClick={save} className="px-5 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors">
                {editProject ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const links = project.links ?? {};
  return (
    <div className="bg-surface-800 border border-surface-700 hover:border-surface-600 rounded-xl p-4 transition-colors cursor-pointer" onClick={onEdit}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-surface-100">{project.name}</h3>
          <p className="text-[10px] text-surface-500 mt-0.5 capitalize">{project.sector}{project.sub_sector ? ` / ${project.sub_sector}` : ""}</p>
        </div>
        <StatusBadge status={project.status} size="sm" />
      </div>
      {project.description && <p className="text-xs text-surface-400 line-clamp-2 mb-3">{project.description}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full capitalize">{project.stage}</span>
          <span className="text-[10px] bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">P{project.priority}</span>
        </div>
        <div className="flex items-center gap-2">
          {links.website && <a href={links.website} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><Globe className="w-3.5 h-3.5 text-surface-400 hover:text-surface-200" /></a>}
          {links.github && <a href={links.github} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><Github className="w-3.5 h-3.5 text-surface-400 hover:text-surface-200" /></a>}
          {links.drive_folder && <a href={links.drive_folder} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><FolderOpen className="w-3.5 h-3.5 text-surface-400 hover:text-surface-200" /></a>}
          {links.docs && <a href={links.docs} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><FileText className="w-3.5 h-3.5 text-surface-400 hover:text-surface-200" /></a>}
        </div>
      </div>
    </div>
  );
}

function SectorTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? "bg-accent text-white" : "bg-surface-800 text-surface-400 hover:text-surface-200 border border-surface-700"}`}>
      {label} <span className="ml-1 opacity-60">{count}</span>
    </button>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false, placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-surface-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder}
        className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent disabled:opacity-50" />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-surface-400 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-accent">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
