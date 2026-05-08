"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClubAdmin, setIsClubAdmin] = useState(false);

  // On mount, check if the logged-in user is an admin
  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [{ data: profile }, { data: assignedClub }] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_admin, is_club_admin")
          .eq("id", user.id)
          .single(),
        supabase
          .from("clubs")
          .select("id")
          .eq("club_admin_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);

      setIsAdmin(profile?.is_admin === true);
      setIsClubAdmin(profile?.is_club_admin === true || Boolean(assignedClub?.id));
    };

    checkAdmin();
  }, []);

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
      <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">

        {/* Logo */}
        <Link href="/home" className="flex items-center">
          <Image
            src="/brand/sharek-logo-cropped.png"
            alt="Sharek"
            width={210}
            height={80}
            priority
            className="h-12 w-auto object-contain"
          />
        </Link>
        <div className="sr-only">
          <h1>Sharek</h1>
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

          {/* Admin link â€” only visible to admins */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                pathname.startsWith("/admin")
                  ? "bg-amber-50 text-amber-700"
                  : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              }`}
            >
              âš™ Admin
            </Link>
          )}

          {isClubAdmin && (
            <Link
              href="/club-admin"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                pathname.startsWith("/club-admin")
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              Club Admin
            </Link>
          )}

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

