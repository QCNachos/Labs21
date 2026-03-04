"use client";

import { clsx } from "clsx";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  // Agent statuses
  idle: { bg: "bg-surface-700/50", text: "text-surface-300", dot: "bg-surface-400" },
  working: { bg: "bg-accent/10", text: "text-accent-light", dot: "bg-accent" },
  thinking: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  offline: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  // Proposal/Mission statuses
  pending: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  accepted: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  rejected: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  running: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  succeeded: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  cancelled: { bg: "bg-surface-700/50", text: "text-surface-400", dot: "bg-surface-500" },
  queued: { bg: "bg-surface-700/50", text: "text-surface-300", dot: "bg-surface-400" },
  skipped: { bg: "bg-surface-700/50", text: "text-surface-400", dot: "bg-surface-500" },
  // Defaults
  default: { bg: "bg-surface-700/50", text: "text-surface-300", dot: "bg-surface-400" },
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  pulse?: boolean;
}

export function StatusBadge({ status, size = "sm", pulse = false }: StatusBadgeProps) {
  const colors = statusColors[status] ?? statusColors.default;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        colors.bg,
        colors.text,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <span
        className={clsx(
          "rounded-full shrink-0",
          colors.dot,
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
          pulse && "pulse-dot"
        )}
      />
      {status}
    </span>
  );
}
