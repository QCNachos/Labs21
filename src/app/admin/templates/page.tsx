"use client";

import { useState, useMemo, useCallback } from "react";
import { Template, TemplateVariable, TemplateType } from "@/types/admin";
import { useApi } from "@/hooks/useApi";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Code,
  Save,
  X,
  Variable,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TEMPLATE_TYPES: TemplateType[] = [
  "proposal",
  "report",
  "email",
  "estimate",
  "general",
];

const TYPE_COLORS: Record<TemplateType, string> = {
  proposal: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  report: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  email: "text-green-400 bg-green-500/10 border-green-500/20",
  estimate: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  general: "text-surface-400 bg-surface-700 border-surface-600",
};

const STARTER_TEMPLATES: Omit<Template, "id" | "created_at" | "updated_at">[] =
  [
    {
      name: "Client Proposal",
      type: "proposal",
      version: 1,
      body: `Dear {{client_name}},

Thank you for your interest. Below is our proposal for the project.

## Project Scope
{{project_scope}}

## Timeline
{{timeline}}

## Investment
Total: {{total_price}}

We look forward to working with you.`,
      variables: [
        { key: "client_name", label: "Client Name", default_value: "Acme Corp" },
        {
          key: "project_scope",
          label: "Project Scope",
          default_value: "Full-stack web application with admin dashboard",
        },
        {
          key: "total_price",
          label: "Total Price",
          default_value: "$15,000",
        },
        {
          key: "timeline",
          label: "Timeline",
          default_value: "6 weeks",
        },
      ],
      metadata: {},
    },
    {
      name: "Weekly Report",
      type: "report",
      version: 1,
      body: `# Weekly Report - Week {{week_number}}

## Highlights
{{highlights}}

## Blockers
{{blockers}}

## Next Steps
{{next_steps}}`,
      variables: [
        { key: "week_number", label: "Week Number", default_value: "1" },
        {
          key: "highlights",
          label: "Highlights",
          default_value: "- Completed feature X\n- Deployed to staging",
        },
        {
          key: "blockers",
          label: "Blockers",
          default_value: "- Waiting on API access",
        },
        {
          key: "next_steps",
          label: "Next Steps",
          default_value: "- Begin integration testing\n- UI polish",
        },
      ],
      metadata: {},
    },
  ];

type FilterTab = "all" | TemplateType;

const EMPTY_VARIABLE: TemplateVariable = {
  key: "",
  label: "",
  default_value: "",
};

function blankForm(): Omit<Template, "id" | "created_at" | "updated_at"> {
  return {
    name: "",
    type: "general",
    version: 1,
    body: "",
    variables: [],
    metadata: {},
  };
}

function renderBody(body: string, vars: Record<string, string>): string {
  let result = body;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
}

