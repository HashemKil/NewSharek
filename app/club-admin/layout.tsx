"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import ClubAdminSidebar from "../../components/ClubAdminSidebar";

export default function ClubAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [adminName, setAdminName] = useState("");
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkClubAdmin = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, is_club_admin")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.is_club_admin) {
        router.replace("/home");
        return;
      }

      setAdminName(profile.full_name || "Club Admin");
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
    <div className="flex min-h-screen bg-slate-50">
      <ClubAdminSidebar adminName={adminName} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
