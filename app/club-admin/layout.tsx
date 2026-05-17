"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClubAdminContext } from "../../lib/clubAdmin";
import { supabase } from "../../lib/supabase";
import ClubAdminSidebar from "../../components/ClubAdminSidebar";

// Provides the protected club-admin page structure and sidebar.
export default function ClubAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [adminName, setAdminName] = useState("");
  const [clubName, setClubName] = useState("");
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Defines the check club admin helper used by this screen.
    const checkClubAdmin = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, is_club_admin")
        .eq("id", user.id)
        .maybeSingle();
      const context = await getClubAdminContext();
      const resolvedClub = context.managedClub;
      const finalClubName =
        resolvedClub?.name?.trim() || resolvedClub?.title?.trim() || "";

      setAdminName(profile?.full_name || "Club Admin");
      setClubName(finalClubName);
      setAuthorized(true);
      setChecking(false);
    };

    checkClubAdmin();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a8a] border-t-transparent" />
          <p className="text-sm text-slate-500">Verifying club admin access...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <ClubAdminSidebar adminName={adminName} clubName={clubName} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