export default function TemplatesPage() {
  const {
    data: templates = [],
    loading,
    reload,
  } = useApi<Template[]>("/admin?resource=templates");

  const [filter, setFilter] = useState<FilterTab>("all");
  const [editing, setEditing] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [renderedOutput, setRenderedOutput] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return templates;
    return templates.filter((t) => t.type === filter);
  }, [templates, filter]);

  const openNew = useCallback(() => {
    setForm(blankForm());
    setEditing(null);
    setIsNew(true);
    setError(null);
    setShowPreview(false);
    setRenderedOutput(null);
  }, []);

  const openEdit = useCallback((t: Template) => {
    setForm({
      name: t.name,
      type: t.type,
      version: t.version,
      body: t.body,
      variables: t.variables.map((v) => ({ ...v })),
      metadata: { ...t.metadata },
    });
    setEditing(t);
    setIsNew(false);
    setError(null);
    setShowPreview(false);
    setRenderedOutput(null);
  }, []);

  const openFromStarter = useCallback(
    (s: (typeof STARTER_TEMPLATES)[number]) => {
      setForm({
        ...s,
        variables: s.variables.map((v) => ({ ...v })),
        metadata: { ...s.metadata },
      });
      setEditing(null);
      setIsNew(true);
      setError(null);
      setShowPreview(false);
      setRenderedOutput(null);
    },
    []
  );

  const closeEditor = useCallback(() => {
    setEditing(null);
    setIsNew(false);
    setError(null);
  }, []);

  const updateVariable = (
    idx: number,
    field: keyof TemplateVariable,
    value: string
  ) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.map((v, i) =>
        i === idx ? { ...v, [field]: value } : v
      ),
    }));
  };

  const addVariable = () => {
    setForm((f) => ({
      ...f,
      variables: [...f.variables, { ...EMPTY_VARIABLE }],
    }));
  };

  const removeVariable = (idx: number) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.filter((_, i) => i !== idx),
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.body.trim()) {
      setError("Body is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await apiPut("/admin?resource=templates", {
          id: editing.id,
          ...form,
        });
      } else {
        await apiPost("/admin?resource=templates", form);
      }
      await reload();
      closeEditor();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm("Delete this template permanently?")) return;
    setDeleting(true);
    try {
      await apiDelete(`/admin?resource=templates&id=${editing.id}`);
      await reload();
      closeEditor();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const openPreview = (t: Template) => {
    setPreviewTemplate(t);
    const vars: Record<string, string> = {};
    for (const v of t.variables) {
      vars[v.key] = v.default_value ?? "";
    }
    setPreviewVars(vars);
    setRenderedOutput(null);
    setShowPreview(true);
  };

  const renderTemplate = async () => {
    if (!previewTemplate) return;
    setRendering(true);
    try {
      const res = await apiPost<{ rendered_body: string }>(
        "/admin?resource=render",
        {
          template_id: previewTemplate.id,
          variables: previewVars,
        }
      );
      setRenderedOutput(res.rendered_body);
    } catch {
      setRenderedOutput(renderBody(previewTemplate.body, previewVars));
    } finally {
      setRendering(false);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewTemplate(null);
    setRenderedOutput(null);
  };

  const livePreview = useMemo(() => {
    const vars: Record<string, string> = {};
    for (const v of form.variables) {
      vars[v.key] = v.default_value ?? `{{${v.key}}}`;
    }
    return renderBody(form.body, vars);
  }, [form.body, form.variables]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-surface-500 text-sm">
        Loading...
      </div>
    );
  }

  const isEditorOpen = editing !== null || isNew;

  // ---- Preview Modal ----
  if (showPreview && previewTemplate) {
    return (
      <div className="p-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-accent-light" />
            <h1 className="text-2xl font-semibold text-surface-50">
              Preview: {previewTemplate.name}
            </h1>
          </div>
          <button
            onClick={closePreview}
            className="p-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Variable inputs */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
              <Variable className="w-4 h-4" /> Variables
            </h2>
            {previewTemplate.variables.map((v) => (
              <div key={v.key}>
                <label className="block text-xs text-surface-400 mb-1">
                  {v.label}{" "}
                  <span className="text-surface-600 font-mono">
                    {`{{${v.key}}}`}
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={previewVars[v.key] ?? ""}
                  onChange={(e) =>
                    setPreviewVars((p) => ({ ...p, [v.key]: e.target.value }))
                  }
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:border-accent focus:outline-none resize-none"
                />
              </div>
            ))}
            <button
              onClick={renderTemplate}
              disabled={rendering}
              className="w-full px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {rendering ? "Rendering..." : "Render Template"}
            </button>
          </div>

          {/* Output */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-surface-200 mb-3 flex items-center gap-2">
              <Code className="w-4 h-4" /> Output
            </h2>
            <pre className="text-sm text-surface-300 whitespace-pre-wrap leading-relaxed font-mono bg-surface-900 border border-surface-700 rounded-lg p-4 min-h-[200px]">
              {renderedOutput ??
                renderBody(previewTemplate.body, previewVars)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ---- Editor ----
  if (isEditorOpen) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit2 className="w-5 h-5 text-accent-light" />
            <h1 className="text-2xl font-semibold text-surface-50">
              {editing ? `Edit: ${editing.name}` : "New Template"}
            </h1>
          </div>
          <button
            onClick={closeEditor}
            className="p-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-5">
            {/* Name + Type */}
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Template name"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as TemplateType,
                    }))
                  }
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:border-accent focus:outline-none"
                >
                  {TEMPLATE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Variables */}
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                  <Variable className="w-4 h-4" /> Variables
                </h2>
                <button
                  onClick={addVariable}
                  className="flex items-center gap-1 text-xs text-accent-light hover:text-accent transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {form.variables.length === 0 && (
                <p className="text-xs text-surface-500">
                  No variables yet. Add one to use{" "}
                  <code className="text-accent-light">{`{{key}}`}</code> syntax
                  in the body.
                </p>
              )}

              {form.variables.map((v, i) => (
                <div
                  key={i}
                  className="flex gap-2 items-start bg-surface-900 border border-surface-700 rounded-lg p-3"
                >
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={v.key}
                        onChange={(e) => updateVariable(i, "key", e.target.value)}
                        placeholder="key"
                        className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-surface-200 font-mono focus:border-accent focus:outline-none"
                      />
                      <input
                        value={v.label}
                        onChange={(e) =>
                          updateVariable(i, "label", e.target.value)
                        }
                        placeholder="Label"
                        className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-surface-200 focus:border-accent focus:outline-none"
                      />
                    </div>
                    <input
                      value={v.default_value ?? ""}
                      onChange={(e) =>
                        updateVariable(i, "default_value", e.target.value)
                      }
                      placeholder="Default value"
                      className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-surface-200 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => removeVariable(i)}
                    className="p-1 text-surface-500 hover:text-red-400 transition-colors shrink-0 mt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
              <label className="block text-xs font-medium text-surface-400 mb-2">
                Body{" "}
                <span className="text-surface-600 font-normal">
                  &mdash; use{" "}
                  <code className="text-accent-light">{`{{variable_key}}`}</code>{" "}
                  for placeholders
                </span>
              </label>
              <textarea
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={14}
                placeholder="Write your template body here..."
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 font-mono leading-relaxed focus:border-accent focus:outline-none resize-none"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="space-y-5">
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 sticky top-8">
              <h2 className="text-sm font-semibold text-surface-200 mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" /> Live Preview
              </h2>
              <pre className="text-sm text-surface-300 whitespace-pre-wrap leading-relaxed font-mono bg-surface-900 border border-surface-700 rounded-lg p-4 min-h-[300px] max-h-[600px] overflow-y-auto">
                {livePreview || (
                  <span className="text-surface-600 italic">
                    Start typing to see preview...
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {editing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={closeEditor}
              className="px-4 py-2 bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- List View ----
  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-50">Templates</h1>
          <p className="text-sm text-surface-400 mt-1">
            {templates.length} template{templates.length !== 1 && "s"}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(["all", ...TEMPLATE_TYPES] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === t
                ? "bg-accent text-white"
                : "bg-surface-800 text-surface-400 hover:text-surface-200 border border-surface-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="text-center py-20 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center">
              <FileText className="w-8 h-8 text-surface-500" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-200">
              Create your first template
            </h2>
            <p className="text-sm text-surface-500 mt-1 max-w-md mx-auto">
              Templates let you generate proposals, reports, emails, and
              estimates with reusable variable placeholders.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/80 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Blank Template
            </button>
          </div>

          {/* Starters */}
          <div className="pt-4">
            <p className="text-xs text-surface-500 mb-3">
              Or start from a template
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              {STARTER_TEMPLATES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => openFromStarter(s)}
                  className="bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl p-4 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-surface-500 group-hover:text-accent-light transition-colors" />
                    <span className="text-sm font-medium text-surface-200">
                      {s.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${TYPE_COLORS[s.type as TemplateType]}`}
                    >
                      {s.type}
                    </span>
                    <span className="text-[10px] text-surface-500">
                      {s.variables.length} variables
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-surface-500 text-sm">
          No templates match this filter
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-surface-500" />
                  <h3 className="text-sm font-semibold text-surface-100">
                    {t.name}
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border ${TYPE_COLORS[t.type]}`}
                >
                  {t.type}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-surface-500 mb-4">
                <span>v{t.version}</span>
                <span className="w-1 h-1 rounded-full bg-surface-600" />
                <span className="flex items-center gap-1">
                  <Variable className="w-3 h-3" />
                  {t.variables.length} var{t.variables.length !== 1 && "s"}
                </span>
                <span className="w-1 h-1 rounded-full bg-surface-600" />
                <span>
                  {formatDistanceToNow(new Date(t.updated_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-surface-100 text-xs rounded-lg transition-colors"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => openPreview(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-surface-100 text-xs rounded-lg transition-colors"
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Starter suggestions when templates exist but few */}
      {templates.length > 0 && templates.length < 5 && (
        <div className="border-t border-surface-700 pt-6">
          <p className="text-xs text-surface-500 mb-3">
            Quick-start templates
          </p>
          <div className="flex gap-3 flex-wrap">
            {STARTER_TEMPLATES.filter(
              (s) => !templates.some((t) => t.name === s.name)
            ).map((s) => (
              <button
                key={s.name}
                onClick={() => openFromStarter(s)}
                className="flex items-center gap-2 px-3 py-2 bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl text-xs text-surface-400 hover:text-surface-200 transition-colors"
              >
                <Plus className="w-3 h-3" /> {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
