"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type ProfileReminder = {
  missingFields: string[];
};

const isBlank = (value: string | null | undefined) => !value?.trim();

// The navbar owns the profile reminder because it is shared across every
// signed-in page and should stay consistent as students move around the app.
const getMissingProfileFields = (profile: {
  full_name?: string | null;
  phone_number?: string | null;
  student_id?: string | null;
  major?: string | null;
  academic_year?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
}) => {
  const missing: string[] = [];

  if (isBlank(profile.full_name)) missing.push("Full name");
  if (isBlank(profile.phone_number)) missing.push("Phone number");
  if (isBlank(profile.student_id)) missing.push("Student ID");
  if (isBlank(profile.major)) missing.push("Major");
  if (isBlank(profile.academic_year)) missing.push("Academic year");
  if (isBlank(profile.bio)) missing.push("Bio");
  if (!profile.skills?.length) missing.push("Skills");
  if (!profile.interests?.length) missing.push("Interests");

  return missing;
};

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClubAdmin, setIsClubAdmin] = useState(false);
  const [profileReminder, setProfileReminder] =
    useState<ProfileReminder | null>(null);

  // Load the current user's navigation permissions and profile reminder state.
  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [{ data: profile }, { data: assignedClub }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "is_admin, full_name, phone_number, student_id, major, academic_year, bio, skills, interests"
          )
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
      setIsClubAdmin(Boolean(assignedClub?.id));

      if (profile) {
        const missingFields = getMissingProfileFields(profile);
        setProfileReminder(
          missingFields.length > 0 ? { missingFields } : null
        );
      }
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

          {/* Admin link - only visible to admins */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                pathname.startsWith("/admin")
                  ? "bg-amber-50 text-amber-700"
                  : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              }`}
            >
              Admin
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

      {profileReminder && (
        <div className="border-t border-amber-100 bg-amber-50">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            <p>
              Complete your profile so clubs and event organizers can review
              your information. Missing:{" "}
              <span className="font-semibold">
                {profileReminder.missingFields.slice(0, 3).join(", ")}
                {profileReminder.missingFields.length > 3
                  ? ` +${profileReminder.missingFields.length - 3} more`
                  : ""}
              </span>
              .
            </p>
            <Link
              href="/profile"
              className="w-fit rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
            >
              Complete profile
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

