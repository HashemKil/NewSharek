"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppNavbar from "../../../components/AppNavbar";
import {
  cacheJoinedClubSummary,
  getCachedJoinedClubIds,
  joinClubMembership,
  leaveClubMembership,
  uncacheJoinedClubSummary,
} from "../../../lib/clubMembership";
import { supabase } from "../../../lib/supabase";
import { formatTagLabel } from "../../../lib/tagLabels";

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
  club_admin_id?: string | null;
};

type ClubAdminProfile = {
  id: string;
  full_name?: string | null;
  major?: string | null;
  student_id?: string | null;
  avatar_url?: string | null;
  portal_verified?: boolean | null;
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
  image_url?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  thumbnail_url?: string | null;
  is_team_based?: boolean | null;
  is_club_members_only?: boolean | null;
};

type ClubMemberCountRow = {
  club_id: string;
  member_count: number;
};

type ClubMemberRow = {
  club_id: string;
  status?: "pending" | "approved" | "rejected" | null;
};

// Detects old schemas where club membership status is not available.
function isMissingClubMemberStatus(error: { message?: string; code?: string } | null) {
  const message = (error?.message || "").toLowerCase();
  return (
    (error?.code === "PGRST204" || error?.code === "42703") &&
    message.includes("status") &&
    message.includes("club_members")
  );
}

// Reads the best club display name from the available database fields.
const getClubName = (club: ClubRow) =>
  club.name?.trim() || club.title?.trim() || "Untitled club";

// Selects a usable image for club-owned event cards.
const getEventImageUrl = (event: EventRow) =>
  event.image_url?.trim() ||
  event.poster_url?.trim() ||
  event.banner_url?.trim() ||
  event.thumbnail_url?.trim() ||
  null;

// Formats event dates on the club details page.
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

// Formats event times on the club details page.
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

