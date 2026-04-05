"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  full_name?: string;
  email?: string;
  student_id?: string;
  major?: string;
  academic_year?: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  avatar_url?: string;
};

type EventCard = {
  id: string;
  title: string;
  category: string;
  date: string;
  rawDate?: string;
  location: string;
  description: string;
};

const fallbackEvents: EventCard[] = [
  {
    id: "1",
    title: "Hackathon 2026",
    category: "Competition",
    date: "20 Mar 2026",
    rawDate: "2026-03-20",
    location: "PSUT Innovation Lab",
    description: "Build a project, meet teammates, and compete with other students.",
  },
  {
    id: "2",
    title: "AI Team Matching Workshop",
    category: "Workshop",
    date: "24 Mar 2026",
    rawDate: "2026-03-24",
    location: "Engineering Building",
    description: "Meet students with similar interests and form stronger project teams.",
  },
  {
    id: "3",
    title: "Startup Pitch Day",
    category: "Event",
    date: "28 Mar 2026",
    rawDate: "2026-03-28",
    location: "Main Auditorium",
    description: "Pitch ideas, watch student startups, and network with peers.",
  },
  {
    id: "4",
    title: "UI/UX Design Meetup",
    category: "Meetup",
    date: "28 Mar 2026",
    rawDate: "2026-03-28",
    location: "Business Hall",
    description: "A student meetup for design thinking, feedback, and collaboration.",
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventCard[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
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

        const { data: existingProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          setError(profileError.message);
          return;
        }

        if (existingProfile) {
          setProfile(existingProfile);
        } else {
          const fallbackName =
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "Student User";

          const newProfile = {
            id: user.id,
            full_name: fallbackName,
            email: user.email || "",
            student_id: "",
            major: "",
            academic_year: "",
            bio: "",
            skills: [],
            interests: [],
            avatar_url: "",
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

          setProfile(insertedProfile ?? newProfile);
        }

        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .order("event_date", { ascending: true })
          .limit(12);

        if (eventsError || !eventsData || eventsData.length === 0) {
          setEvents(fallbackEvents);
          return;
        }

        const mappedEvents: EventCard[] = eventsData.map(
          (event: any, index: number) => ({
            id: event.id ?? String(index),
            title: event.title ?? "Untitled Event",
            category: event.category ?? "Event",
            date: event.event_date
              ? new Date(event.event_date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Date TBD",
            rawDate: event.event_date
              ? new Date(event.event_date).toISOString().split("T")[0]
              : "",
            location: event.location ?? "Location TBD",
            description: event.description ?? "No description available yet.",
          })
        );

        setEvents(mappedEvents);
      } catch {
        setError("Something went wrong while loading your home page.");
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

  const firstName = useMemo(() => {
    return profile?.full_name?.split(" ")[0] || "Student";
  }, [profile]);

  const profileMissing = useMemo(() => {
    const missing = [];
    if (!profile?.student_id) missing.push("Student ID");
    if (!profile?.major) missing.push("Major");
    if (!profile?.academic_year) missing.push("Academic Year");
    if (!profile?.bio) missing.push("Bio");
    if (!profile?.skills?.length) missing.push("Skills");
    if (!profile?.interests?.length) missing.push("Interests");
    return missing;
  }, [profile]);

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;

    const term = search.toLowerCase();

    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(term) ||
        event.category.toLowerCase().includes(term) ||
        event.location.toLowerCase().includes(term) ||
        event.description.toLowerCase().includes(term)
    );
  }, [events, search]);

  const groupedDates = useMemo(() => {
    const map = new Map<string, EventCard[]>();

    filteredEvents.forEach((event) => {
      const key = event.rawDate || event.date;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(event);
    });

    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      items,
      label: items[0]?.rawDate
        ? new Date(items[0].rawDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
          })
        : items[0]?.date || key,
    }));
  }, [filteredEvents]);

  useEffect(() => {
    if (groupedDates.length === 0) {
      setSelectedDate("");
      return;
    }

    const stillExists = groupedDates.some((group) => group.key === selectedDate);
    if (!selectedDate || !stillExists) {
      setSelectedDate(groupedDates[0].key);
    }
  }, [groupedDates, selectedDate]);

  const selectedEvents = useMemo(() => {
    const found = groupedDates.find((group) => group.key === selectedDate);
    return found ? found.items : [];
  }, [groupedDates, selectedDate]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading home page...</p>
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#1e3a8a] via-[#2847a1] to-[#0f766e] p-6 text-white shadow-xl sm:p-8">
              <div className="max-w-2xl">
                <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                  Sharek Home
                </span>

                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Welcome back, {firstName}
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/85 sm:text-base">
                  Discover student activities, browse upcoming events, and stay connected in one simple place.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/events"
                    className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1e3a8a] transition hover:opacity-90"
                  >
                    Explore Events
                  </Link>

                  <Link
                    href="/profile"
                    className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Activities Calendar
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Browse activities by date in a clean timeline.
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search events"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10 sm:max-w-sm"
                />
              </div>

              <div className="mt-6 overflow-x-auto">
                <div className="min-w-max">
                  <div className="relative px-3 py-6">
                    <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-slate-200" />

                    <div className="relative flex items-center gap-8">
                      {groupedDates.map((group) => {
                        const isActive = selectedDate === group.key;

                        return (
                          <button
                            key={group.key}
                            onClick={() => setSelectedDate(group.key)}
                            className="relative flex flex-col items-center text-center"
                          >
                            <span
                              className={`mb-3 text-sm font-semibold ${
                                isActive ? "text-[#1e3a8a]" : "text-slate-500"
                              }`}
                            >
                              {group.label}
                            </span>

                            <span
                              className={`z-10 h-4 w-4 rounded-full border-4 ${
                                isActive
                                  ? "border-[#1e3a8a] bg-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            />

                            <span
                              className={`mt-3 text-xs ${
                                isActive ? "text-[#1e3a8a]" : "text-slate-400"
                              }`}
                            >
                              {group.items.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {selectedEvents.length > 0 ? (
                  selectedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 p-5 transition hover:border-[#1e3a8a] hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <span className="rounded-full bg-[#e8eefc] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                            {event.category}
                          </span>

                          <h3 className="mt-3 text-lg font-semibold text-slate-900">
                            {event.title}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {event.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                            <p>
                              <span className="font-medium text-slate-700">Date:</span>{" "}
                              {event.date}
                            </p>
                            <p>
                              <span className="font-medium text-slate-700">Location:</span>{" "}
                              {event.location}
                            </p>
                          </div>
                        </div>

                        <Link
                          href="/events"
                          className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm text-slate-500">
                      No activities found.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8eefc] text-lg font-bold text-[#1e3a8a]">
                    {(profile?.full_name?.charAt(0) || "S").toUpperCase()}
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {profile?.full_name || "Student User"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {profile?.major || "Major not added"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Logout
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Student ID</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {profile?.student_id || "Not added"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Academic Year</p>
                  <p className="mt-1 font-medium text-slate-700">
                    {profile?.academic_year || "Not added"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Profile
                </h3>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-[#1e3a8a] hover:underline"
                >
                  Edit
                </Link>
              </div>

              {profileMissing.length === 0 ? (
                <p className="mt-4 text-sm text-green-600">
                  Your profile is complete.
                </p>
              ) : (
                <>
                  <p className="mt-4 text-sm text-slate-500">
                    Complete these sections to improve your account:
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profileMissing.map((field) => (
                      <span
                        key={field}
                        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {(profile?.skills?.length || profile?.interests?.length) && (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">
                  Highlights
                </h3>

                {profile?.skills?.length ? (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-slate-500">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-[#eef4ff] px-3 py-1.5 text-xs font-medium text-[#1e3a8a]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {profile?.interests?.length ? (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-slate-500">Interests</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.slice(0, 6).map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full bg-[#ecfdf5] px-3 py-1.5 text-xs font-medium text-[#0f766e]"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}