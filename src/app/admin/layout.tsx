import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/Sidebar";

export const metadata: Metadata = {
  title: "Labs21 Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-900 text-surface-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto grid-bg admin-scroll">
        {children}
      </main>
    </div>
  );
}