// Shows one club, its events, members, and the student's membership action.
export default function ClubDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clubId = params.id;

  const [club, setClub] = useState<ClubRow | null>(null);
  const [clubAdmin, setClubAdmin] = useState<ClubAdminProfile | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [userId, setUserId] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [clubMembershipsAvailable, setClubMembershipsAvailable] = useState(true);

  // Defines the reload membership state helper used by this screen.
  const reloadMembershipState = async (currentUserId: string, currentClubId: string) => {
    const [membershipResult, memberCountsResult] = await Promise.all([
      supabase
        .from("club_members")
        .select("club_id, status")
        .eq("club_id", currentClubId)
        .eq("user_id", currentUserId)
        .neq("status", "rejected"),
      supabase.rpc("get_club_member_counts"),
    ]);

    if (membershipResult.error) {
      if (isMissingClubMemberStatus(membershipResult.error)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("club_members")
          .select("club_id")
          .eq("club_id", currentClubId)
          .eq("user_id", currentUserId);

        if (legacyError) {
          throw new Error(legacyError.message);
        }

        const counts = (memberCountsResult.data || []) as ClubMemberCountRow[];
        const nextCount =
          counts.find((item) => item.club_id === currentClubId)?.member_count ?? 0;

        return {
          status: ((legacyData || []) as ClubMemberRow[]).length > 0
            ? ("approved" as const)
            : null,
          isMember: ((legacyData || []) as ClubMemberRow[]).length > 0,
          memberCount: nextCount,
        };
      }

      throw new Error(membershipResult.error.message);
    }

    if (memberCountsResult.error) {
      throw new Error(memberCountsResult.error.message);
    }

    const counts = (memberCountsResult.data || []) as ClubMemberCountRow[];
    const nextCount =
      counts.find((item) => item.club_id === currentClubId)?.member_count ?? 0;
    const membership = ((membershipResult.data || []) as ClubMemberRow[])[0];
    const status = membership?.status ?? null;

    return {
      status,
      isMember: status === "approved",
      memberCount: nextCount,
    };
  };

  useEffect(() => {
    // Loads club data from Supabase for this screen.
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
              .select("club_id, status")
              .eq("club_id", clubId)
              .eq("user_id", user.id)
              .neq("status", "rejected"),
            supabase.rpc("get_club_member_counts"),
          ]);

        if (clubResult.error) {
          setError(clubResult.error.message);
          return;
        }

        const eventSelect =
          "id, title, category, description, event_date, start_time, end_time, location, is_team_based";
        const eventImageSelect = `${eventSelect}, is_club_members_only, image_url, poster_url, banner_url, thumbnail_url`;
        const eventsResult = await supabase
          .from("events")
          .select(eventImageSelect)
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

        const clubData = clubResult.data as ClubRow;
        setClub(clubData);

        if (clubData.club_admin_id) {
          const { data: adminData, error: adminError } = await supabase
            .from("profiles")
            .select("id, full_name, major, student_id, avatar_url, portal_verified")
            .eq("id", clubData.club_admin_id)
            .single();

          if (adminError) {
            console.warn("Could not load club admin:", adminError.message);
            setClubAdmin(null);
          } else {
            setClubAdmin(adminData as ClubAdminProfile);
          }
        } else {
          setClubAdmin(null);
        }

        setEvents(((eventsData || []) as EventRow[]).filter(Boolean));

        if (membershipResult.error) {
          if (isMissingClubMemberStatus(membershipResult.error)) {
            const legacyMembershipResult = await supabase
              .from("club_members")
              .select("club_id")
              .eq("club_id", clubId)
              .eq("user_id", user.id);

            if (legacyMembershipResult.error) {
              console.error("CLUB MEMBERSHIP LOAD ERROR:", legacyMembershipResult.error);
              setClubMembershipsAvailable(false);
              setIsMember(getCachedJoinedClubIds(user.id).includes(clubId));
            } else {
              setClubMembershipsAvailable(true);
              const isLegacyMember =
                (legacyMembershipResult.data || []).length > 0 ||
                getCachedJoinedClubIds(user.id).includes(clubId);
              setMembershipStatus(isLegacyMember ? "approved" : null);
              setIsMember(isLegacyMember);
            }
          } else {
            console.error("CLUB MEMBERSHIP LOAD ERROR:", membershipResult.error);
            setClubMembershipsAvailable(false);
            setIsMember(getCachedJoinedClubIds(user.id).includes(clubId));
          }
        } else {
          setClubMembershipsAvailable(true);
          const membership = ((membershipResult.data || []) as ClubMemberRow[])[0];
          const status = membership?.status ?? null;
          setMembershipStatus(status);
          setIsMember(status === "approved" || getCachedJoinedClubIds(user.id).includes(clubId));
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

  // Handles the join club action for this screen.
  const handleJoinClub = async () => {
    if (!userId || !club) return;

    setActionLoading(true);
    setError("");

    try {
      await joinClubMembership(club.id, userId);
      const nextState = await reloadMembershipState(userId, club.id);
      if (nextState.status === "approved") {
        cacheJoinedClubSummary(userId, {
          id: club.id,
          name: club.name,
          title: club.title,
          category: club.category,
        });
      }
      setMembershipStatus(nextState.status);
      setIsMember(nextState.isMember || getCachedJoinedClubIds(userId).includes(club.id));
      setMemberCount(nextState.memberCount);
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Could not join this club right now."
      );
    }

    setActionLoading(false);
  };

  // Handles the leave club action for this screen.
  const handleLeaveClub = async () => {
    if (!userId || !club) return;

    setActionLoading(true);
    setError("");

    try {
      await leaveClubMembership(club.id, userId);
      uncacheJoinedClubSummary(userId, club.id);
      const nextState = await reloadMembershipState(userId, club.id);
      setMembershipStatus(nextState.status);
      setIsMember(nextState.isMember);
      setMemberCount(nextState.memberCount);
    } catch (leaveError) {
      setError(
        leaveError instanceof Error
          ? leaveError.message
          : "Could not leave this club right now."
      );
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
                    {formatTagLabel(club.category) || "Club"}
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
                    className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading ? "Leaving..." : "Leave club"}
                  </button>
                ) : membershipStatus === "pending" ? (
                  <button
                    type="button"
                    onClick={handleLeaveClub}
                    disabled={actionLoading}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading ? "Cancelling..." : "Pending approval"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleJoinClub}
                    disabled={actionLoading}
                    className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading ? "Requesting..." : "Request to join"}
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
          <div>
            <h2 className="text-xl font-bold text-slate-950">Club admin</h2>
            <p className="mt-1 text-sm text-slate-500">
              Meet the student leading {clubName}.
            </p>
          </div>

          {clubAdmin ? (
            <Link
              href={`/profile/${clubAdmin.id}`}
              className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-[#1e3a8a]/30 hover:bg-slate-50"
            >
              {clubAdmin.avatar_url ? (
                <div
                  aria-label={`${clubAdmin.full_name || "Club admin"} avatar`}
                  className="h-16 w-16 shrink-0 rounded-full border border-slate-200 bg-cover bg-center"
                  style={{ backgroundImage: `url(${clubAdmin.avatar_url})` }}
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#c7d5fb] bg-[#eef3ff] text-xl font-bold text-[#1e3a8a]">
                  {(clubAdmin.full_name || "A").slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-950">
                    {clubAdmin.full_name || "Club admin"}
                  </h3>
                  <span className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-xs font-semibold text-[#1e3a8a]">
                    Club Admin
                  </span>
                  {clubAdmin.portal_verified && (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      Verified
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {clubAdmin.major || "Major not specified"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Student ID: {clubAdmin.student_id || "Not specified"}
                </p>
              </div>

              <span className="shrink-0 text-sm font-semibold text-[#1e3a8a]">
                View profile
              </span>
            </Link>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No club admin has been assigned yet.
            </div>
          )}
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
                const eventImageUrl = getEventImageUrl(event);

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:border-[#1e3a8a]/40 hover:bg-slate-50"
                  >
                    {eventImageUrl && (
                      <img
                        src={eventImageUrl}
                        alt={event.title || "Event image"}
                        className="mb-4 h-44 w-full rounded-xl object-cover"
                      />
                    )}
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {formatTagLabel(event.category) || "Event"}
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
