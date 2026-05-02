"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type ClubAdminSidebarProps = {
  adminName?: string;
  clubName?: string;
};

export default function ClubAdminSidebar({
  adminName,
  clubName,
}: ClubAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      label: "Dashboard",
      href: "/club-admin",
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      label: "Members",
      href: "/club-admin/members",
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Events",
      href: "/club-admin/events",
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      label: "Club Details",
      href: "/club-admin/details",
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 5 5 9l7 4 7-4-7-4Z" />
          <path d="M5 13l7 4 7-4" />
          <path d="M5 17l7 4 7-4" />
        </svg>
      ),
    },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = adminName
    ? adminName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "CA";

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a8a]">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Sharek</p>
          <p className="text-xs text-slate-400">Club Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Club Management
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/club-admin"
                ? pathname === "/club-admin"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#eef3ff] text-[#1e3a8a]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className={isActive ? "text-[#1e3a8a]" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Platform
          </p>
          <Link
            href="/clubs"
            className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="text-slate-400">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 5 5 9l7 4 7-4-7-4Z" />
                <path d="M5 13l7 4 7-4" />
                <path d="M5 17l7 4 7-4" />
              </svg>
            </span>
            Public Clubs
          </Link>
          <Link
            href="/home"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="text-slate-400">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            Back to App
          </Link>
        </div>
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-sm font-bold text-[#1e3a8a]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
              {clubName || "No Club Assigned"}
            </p>
            <p className="truncate text-sm font-medium text-slate-900">
              {adminName || "Club Admin"}
            </p>
            <p className="text-xs text-slate-400">Club Administrator</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
