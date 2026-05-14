"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [adminName, setAdminName] = useState<string>("");
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      // Step 1: Get the currently logged-in user from Supabase Auth
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // If not logged in at all, send them to login
      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // Step 2: Look up their profile to check if is_admin is true
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, is_admin")
        .eq("id", user.id)
        .single();

      // If profile fetch failed or they are NOT an admin → kick them out
      if (profileError || !profile?.is_admin) {
        router.replace("/home");
        return;
      }

      // Step 3: They passed! Allow access and store their name for the sidebar
      setAdminName(profile.full_name || "Admin");
      setAuthorized(true);
      setChecking(false);
    };

    checkAdmin();
  }, [router]);

  // While we're checking, show a blank loading screen
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a8a] border-t-transparent" />
          <p className="text-sm text-slate-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not authorized — render nothing (router.replace is handling the redirect)
  if (!authorized) return null;

  // Authorized — render the full admin layout: sidebar on left, page content on right
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <AdminSidebar adminName={adminName} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
