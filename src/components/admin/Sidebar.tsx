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
  Building2,
  CalendarRange,
  Home,
  BarChart3,
  FileCode,
} from "lucide-react";

const navSections = [
  {
    label: "Board Director",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/request", label: "Request Work", icon: Zap },
      { href: "/admin/briefings", label: "Briefings", icon: Inbox },
      { href: "/admin/command", label: "Command", icon: MessageSquare },
      { href: "/admin/board", label: "Board Meetings", icon: CalendarRange },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/admin/agents", label: "Agents", icon: Users },
      { href: "/admin/departments", label: "Departments", icon: Building2 },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/admin/projects", label: "Projects", icon: FolderKanban },
      { href: "/admin/templates", label: "Templates", icon: FileCode },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/admin/proposals", label: "Proposals", icon: FileText },
      { href: "/admin/missions", label: "Missions", icon: Target },
      { href: "/admin/events", label: "Events", icon: Activity },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/usage", label: "Usage", icon: BarChart3 },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-surface-900 border-r border-surface-700 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-surface-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-xs">L21</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-surface-50">Labs21</h1>
            <p className="text-[10px] text-surface-400 leading-none">Board Director</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto admin-scroll">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = (item as { exact?: boolean }).exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
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

      {/* Footer */}
      <div className="p-4 border-t border-surface-700 space-y-2">
        <Link href="/" className="flex items-center gap-2 text-xs text-surface-500 hover:text-surface-300 transition-colors">
          <Home className="w-3 h-3" />
          Back to labs21.xyz
        </Link>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
          System online
        </div>
      </div>
    </aside>
  );
}
