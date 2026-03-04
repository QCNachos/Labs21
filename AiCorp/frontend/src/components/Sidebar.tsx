"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Users,
  FileText,
  Target,
  Activity,
  Settings,
  Zap,
  Inbox,
  MessageSquare,
  FolderKanban,
} from "lucide-react";

const navSections = [
  {
    label: "Board Director",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/briefings", label: "Briefings", icon: Inbox },
      { href: "/command", label: "Command", icon: MessageSquare },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/stage", label: "Stage", icon: Zap },
      { href: "/agents", label: "Agents", icon: Users },
      { href: "/projects", label: "Projects", icon: FolderKanban },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/proposals", label: "Proposals", icon: FileText },
      { href: "/missions", label: "Missions", icon: Target },
      { href: "/events", label: "Events", icon: Activity },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-surface-900 border-r border-surface-700 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-surface-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-surface-50">AiCorp</h1>
            <p className="text-[10px] text-surface-400 leading-none">
              Board Director View
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-accent/10 text-accent-light font-medium"
                        : "text-surface-400 hover:text-surface-200 hover:bg-surface-800"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div className="p-4 border-t border-surface-700">
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
          8 Agents Active
        </div>
      </div>
    </aside>
  );
}
