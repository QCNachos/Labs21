"use client";

import { useEffect, useState, useRef } from "react";
import { apiGet } from "@/lib/api";
import { clsx } from "clsx";
import { ChevronDown, Lock, Zap, Brain, Cpu, X } from "lucide-react";

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  tier: "smart" | "fast" | "free";
  ctx: number;
  ctx_label: string;
  cost: string;
  env: string;
  env_label: string;
  description: string;
  available: boolean;
  unavailable_reason: string | null;
}

const TIER_CONFIG = {
  smart: { label: "Smart", icon: Brain, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  fast: { label: "Fast", icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  free: { label: "Free", icon: Cpu, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
};

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  label?: string;
}

export function ModelPicker({ value, onChange, label = "Model" }: ModelPickerProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<ModelInfo[]>("/models").then((data) => {
      setModels(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = models.find((m) => m.id === value);
  const grouped = {
    smart: models.filter((m) => m.tier === "smart"),
    fast: models.filter((m) => m.tier === "fast"),
    free: models.filter((m) => m.tier === "free"),
  };

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-xs text-surface-400 mb-1">{label}</label>}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 bg-surface-900 border border-surface-700 hover:border-surface-500 rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-none focus:border-accent"
      >
        {loading ? (
          <span className="text-surface-500">Loading models…</span>
        ) : selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <TierBadge tier={selected.tier} small />
            <span className="text-surface-100 truncate">{selected.label}</span>
            <span className="text-[10px] text-surface-500 shrink-0">{selected.ctx_label}</span>
            {selected.available ? (
              <span className="text-[10px] text-green-400 shrink-0">{selected.cost}</span>
            ) : (
              <span className="text-[10px] text-red-400 shrink-0">Unavailable</span>
            )}
          </div>
        ) : (
          <span className="text-surface-500">Select a model…</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="p-0.5 text-surface-500 hover:text-surface-300"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl overflow-hidden max-h-[480px] overflow-y-auto admin-scroll">
          {(["smart", "fast", "free"] as const).map((tier) => {
            const group = grouped[tier];
            if (!group.length) return null;
            const cfg = TIER_CONFIG[tier];
            const Icon = cfg.icon;
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-900/50 border-b border-surface-700">
                  <Icon className={`w-3 h-3 ${cfg.color}`} />
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                </div>
                {group.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    selected={model.id === value}
                    onSelect={() => {
                      if (model.available) { onChange(model.id); setOpen(false); }
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelRow({ model, selected, onSelect }: { model: ModelInfo; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!model.available}
      className={clsx(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-surface-700/50 last:border-0",
        selected ? "bg-accent/10" : model.available ? "hover:bg-surface-700/50" : "opacity-40 cursor-not-allowed"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${selected ? "text-accent-light" : model.available ? "text-surface-100" : "text-surface-400"}`}>
            {model.label}
          </span>
          <span className="text-[10px] text-surface-500">{model.provider}</span>
          {selected && <span className="text-[10px] bg-accent/20 text-accent-light px-1.5 py-0.5 rounded-full">Selected</span>}
        </div>
        <p className="text-[11px] text-surface-500 mt-0.5 truncate">{model.description}</p>
        {!model.available && model.unavailable_reason && (
          <p className="text-[11px] text-red-400 mt-0.5 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> {model.unavailable_reason}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-surface-400 bg-surface-700 px-1.5 py-0.5 rounded">{model.ctx_label}</span>
        <span className={`text-[10px] ${model.cost.toLowerCase().includes("free") ? "text-green-400" : "text-surface-400"}`}>
          {model.cost}
        </span>
      </div>
    </button>
  );
}

function TierBadge({ tier, small = false }: { tier: "smart" | "fast" | "free"; small?: boolean }) {
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 border rounded px-1 py-0.5 ${cfg.bg} ${cfg.color} ${small ? "text-[9px]" : "text-[10px]"}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}
