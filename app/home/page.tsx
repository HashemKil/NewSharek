"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { mergeJoinedClubs } from "../../lib/clubMembership";
import { inferEventCategory } from "../../lib/eventCategories";
import { supabase } from "../../lib/supabase";
import { formatTagLabel } from "../../lib/tagLabels";

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

type CarouselItem = {
  label: string;
  title: string;
  body: string;
  image: string;
  url?: string | null;
};

type EventRow = {
  id: string;
  title?: string | null;
  category?: string | null;
  description?: string | null;
  event_date?: string | null;
  end_date?: string | null;
  registration_deadline?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  approval_status?: string | null;
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

type ClubMembershipRow = {
  club_id: string;
  clubs?: ClubRow | ClubRow[] | null;
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

const getClubFromMembership = (membership: ClubMembershipRow) =>
  Array.isArray(membership.clubs) ? membership.clubs[0] : membership.clubs;

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find .* column/i.test(error.message ?? "")
  );
}

const parseDateOnly = (value?: string | null) => {
  if (!value) return null;
  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isOpenForRegistration = (event: EventRow) => {
  if ((event.approval_status ?? "approved") !== "approved") return false;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const endDate = parseDateOnly(event.end_date ?? event.event_date);
  if (endDate && endDate < today) return false;

  if (event.registration_deadline) {
    const deadline = new Date(event.registration_deadline);
    if (!Number.isNaN(deadline.getTime()) && deadline < now) return false;
  }

  return true;
};

const DEFAULT_CAROUSEL: CarouselItem[] = [
  {
    label: "Student activities",
    title: "New activities are on the way",
    body: "Events, workshops, and student gatherings will appear here as clubs publish them.",
    image:
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80",
  },
  {
    label: "Club updates",
    title: "Follow active student clubs",
    body: "Check club announcements and browse groups that match your interests.",
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=80",
  },
  {
    label: "Team notices",
    title: "Manage requests from Teams",
    body: "Team requests, invites, and member changes are handled from the Teams page.",
    image:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80",
  },
];

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventRefs, setEventRefs] = useState<Pick<EventRow, "id" | "title">[]>([]);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistrationRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [joinedClubs, setJoinedClubs] = useState<ClubRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [memberships, setMemberships] = useState<TeamMemberRow[]>([]);
  const [activeNewsIndex, setActiveNewsIndex] = useState(0);
  const [psutNewsItems, setPsutNewsItems] = useState<CarouselItem[]>(DEFAULT_CAROUSEL);

  // Fetch carousel from site_settings (non-blocking)
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "homepage_carousel")
      .single()
      .then(({ data }) => {
        if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
          setPsutNewsItems(data.value as CarouselItem[]);
        }
      });
  }, []);

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

        const eventSelect =
          "id, title, category, description, event_date, end_date, registration_deadline, start_time, end_time, location, approval_status, is_team_based, is_university_event";
        const legacyEventSelect =
          "id, title, category, description, event_date, start_time, end_time, location, approval_status, is_team_based, is_university_event";

        const [
          profileResult,
          initialEventsResult,
          eventRefsResult,
          eventRegistrationsResult,
          clubsResult,
          clubMembershipsResult,
          teamsResult,
          membershipsResult,
        ] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", user.id).single(),
            supabase
              .from("events")
              .select(eventSelect)
              .eq("approval_status", "approved")
              .order("event_date", { ascending: true })
              .limit(100),
            supabase
              .from("events")
              .select("id, title")
              .eq("approval_status", "approved"),
            supabase
              .from("event_registrations")
              .select("event_id")
              .eq("user_id", user.id),
            supabase.from("clubs").select("*").limit(8),
            supabase
              .from("club_members")
              .select("club_id, clubs(*)")
              .eq("user_id", user.id)
              .eq("status", "approved"),
            supabase.from("teams").select("*").order("created_at", { ascending: false }).limit(6),
            supabase
              .from("team_members")
              .select("team_id, user_id, status, teams(*)")
              .eq("user_id", user.id)
              .neq("status", "rejected"),
          ]);

        let eventsData = initialEventsResult.data as EventRow[] | null;
        let eventsError = initialEventsResult.error;
        if (isMissingColumnError(eventsError)) {
          const legacyEventsResult = await supabase
            .from("events")
            .select(legacyEventSelect)
            .eq("approval_status", "approved")
            .order("event_date", { ascending: true })
            .limit(100);
          eventsData = legacyEventsResult.data as EventRow[] | null;
          eventsError = legacyEventsResult.error;
        }

        if (profileResult.error) {
          setError(profileResult.error.message);
          return;
        }

        setProfile(profileResult.data as Profile);
        if (eventsError) {
          setError(eventsError.message);
          setEvents([]);
        } else {
          setEvents(
            (eventsData || [])
              .filter(Boolean)
              .filter(isOpenForRegistration)
              .slice(0, 6)
          );
        }
        setEventRefs(((eventRefsResult.data || []) as Pick<EventRow, "id" | "title">[]).filter(Boolean));
        setEventRegistrations(
          ((eventRegistrationsResult.data || []) as EventRegistrationRow[]).filter(Boolean)
        );
        setClubs(((clubsResult.data || []) as ClubRow[]).filter(Boolean));
        if (clubMembershipsResult.error) {
          console.warn(
            "Could not load joined clubs:",
            clubMembershipsResult.error.message
          );
          setJoinedClubs(await mergeJoinedClubs(user.id, []));
        } else {
          setJoinedClubs(
            await mergeJoinedClubs(
              user.id,
              ((clubMembershipsResult.data || []) as ClubMembershipRow[])
                .map(getClubFromMembership)
                .filter(Boolean) as ClubRow[]
            )
          );
        }
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

  const joinedClubNames = useMemo(() => {
    if (joinedClubs.length === 0) return "No joined clubs yet";

    const names = joinedClubs.map(getClubName);
    if (names.length <= 2) return names.join(", ");

    return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  }, [joinedClubs]);

  const initials =
    profile?.full_name?.trim().charAt(0).toUpperCase() ||
    profile?.email?.trim().charAt(0).toUpperCase() ||
    "S";

  const activeNews = psutNewsItems[activeNewsIndex % psutNewsItems.length];
  const activeNewsUrl = activeNews.url?.trim() || "";

  // The hero carousel uses admin-managed slides, with local defaults available
  // so the home page still has content before newsletter slides are configured.
  const goToPreviousNews = () => {
    setActiveNewsIndex((current) =>
      current === 0 ? psutNewsItems.length - 1 : current - 1
    );
  };

  const goToNextNews = () => {
    setActiveNewsIndex((current) => (current + 1) % psutNewsItems.length);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar />
        <section className="mx-auto w-full max-w-[calc(100vw-1.5rem)] px-0 py-6 sm:max-w-[1800px] sm:px-6 sm:py-8 lg:px-8 xl:px-10 2xl:px-12">
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
        <section className="mx-auto w-full max-w-[calc(100vw-1.5rem)] px-0 py-6 sm:max-w-[1800px] sm:px-6 sm:py-8 lg:px-8 xl:px-10 2xl:px-12">
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50">
      <AppNavbar />

      <section className="mobile-screen-safe mx-auto w-full max-w-[calc(100vw-1.5rem)] px-0 py-5 sm:max-w-[1800px] sm:px-6 sm:py-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mobile-screen-safe grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.55fr)_430px] 2xl:grid-cols-[minmax(0,1.7fr)_500px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-[28px]">
            <div
              className="relative flex min-h-[560px] flex-col justify-end bg-cover bg-center p-5 text-white sm:p-8 xl:min-h-[620px]"
              style={{ backgroundImage: `url(${activeNews.image})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-slate-950/10" />
              {psutNewsItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goToPreviousNews}
                    aria-label="Previous news"
                    className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-950/35 text-xl font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white hover:text-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-white/70 sm:left-4 sm:h-11 sm:w-11 sm:text-2xl"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    onClick={goToNextNews}
                    aria-label="Next news"
                    className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-950/35 text-xl font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white hover:text-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-white/70 sm:right-4 sm:h-11 sm:w-11 sm:text-2xl"
                  >
                    &gt;
                  </button>
                </>
              )}
              <div className="relative max-w-3xl pl-12 pr-10 sm:pl-14 sm:pr-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase text-[#1e3a8a]">
                    PSUT news
                  </span>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase text-white backdrop-blur">
                    {activeNews.label}
                  </span>
                </div>
                <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-5xl">
                  {activeNews.title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
                  {activeNews.body}
                </p>
                {activeNewsUrl && (
                  <a
                    href={activeNewsUrl}
                    className="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#1e3a8a] transition hover:opacity-90"
                  >
                    Details
                  </a>
                )}
              </div>

              <div className="relative mt-8 flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  {psutNewsItems.map((item, index) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveNewsIndex(index)}
                      aria-label={`Show ${item.label}`}
                      className={`h-2.5 rounded-full transition ${
                        activeNewsIndex === index
                          ? "w-10 bg-white"
                          : "w-2.5 bg-white/45 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[28px] sm:p-6 lg:p-7">
            <div className="flex h-full flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#eef3ff] text-2xl font-bold text-[#1e3a8a] sm:h-20 sm:w-20 sm:text-3xl">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase text-[#1e3a8a]">
                    Home
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
                    Welcome back, {firstName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {profile?.major || "Major not added"} -{" "}
                    {profile?.academic_year || "Academic year not added"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Joined clubs</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {joinedClubs.length}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {joinedClubNames}
                  </p>
                </div>
              </div>

              <div className="mt-auto grid gap-3">
                <Link
                  href="/events"
                  className="flex items-center justify-between rounded-2xl border border-[#c7d5fb] bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eef3ff]"
                >
                  Browse open events
                  <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
                <Link
                  href="/clubs"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#c7d5fb] hover:bg-white"
                >
                  Find clubs to join
                  <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
                <Link
                  href="/teams"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#c7d5fb] hover:bg-white"
                >
                  Manage teams
                  <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>
        </div>

        <div className="mobile-screen-safe mt-6 grid w-full min-w-0 max-w-full gap-4 overflow-hidden sm:gap-6 xl:grid-cols-[minmax(0,1.35fr)_480px] 2xl:grid-cols-[minmax(0,1.45fr)_560px]">
          <section className="mobile-card-safe min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="max-w-full break-words text-base font-bold leading-tight text-slate-950 sm:text-xl">
                  Open registration events
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                  Events students can still join.
                </p>
              </div>
              <Link
                href="/events"
                className="shrink-0 text-xs font-semibold text-[#1e3a8a] hover:underline sm:text-sm"
              >
                View all
              </Link>
            </div>

            <div className="mobile-screen-safe mt-4 grid min-w-0 gap-3 sm:mt-5 2xl:grid-cols-2">
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
                      className="mobile-card-safe block w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 p-3 transition hover:border-[#1e3a8a]/40 hover:bg-slate-50 sm:p-4"
                    >
                      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 sm:px-3 sm:text-xs">
                              {inferEventCategory(
                                event.category,
                                event.title,
                                event.description
                              )}
                            </span>
                            <span className="rounded-full border border-[#c7d5fb] bg-[#eef3ff] px-2.5 py-1 text-[11px] font-semibold text-[#1e3a8a] sm:px-3 sm:text-xs">
                              {event.is_team_based ? "Team based" : "Solo based"}
                            </span>
                          </div>
                          <h3 className="mt-3 line-clamp-2 max-w-full break-words text-sm font-bold leading-snug text-slate-950 sm:text-base">
                            {event.title || "Untitled event"}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                            {event.description || "No description added."}
                          </p>
                        </div>

                        <div className="w-full min-w-0 rounded-lg bg-slate-100 px-3 py-3 text-xs text-slate-700 sm:text-sm md:w-auto md:shrink-0">
                          <p className="font-semibold">{formatDate(event.event_date)}</p>
                          <p className="mt-1 text-xs text-slate-500">{timeLabel}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No events open for registration.
                </div>
              )}
            </div>
          </section>

          <div className="mobile-card-safe h-full min-w-0 max-w-full overflow-hidden">
            <section className="mobile-card-safe min-h-[520px] min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="min-w-0 text-lg font-bold text-slate-950 sm:text-xl">Clubs</h2>
                <Link
                  href="/clubs"
                  className="shrink-0 text-xs font-semibold text-[#1e3a8a] hover:underline sm:text-sm"
                >
                  Browse
                </Link>
              </div>

              <div className="mt-5 min-w-0 space-y-3 sm:space-y-4">
                {clubs.length > 0 ? (
                  clubs.map((club) => {
                    const logo = club.logo_url || club.image_url || "";
                    const clubName = getClubName(club);

                    return (
                      <Link
                        key={club.id}
                        href={`/clubs/${club.id}`}
                        className="flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 sm:gap-4 sm:p-4"
                      >
                        {logo ? (
                          <div
                            aria-label={`${clubName} logo`}
                            className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 bg-cover bg-center sm:h-12 sm:w-12"
                            style={{ backgroundImage: `url(${logo})` }}
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] font-bold text-[#1e3a8a] sm:h-12 sm:w-12">
                            {clubName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{clubName}</p>
                          <p className="text-xs text-slate-500">
                            {formatTagLabel(club.category) || "Club"}
                          </p>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">No clubs found.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
