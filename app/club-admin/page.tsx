"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClubAdminContext } from "../../lib/clubAdmin";
import { inferEventCategory } from "../../lib/eventCategories";
import { supabase } from "../../lib/supabase";
import { formatTagLabel } from "../../lib/tagLabels";

type Stats = {
  totalClubs: number;
  totalEvents: number;
  pendingEvents: number;
  totalMembers: number;
};

type RecentEvent = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  approval_status: string | null;
  event_date: string | null;
  club_id: string | null;
};

type ClubMemberCountRow = {
  club_id: string;
  member_count: number;
};

type ManagedClub = {
  id: string;
  name?: string | null;
  title?: string | null;
  category?: string | null;
};

const StatCard = ({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
    </div>
  </div>
);

const statusColors: Record<string, string> = {
  approved: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
};

export default function ClubAdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClubs: 0,
    totalEvents: 0,
    pendingEvents: 0,
    totalMembers: 0,
  });
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [managedClub, setManagedClub] = useState<ManagedClub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setManagedClub(null);
          setStats({
            totalClubs: 0,
            totalEvents: 0,
            pendingEvents: 0,
            totalMembers: 0,
          });
          setRecentEvents([]);
          return;
        }

        const context = await getClubAdminContext();
        const managedClubData = context.managedClub;

        if (context.error || !managedClubData?.id) {
          setManagedClub(null);
          setStats({
            totalClubs: 0,
            totalEvents: 0,
            pendingEvents: 0,
            totalMembers: 0,
          });
          setRecentEvents([]);
          return;
        }

        setManagedClub(managedClubData as ManagedClub);

        const [eventsResult, memberCountsResult] = await Promise.all([
          supabase
            .from("events")
            .select("id, title, category, description, approval_status, event_date, club_id")
            .eq("club_id", managedClubData.id)
            .order("event_date", { ascending: false })
            .limit(100),
          supabase.rpc("get_club_member_counts"),
        ]);

        const events = (eventsResult.data || []) as RecentEvent[];
        const memberCounts = (memberCountsResult.data || []) as ClubMemberCountRow[];
        const managedClubMemberCount =
          memberCounts.find((club) => club.club_id === managedClubData.id)
            ?.member_count ?? 0;

        setStats({
          totalClubs: 1,
          totalEvents: events.length,
          pendingEvents: events.filter(
            (event) => (event.approval_status ?? "approved") === "pending"
          ).length,
          totalMembers: Number(managedClubMemberCount || 0),
        });

        setRecentEvents(events.slice(0, 5));
      } catch (err) {
        console.error("Club admin dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="px-6 py-8 lg:px-10 2xl:px-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Club Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your club, its members, and its events on Sharek.
        </p>
        {!loading && managedClub && (
          <p className="mt-3 inline-flex rounded-full bg-[#eef3ff] px-4 py-2 text-sm font-semibold text-[#1e3a8a]">
            Assigned club: {managedClub.name?.trim() || managedClub.title?.trim() || "Your Club"}
          </p>
        )}
      </div>

      {!loading && managedClub && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">
            Managed Club
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              {managedClub.name?.trim() || managedClub.title?.trim() || "Your Club"}
            </h2>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatTagLabel(managedClub.category) || "Club"}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <StatCard
            label="Club Events"
            value={stats.totalEvents}
            color="bg-indigo-50"
            icon={
              <svg width="20" height="20" fill="none" stroke="#4f46e5" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
          />
          <StatCard
            label="Pending Events"
            value={stats.pendingEvents}
            color="bg-amber-50"
            icon={
              <svg width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
            }
          />
          <StatCard
            label="Club Members"
            value={stats.totalMembers}
            color="bg-emerald-50"
            icon={
              <svg width="20" height="20" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Link
          href="/club-admin/members"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#1e3a8a] hover:shadow-md"
        >
          <div className="rounded-xl bg-blue-50 p-3">
            <svg width="22" height="22" fill="none" stroke="#1e3a8a" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Manage Members</p>
            <p className="text-sm text-slate-500">
              View your club roster and remove members when needed
            </p>
          </div>
          <svg className="ml-auto text-slate-300" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        <Link
          href="/club-admin/events"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#1e3a8a] hover:shadow-md"
        >
          <div className="rounded-xl bg-indigo-50 p-3">
            <svg width="22" height="22" fill="none" stroke="#4f46e5" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Manage Events</p>
            <p className="text-sm text-slate-500">
              Create club events and send them to admin approval
            </p>
          </div>
          <svg className="ml-auto text-slate-300" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent Events
            </h2>
            <p className="text-xs text-slate-400">Latest 5 events for your club</p>
          </div>
          <Link
            href="/club-admin/events"
            className="text-sm font-medium text-[#1e3a8a] hover:underline"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : recentEvents.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No events found for your club.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => {
                  const status = event.approval_status ?? "approved";
                  return (
                    <tr
                      key={event.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {event.title}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {inferEventCategory(
                          event.category,
                          event.title,
                          event.description
                        ) || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {event.event_date
                          ? new Date(event.event_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                            statusColors[status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {formatTagLabel(status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
