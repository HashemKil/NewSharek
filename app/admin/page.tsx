"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { inferEventCategory } from "../../lib/eventCategories";
import { supabase } from "../../lib/supabase";
import { formatTagLabel } from "../../lib/tagLabels";

type Stats = {
  totalUsers: number;
  totalEvents: number;
  pendingEvents: number;
  clubAdmins: number;
  verifiedUsers: number;
};

type RecentEvent = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  approval_status: string;
  event_date: string | null;
};

// Reusable dashboard card for one clickable admin metric.
const StatCard = ({
  label,
  value,
  color,
  icon,
  href,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
  href?: string;
}) => {
  // Defines the content helper used by this screen.
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#1e3a8a] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{content}</div>;
};

const statusColors: Record<string, string> = {
  approved: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
};

// Shows platform-level totals, recent activity, and admin shortcuts.
export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalEvents: 0,
    pendingEvents: 0,
    clubAdmins: 0,
    verifiedUsers: 0,
  });
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Loads stats data from Supabase for this screen.
    const loadStats = async () => {
      setLoading(true);

      try {
        // Fetch all profiles in parallel with all events
        const [profilesResult, eventsResult] = await Promise.all([
          supabase.from("profiles").select("is_club_admin, portal_verified"),
          supabase
            .from("events")
            .select("id, title, category, description, approval_status, event_date")
            .order("event_date", { ascending: false })
            .limit(100),
        ]);

        if (profilesResult.data) {
          const profiles = profilesResult.data;
          setStats((prev) => ({
            ...prev,
            totalUsers: profiles.length,
            clubAdmins: profiles.filter((p) => p.is_club_admin).length,
            verifiedUsers: profiles.filter((p) => p.portal_verified).length,
          }));
        }

        if (eventsResult.data) {
          const events = eventsResult.data;
          setStats((prev) => ({
            ...prev,
            totalEvents: events.length,
            pendingEvents: events.filter(
              (e) => (e.approval_status ?? "approved") === "pending"
            ).length,
          }));
          // Show the 5 most recent events in the preview table
          setRecentEvents(events.slice(0, 5));
        }
      } catch (err) {
        console.error("Admin dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="px-6 py-8 lg:px-10 2xl:px-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of the Sharek platform.
        </p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Users"
            value={stats.totalUsers}
            color="bg-blue-50"
            href="/admin/users"
            icon={
              <svg width="20" height="20" fill="none" stroke="#1e3a8a" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
          <StatCard
            label="Total Events"
            value={stats.totalEvents}
            color="bg-indigo-50"
            href="/admin/events"
            icon={
              <svg width="20" height="20" fill="none" stroke="#4f46e5" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
          />
          <StatCard
            label="Pending Approval"
            value={stats.pendingEvents}
            color="bg-amber-50"
            href="/admin/events"
            icon={
              <svg width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
            }
          />
          <StatCard
            label="Club Admins"
            value={stats.clubAdmins}
            color="bg-purple-50"
            href="/admin/users"
            icon={
              <svg width="20" height="20" fill="none" stroke="#7c3aed" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Recent Events Table */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent Events
            </h2>
            <p className="text-xs text-slate-400">Latest 5 events on the platform</p>
          </div>
          <Link
            href="/admin/events"
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
            No events found.
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
