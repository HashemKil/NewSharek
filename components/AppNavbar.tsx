"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Home", href: "/home" },
    { name: "Events", href: "/events" },
    { name: "Clubs", href: "/clubs" },
    { name: "Teams", href: "/teams" },
    { name: "Profile", href: "/profile" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        
        {/* Logo */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-[#1e3a8a]">
            Sharek
          </h1>
          <p className="text-xs text-gray-400">
            PSUT Collaboration Platform
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#eef3ff] text-[#1e3a8a]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-[#1e3a8a]"
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="mx-2 h-6 w-px bg-gray-200" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
