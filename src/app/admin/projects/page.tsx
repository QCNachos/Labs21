"use client";

import { useState } from "react";
import { Project, ProjectSector, SECTOR_LABELS, SUBSECTORS_BY_SECTOR, ProjectStage } from "@/types/admin";
import { apiPost, apiPut } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Plus, Globe, Github, FolderOpen, FileText, X, ExternalLink, Edit2, Link } from "lucide-react";
import { format } from "date-fns";

const SECTORS: ProjectSector[] = ["trading", "platforms", "marketing", "art", "others"];
const STAGES: ProjectStage[] = ["idea", "mvp", "beta", "launched", "scaling"];

const STAGE_COLOR: Record<string, string> = {
  idea: "text-surface-400 bg-surface-700",
  mvp: "text-blue-400 bg-blue-500/10",
  beta: "text-amber-400 bg-amber-500/10",
  launched: "text-green-400 bg-green-500/10",
  scaling: "text-purple-400 bg-purple-500/10",
};

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ProjectsPage() {
  const { data: projects = [], loading, reload } = useApi<Project[]>("/projects");
  const [activeSector, setActiveSector] = useState<ProjectSector | "all">("all");
  const [viewProject, setViewProject] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState<Partial<Project & { website_str: string; github_str: string; drive_str: string; docs_str: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = activeSector === "all" ? projects : projects.filter((p) => p.sector === activeSector);

  const openNew = () => {
    setForm({ status: "active", stage: "idea", sector: "others", is_active: true, links: {} });
    setEditProject(null);
    setError(null);
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
    setError(null);
    setViewProject(null);
    setShowForm(true);
  };

  const setName = (name: string) => {
    setForm((f) => ({ ...f, name, ...(!editProject && { slug: toSlug(name) }) }));
  };

  const save = async () => {
    if (!form.name?.trim()) { setError("Name is required"); return; }
    const slug = form.slug || toSlug(form.name);
    setSaving(true);
    setError(null);
    try {
      // Strip the UI-only helper fields before sending to API
      const { website_str, github_str, drive_str, docs_str, ...cleanForm } = form;
      const payload = {
        ...cleanForm,
        slug,
        links: {
          ...(cleanForm.links ?? {}),
          ...(website_str ? { website: website_str } : {}),
          ...(github_str ? { github: github_str } : {}),
          ...(drive_str ? { drive_folder: drive_str } : {}),
          ...(docs_str ? { docs: docs_str } : {}),
        },
      };
      if (editProject) {
        await apiPut("/projects", { ...payload, id: editProject.id });
      } else {
        await apiPost("/projects", payload);
      }
      setShowForm(false);
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
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
          {visible.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onView={() => setViewProject(p)}
              onEdit={(e) => { e.stopPropagation(); openEdit(p); }}
            />
          ))}
        </div>
      )}

      {/* Detail view modal */}
      {viewProject && (
        <ProjectDetailModal
          project={viewProject}
          onClose={() => setViewProject(null)}
          onEdit={() => openEdit(viewProject)}
        />
      )}

      {/* Edit / create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-8 overflow-y-auto">
          <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-2xl my-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
              <h2 className="text-base font-semibold text-surface-100">{editProject ? "Edit Project" : "New Project"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-surface-400" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Name *" value={form.name ?? ""} onChange={setName} />
              </div>
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
            <div className="px-6 py-4 border-t border-surface-700 flex items-center justify-between gap-3">
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 ml-auto">
                <button onClick={() => setShowForm(false)} disabled={saving} className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={save} disabled={saving} className="px-5 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors disabled:opacity-60">
                  {saving ? "Saving…" : editProject ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Project card (grid item) ──────────────────────────────────────────────────

function ProjectCard({ project, onView, onEdit }: {
  project: Project;
  onView: () => void;
  onEdit: (e: React.MouseEvent) => void;
}) {
  const links = project.links ?? {};
  const hasLinks = links.website || links.github || links.drive_folder || links.docs;

  return (
    <div
      onClick={onView}
      className="group bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl p-4 transition-all cursor-pointer hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-sm font-semibold text-surface-100 truncate">{project.name}</h3>
          <p className="text-[10px] text-surface-500 mt-0.5 capitalize">
            {SECTOR_LABELS[project.sector]}{project.sub_sector ? ` / ${project.sub_sector}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={project.status} size="sm" />
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-surface-200 hover:bg-surface-700 rounded transition-all"
            title="Edit project"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {project.description && (
        <p className="text-xs text-surface-400 line-clamp-2 mb-3">{project.description}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STAGE_COLOR[project.stage] ?? "text-surface-400 bg-surface-700"}`}>
            {project.stage}
          </span>
          <span className="text-[10px] bg-surface-700 text-surface-400 px-2 py-0.5 rounded-full">P{project.priority}</span>
        </div>
        {hasLinks && (
          <div className="flex items-center gap-2">
            {links.website && <Globe className="w-3.5 h-3.5 text-surface-500" />}
            {links.github && <Github className="w-3.5 h-3.5 text-surface-500" />}
            {links.drive_folder && <FolderOpen className="w-3.5 h-3.5 text-surface-500" />}
            {links.docs && <FileText className="w-3.5 h-3.5 text-surface-500" />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Project detail modal ──────────────────────────────────────────────────────

function ProjectDetailModal({ project, onClose, onEdit }: {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
}) {
  const links = project.links ?? {};
  const linkItems = [
    { href: links.website, label: "Website", icon: Globe },
    { href: links.github, label: "GitHub", icon: Github },
    { href: links.drive_folder, label: "Google Drive", icon: FolderOpen },
    { href: links.docs, label: "Docs", icon: FileText },
    { href: project.pitch_url ?? undefined, label: "Pitch", icon: Link },
  ].filter((l) => l.href);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-8 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-2xl my-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-lg font-semibold text-surface-50">{project.name}</h2>
                <StatusBadge status={project.status} size="sm" />
              </div>
              <p className="text-xs text-surface-500 capitalize">
                {SECTOR_LABELS[project.sector]}{project.sub_sector ? ` › ${project.sub_sector}` : ""}
              </p>
            </div>
            <button onClick={onClose} className="text-surface-400 hover:text-surface-200 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Pill label="Stage" value={project.stage} color={STAGE_COLOR[project.stage]} />
            <Pill label="Priority" value={`P${project.priority}`} />
            <Pill label="Category" value={project.category ?? "—"} />
            {project.created_at && (
              <Pill label="Added" value={format(new Date(project.created_at), "MMM d, yyyy")} />
            )}
          </div>

          {/* Description */}
          {project.description && (
            <div>
              <SectionLabel>Description</SectionLabel>
              <p className="text-sm text-surface-300 leading-relaxed">{project.description}</p>
            </div>
          )}

          {/* Links */}
          {linkItems.length > 0 && (
            <div>
              <SectionLabel>Links</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {linkItems.map(({ href, label, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-600 hover:border-surface-500 rounded-lg text-xs text-surface-200 transition-colors group/link"
                  >
                    <Icon className="w-3.5 h-3.5 text-surface-400 group-hover/link:text-accent-light transition-colors" />
                    {label}
                    <ExternalLink className="w-3 h-3 text-surface-500 group-hover/link:text-surface-300" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tech stack */}
          {project.tech_stack?.length > 0 && (
            <div>
              <SectionLabel>Tech Stack</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {project.tech_stack.map((t) => (
                  <span key={t} className="text-[11px] bg-surface-700 text-surface-300 px-2 py-1 rounded">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Financials */}
          {project.financials && Object.keys(project.financials).length > 0 && (
            <div>
              <SectionLabel>Financials</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                {project.financials.mrr != null && (
                  <FinancialStat label="MRR" value={`$${project.financials.mrr.toLocaleString()}`} />
                )}
                {project.financials.burn_rate != null && (
                  <FinancialStat label="Burn / mo" value={`$${project.financials.burn_rate.toLocaleString()}`} />
                )}
                {project.financials.runway_months != null && (
                  <FinancialStat label="Runway" value={`${project.financials.runway_months} mo`} />
                )}
              </div>
            </div>
          )}

          {/* GitHub repos */}
          {project.github_repos?.length > 0 && (
            <div>
              <SectionLabel>Repositories</SectionLabel>
              <div className="space-y-1">
                {project.github_repos.map((repo) => (
                  <a key={repo} href={repo} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-accent-light hover:underline">
                    <Github className="w-3.5 h-3.5" />{repo.replace("https://github.com/", "")}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Team notes */}
          {project.team_notes && (
            <div>
              <SectionLabel>Team Notes</SectionLabel>
              <p className="text-xs text-surface-400 leading-relaxed">{project.team_notes}</p>
            </div>
          )}

          {/* Agents placeholder */}
          <div>
            <SectionLabel>Assigned Agents</SectionLabel>
            <p className="text-xs text-surface-500 italic">Agent assignments will appear here once agents are active on this project.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-700 flex items-center justify-between">
          <p className="text-[10px] text-surface-600">
            Updated {project.updated_at ? format(new Date(project.updated_at), "MMM d, yyyy 'at' HH:mm") : "—"}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">
              Close
            </button>
            <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded-lg transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-500 mb-2">{children}</p>;
}

function Pill({ label, value, color = "text-surface-300 bg-surface-700" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-surface-500">{label}</span>
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${color}`}>{value}</span>
    </div>
  );
}

function FinancialStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-900 rounded-lg px-3 py-2">
      <p className="text-[10px] text-surface-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-surface-100">{value}</p>
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
