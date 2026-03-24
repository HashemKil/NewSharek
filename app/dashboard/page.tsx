"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

const quickLinks = [
  { title: "Events", href: "/events" },
  { title: "Teams", href: "/teams" },
  { title: "My Profile", href: "/profile" },
  { title: "Announcements", href: "#" },
  { title: "My Requests", href: "#" },
  { title: "Saved Opportunities", href: "#" },
];

const featuredEvents = [
  {
    title: "Hackathon 2026",
    type: "Competition",
    date: "20/03/2026",
  },
  {
    title: "AI Team Matching Workshop",
    type: "Workshop",
    date: "24/03/2026",
  },
  {
    title: "Startup Pitch Day",
    type: "Event",
    date: "28/03/2026",
  },
];

type Profile = {
  id: string;
  name: string;
  major: string;
  year: string;
  bio: string;
  skills: string[];
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        setUserEmail(user.email ?? "");

        const { data: existingProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (existingProfile) {
          setProfile(existingProfile);
          return;
        }

        if (profileError && profileError.code !== "PGRST116") {
          setError(profileError.message);
          return;
        }

        const fallbackName =
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Student User";

        const fallbackMajor = user.user_metadata?.major || "Not specified";

        const newProfile = {
          id: user.id,
          name: fallbackName,
          major: fallbackMajor,
          year: "",
          bio: "",
          skills: [],
        };

        const { data: insertedProfile, error: insertError } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();

        if (insertError) {
          setError(insertError.message);
          return;
        }

        setProfile(insertedProfile);
      } catch {
        setError("Something went wrong while loading your dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f2f4f7]">
        <AppNavbar />
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            Loading dashboard...
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f2f4f7]">
        <AppNavbar />
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            {error}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2f4f7]">
      <AppNavbar />

      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-xl border bg-white p-6 transition hover:border-[#1e3a8a] hover:shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border font-semibold text-[#1e3a8a]">
                {item.title.charAt(0)}
              </div>
              <h3 className="text-lg font-semibold text-[#1e3a8a]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Open {item.title.toLowerCase()} section
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-xl border bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-[#1e3a8a]">
              Featured University Activities
            </h3>
            <Link href="/events" className="text-sm text-[#0f766e] hover:underline">
              View all
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredEvents.map((event) => (
              <div
                key={event.title}
                className="rounded-xl border bg-[#fbfcfe] p-5"
              >
                <div className="mb-3 inline-block rounded-md bg-[#e8eefc] px-3 py-1 text-xs font-medium text-[#1e3a8a]">
                  {event.type}
                </div>

                <h4 className="min-h-[56px] text-lg font-semibold text-[#1e3a8a]">
                  {event.title}
                </h4>

                <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
                  <span>Date</span>
                  <span className="font-medium text-gray-700">{event.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}