"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppNavbar from "../../../components/AppNavbar";
import { supabase } from "../../../lib/supabase";

type ClubRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  email?: string | null;
  location?: string | null;
  president?: string | null;
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
  is_club_members_only?: boolean | null;
};

type ClubMemberCountRow = {
  club_id: string;
  member_count: number;
};

const getClubName = (club: ClubRow) =>
  club.name?.trim() || club.title?.trim() || "Untitled club";

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

export default function ClubDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clubId = params.id;

  const [club, setClub] = useState<ClubRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [userId, setUserId] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [clubMembershipsAvailable, setClubMembershipsAvailable] = useState(true);

  useEffect(() => {
    const loadClub = async () => {
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

        setUserId(user.id);

        const [clubResult, membershipResult, memberCountsResult] =
          await Promise.all([
            supabase.from("clubs").select("*").eq("id", clubId).single(),
            supabase
              .from("club_members")
              .select("club_id")
              .eq("club_id", clubId)
              .eq("user_id", user.id),
            supabase.rpc("get_club_member_counts"),
          ]);

        if (clubResult.error) {
          setError(clubResult.error.message);
          return;
        }

        const eventSelect =
          "id, title, category, description, event_date, start_time, end_time, location, is_team_based";
        const eventsResult = await supabase
          .from("events")
          .select(`${eventSelect}, is_club_members_only`)
          .eq("club_id", clubId)
          .order("event_date", { ascending: true });

        let eventsData: unknown = eventsResult.data;
        let eventsError = eventsResult.error;

        if (eventsResult.error) {
          const fallbackEventsResult = await supabase
            .from("events")
            .select(eventSelect)
            .eq("club_id", clubId)
            .order("event_date", { ascending: true });

          eventsData = fallbackEventsResult.data;
          eventsError = fallbackEventsResult.error;
        }

        if (eventsError) {
          setError(eventsError.message);
          return;
        }

        setClub(clubResult.data as ClubRow);
        setEvents(((eventsData || []) as EventRow[]).filter(Boolean));

        if (membershipResult.error) {
          console.error("CLUB MEMBERSHIP LOAD ERROR:", membershipResult.error);
          setClubMembershipsAvailable(false);
          setIsMember(false);
        } else {
          setClubMembershipsAvailable(true);
          setIsMember((membershipResult.data || []).length > 0);
        }

        const counts = (memberCountsResult.data || []) as ClubMemberCountRow[];
        const count = counts.find((item) => item.club_id === clubId)?.member_count ?? 0;
        setMemberCount(count);
      } catch (err) {
        console.error("CLUB DETAILS LOAD ERROR:", err);
        setError("Something went wrong while loading this club.");
      } finally {
        setLoading(false);
      }
    };

    loadClub();
  }, [clubId, router]);

  const handleJoinClub = async () => {
    if (!userId || !club) return;

    setActionLoading(true);
    setError("");

    const { error: joinError } = await supabase.rpc("join_club", {
      target_club_id: club.id,
    });

    if (joinError) {
      setError(
        joinError.message.toLowerCase().includes("schema cache")
          ? "Club joining is not ready in Supabase yet. Run the latest club_members SQL and reload the schema."
          : joinError.message
      );
    } else {
      setIsMember(true);
      setMemberCount((current) => current + 1);
    }

    setActionLoading(false);
  };

  const handleLeaveClub = async () => {
    if (!userId || !club) return;

    setActionLoading(true);
    setError("");

    const { error: leaveError } = await supabase.rpc("leave_club", {
      target_club_id: club.id,
    });

    if (leaveError) {
      setError(
        leaveError.message.toLowerCase().includes("schema cache")
          ? "Club leaving is not ready in Supabase yet. Run the latest club_members SQL and reload the schema."
          : leaveError.message
      );
    } else {
      setIsMember(false);
      setMemberCount((current) => Math.max(current - 1, 0));
    }

    setActionLoading(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading club...
          </div>
        </section>
      </main>
    );
  }

  if (!club) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
            {error || "Club not found."}
          </div>
        </section>
      </main>
    );
  }

  const logo = club.logo_url || club.image_url || "";
  const clubName = getClubName(club);

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/clubs"
          className="text-sm font-semibold text-[#1e3a8a] hover:underline"
        >
          Back to clubs
        </Link>

        {error && (
          <div className="mt-5 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        )}

        <section className="mt-5 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-5">
              {logo ? (
                <div
                  aria-label={`${clubName} logo`}
                  className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-cover bg-center"
                  style={{ backgroundImage: `url(${logo})` }}
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-[#c7d5fb] bg-[#eef3ff] text-2xl font-bold text-[#1e3a8a]">
                  {clubName.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {club.category || "Club"}
                  </span>
                  <span className="rounded-full border border-[#c7d5fb] bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-950">
                  {clubName}
                </h1>
                {club.location && (
                  <p className="mt-2 text-sm text-slate-500">{club.location}</p>
                )}
                {club.president && (
                  <p className="mt-1 text-sm text-slate-500">
                    President: {club.president}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {clubMembershipsAvailable &&
                (isMember ? (
                  <button
                    type="button"
                    onClick={handleLeaveClub}
                    disabled={actionLoading}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading ? "Leaving..." : "Leave club"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleJoinClub}
                    disabled={actionLoading}
                    className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading ? "Joining..." : "Join club"}
                  </button>
                ))}

              {club.website_url && (
                <a
                  href={club.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Website
                </a>
              )}
              {club.instagram_url && (
                <a
                  href={club.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Instagram
                </a>
              )}
              {club.email && (
                <a
                  href={`mailto:${club.email}`}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Email
                </a>
              )}
            </div>
          </div>

          <p className="mt-6 max-w-4xl text-sm leading-6 text-slate-600">
            {club.description || "No description added yet."}
          </p>
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Club events</h2>
              <p className="mt-1 text-sm text-slate-500">
                Events organized by {clubName}.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
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
                          {event.is_club_members_only && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              Club members only
                            </span>
                          )}
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
                        {event.location && (
                          <p className="mt-1 text-xs text-slate-500">{event.location}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No events for this club yet.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
