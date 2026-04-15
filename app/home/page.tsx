"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  student_id?: string | null;
  major?: string | null;
  academic_year?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
};

type EventRow = {
  id: string;
  title?: string | null;
  category?: string | null;
  description?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  is_team_based?: boolean | null;
  is_university_event?: boolean | null;
};

type ClubRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  category?: string | null;
  description?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  event: string | null;
  owner_id: string | null;
  is_open_to_members?: boolean | null;
};

type TeamMemberRow = {
  team_id: string;
  user_id: string;
  status: string | null;
  teams?: TeamRow | TeamRow[] | null;
};

type EventRegistrationRow = {
  event_id: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Date not set";
  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1);

  if (!year || Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "";
  const [hours, minutes] = value.split(":");
  const parsed = new Date();
  parsed.setHours(Number(hours), Number(minutes || 0), 0, 0);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getClubName = (club: ClubRow) =>
  club.name?.trim() || club.title?.trim() || "Untitled club";

const getTeamFromMembership = (membership: TeamMemberRow) =>
  Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventRefs, setEventRefs] = useState<Pick<EventRow, "id" | "title">[]>([]);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistrationRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [memberships, setMemberships] = useState<TeamMemberRow[]>([]);

  useEffect(() => {
    const loadHome = async () => {
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

        const [
          profileResult,
          eventsResult,
          eventRefsResult,
          eventRegistrationsResult,
          clubsResult,
          teamsResult,
          membershipsResult,
        ] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", user.id).single(),
            supabase
              .from("events")
              .select(
                "id, title, category, description, event_date, start_time, end_time, location, is_team_based, is_university_event"
              )
              .order("event_date", { ascending: true })
              .limit(6),
            supabase.from("events").select("id, title"),
            supabase
              .from("event_registrations")
              .select("event_id")
              .eq("user_id", user.id),
            supabase.from("clubs").select("*").limit(6),
            supabase.from("teams").select("*").order("created_at", { ascending: false }).limit(6),
            supabase
              .from("team_members")
              .select("team_id, user_id, status, teams(*)")
              .eq("user_id", user.id)
              .neq("status", "rejected"),
          ]);

        if (profileResult.error) {
          setError(profileResult.error.message);
          return;
        }

        setProfile(profileResult.data as Profile);
        setEvents(((eventsResult.data || []) as EventRow[]).filter(Boolean));
        setEventRefs(((eventRefsResult.data || []) as Pick<EventRow, "id" | "title">[]).filter(Boolean));
        setEventRegistrations(
          ((eventRegistrationsResult.data || []) as EventRegistrationRow[]).filter(Boolean)
        );
        setClubs(((clubsResult.data || []) as ClubRow[]).filter(Boolean));
        setTeams(((teamsResult.data || []) as TeamRow[]).filter(Boolean));
        setMemberships(((membershipsResult.data || []) as TeamMemberRow[]).filter(Boolean));
      } catch (err) {
        console.error("HOME LOAD ERROR:", err);
        setError("Something went wrong while loading your home page.");
      } finally {
        setLoading(false);
      }
    };

    loadHome();
  }, [router]);

  const firstName = useMemo(() => {
    return profile?.full_name?.trim().split(" ")[0] || "Student";
  }, [profile?.full_name]);

  const myTeams = useMemo(() => {
    const membershipTeams = memberships
      .map(getTeamFromMembership)
      .filter(Boolean) as TeamRow[];
    const ownedTeams = teams.filter((team) => team.owner_id === profile?.id);
    const byId = new Map<string, TeamRow>();

    [...ownedTeams, ...membershipTeams].forEach((team) => byId.set(team.id, team));
    return Array.from(byId.values()).slice(0, 4);
  }, [memberships, profile?.id, teams]);

  const joinedEventsCount = useMemo(() => {
    const joined = new Set(eventRegistrations.map((registration) => registration.event_id));
    const eventIdByTitle = new Map(
      eventRefs
        .filter((event) => event.title)
        .map((event) => [event.title!.toLowerCase(), event.id])
    );

    memberships.forEach((membership) => {
      const team = getTeamFromMembership(membership);
      const eventTitle = team?.event?.toLowerCase();
      const eventId = eventTitle ? eventIdByTitle.get(eventTitle) : undefined;

      if (eventId) {
        joined.add(eventId);
      }
    });

    return joined.size;
  }, [eventRefs, eventRegistrations, memberships]);

  const initials =
    profile?.full_name?.trim().charAt(0).toUpperCase() ||
    profile?.email?.trim().charAt(0).toUpperCase() ||
    "S";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading home...</p>
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
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase text-[#1e3a8a]">
                  PSUT news
                </p>
                <h1 className="mt-1 text-3xl font-bold text-slate-950">
                  Stay close to what is happening on campus
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  Follow university announcements, student activities, and club updates in one place.
                </p>
              </div>
              <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                Latest
              </span>

            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Student activities
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  New events and workshops will appear as clubs publish them.
                </p>
              </div>
              <div className="rounded-lg bg-[#eef3ff] p-4">
                <p className="text-sm font-semibold text-[#1e3a8a]">
                  Club updates
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Check the Clubs page for active groups and announcements.
                </p>
              </div>
              <div className="rounded-lg bg-sky-50 p-4">
                <p className="text-sm font-semibold text-sky-700">
                  Team notices
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Team requests and member changes are managed from Teams.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-2xl font-bold text-[#1e3a8a]">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-[#1e3a8a]">
                  Home
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  Welcome back, {firstName}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {profile?.major || "Major not added"} -{" "}
                  {profile?.academic_year || "Academic year not added"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-100 p-4">
                <p className="text-sm font-medium text-slate-500">Upcoming events</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{events.length}</p>
              </div>
              <div className="rounded-lg bg-[#eef3ff] p-4">
                <p className="text-sm font-medium text-[#1e3a8a]">My teams</p>
                <p className="mt-2 text-2xl font-bold text-[#1e3a8a]">{myTeams.length}</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-4">
                <p className="text-sm font-medium text-sky-700">Joined events</p>
                <p className="mt-2 text-2xl font-bold text-sky-700">
                  {joinedEventsCount}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Upcoming events</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Events ordered by date.
                </p>
              </div>
              <Link
                href="/events"
                className="text-sm font-semibold text-[#1e3a8a] hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {events.length > 0 ? (
                events.map((event) => {
                  const timeLabel =
                    event.start_time && event.end_time
                      ? `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`
                      : formatTime(event.start_time) || "Time not set";

                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block rounded-2xl border border-slate-200 p-4 transition hover:border-[#1e3a8a]/40 hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {event.category || "Event"}
                            </span>
                            <span className="rounded-full border border-[#c7d5fb] bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                              {event.is_team_based ? "Team based" : "Solo based"}
                            </span>
                          </div>
                          <h3 className="mt-3 font-bold text-slate-950">
                            {event.title || "Untitled event"}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                            {event.description || "No description added."}
                          </p>
                        </div>

                        <div className="shrink-0 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
                          <p className="font-semibold">{formatDate(event.event_date)}</p>
                          <p className="mt-1 text-xs text-slate-500">{timeLabel}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No events yet.
                </div>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-950">Clubs</h2>
                <Link
                  href="/clubs"
                  className="text-sm font-semibold text-[#1e3a8a] hover:underline"
                >
                  Browse
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {clubs.length > 0 ? (
                  clubs.map((club) => {
                    const logo = club.logo_url || club.image_url || "";
                    const clubName = getClubName(club);

                    return (
                      <div
                        key={club.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"
                      >
                        {logo ? (
                          <div
                            aria-label={`${clubName} logo`}
                            className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-cover bg-center"
                            style={{ backgroundImage: `url(${logo})` }}
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] font-bold text-[#1e3a8a]">
                            {clubName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{clubName}</p>
                          <p className="text-xs text-slate-500">
                            {club.category || "Club"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">No clubs found.</p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-950">Teams</h2>
                <Link
                  href="/teams"
                  className="text-sm font-semibold text-[#1e3a8a] hover:underline"
                >
                  Manage
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {myTeams.length > 0 ? (
                  myTeams.map((team) => (
                    <div
                      key={team.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <p className="font-semibold text-slate-950">{team.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {team.event || "No event assigned"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <p className="text-sm text-slate-500">
                      You are not in a team yet.
                    </p>
                    <Link
                      href="/teams"
                      className="mt-3 inline-flex rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Find teams
                    </Link>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
