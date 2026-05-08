"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  event_date: string | null;
  location: string | null;
  approval_status: string | null;
  created_at: string | null;
  club_id: string | null;
  clubs: { name: string | null; title: string | null } | null;
};

type Registrant = {
  id: string;
  user_id: string;
  created_at: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    student_id: string | null;
    major: string | null;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  approved: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  pending:  { badge: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-400"  },
  rejected: { badge: "bg-red-50 text-red-600 ring-red-200",             dot: "bg-red-500"    },
};

const CATEGORY_COLORS: Record<string, string> = {
  Hackathon:   "bg-purple-50 text-purple-700",
  Workshop:    "bg-blue-50 text-blue-700",
  Competition: "bg-orange-50 text-orange-700",
  Seminar:     "bg-teal-50 text-teal-700",
  Conference:  "bg-indigo-50 text-indigo-700",
  Career:      "bg-pink-50 text-pink-700",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getClubName(e: HistoryEvent) {
  return e.clubs?.name?.trim() || e.clubs?.title?.trim() || "—";
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { badge: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function EventDetailModal({ event, onClose }: { event: HistoryEvent; onClose: () => void }) {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: regData, error: regErr } = await supabase
          .from("event_registrations")
          .select("id, user_id, created_at")
          .eq("event_id", event.id)
          .order("created_at", { ascending: false });

        if (regErr) { setError(regErr.message); setLoading(false); return; }
        if (!regData || regData.length === 0) { setRegistrants([]); setLoading(false); return; }

        const userIds = regData.map((r) => r.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, student_id, major")
          .in("id", userIds);

        const merged = regData.map((r) => ({
          ...r,
          profiles: profilesData?.find((p) => p.id === r.user_id) ?? null,
        }));
        setRegistrants(merged as unknown as Registrant[]);
      } catch { setError("Failed to load registrations."); }
      setLoading(false);
    };
    load();
  }, [event.id]);

  const status = event.approval_status ?? "approved";
  const catColor = CATEGORY_COLORS[event.category ?? ""] ?? "bg-slate-100 text-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {event.category && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${catColor}`}>{event.category}</span>
              )}
              <StatusBadge status={status} />
            </div>
            <h2 className="text-base font-bold text-slate-900">{event.title}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>📅 {formatDate(event.event_date)}</span>
              {event.location && <span>📍 {event.location}</span>}
              {event.clubs && <span>🏛 {getClubName(event)}</span>}
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Description */}
        {event.description && (
          <div className="border-b border-slate-100 px-6 py-4">
            <p className="text-sm leading-relaxed text-slate-600">{event.description}</p>
          </div>
        )}

        {/* Registrations */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Registrations
              {!loading && (
                <span className="ml-2 rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-bold text-[#1e3a8a]">
                  {registrants.length}
                </span>
              )}
            </h3>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          ) : registrants.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-10 text-center">
              <svg width="32" height="32" fill="none" stroke="#cbd5e1" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <p className="text-sm text-slate-400">No registrations yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3">Major</th>
                    <th className="px-4 py-3">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {registrants.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.profiles?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{r.profiles?.student_id ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{r.profiles?.major ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminHistoryPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const loadEvents = async (offset = 0, append = false) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, category, event_date, location, approval_status, created_at, club_id, clubs(name, title)")
      .order("event_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!error && data) {
      const shaped = (data as unknown as HistoryEvent[]);
      setEvents((prev) => append ? [...prev, ...shaped] : shaped);
      if (shaped.length === PAGE_SIZE) setPage(offset / PAGE_SIZE + 1);
    }
    setLoading(false);
  };

  useEffect(() => { loadEvents(0); }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchSearch =
        !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
        getClubName(e).toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" || (e.approval_status ?? "approved") === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [events, search, statusFilter]);

  const stats = useMemo(() => ({
    total: events.length,
    approved: events.filter((e) => e.approval_status === "approved").length,
    pending:  events.filter((e) => (e.approval_status ?? "") === "pending").length,
    rejected: events.filter((e) => e.approval_status === "rejected").length,
  }), [events]);

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Event History</h1>
        <p className="mt-1 text-sm text-slate-500">All events across the entire Sharek platform.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Events",    value: stats.total,    color: "bg-blue-50",    textColor: "#1e3a8a" },
          { label: "Approved",        value: stats.approved, color: "bg-emerald-50", textColor: "#059669" },
          { label: "Pending",         value: stats.pending,  color: "bg-amber-50",   textColor: "#d97706" },
          { label: "Rejected",        value: stats.rejected, color: "bg-red-50",     textColor: "#dc2626" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{s.label}</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: s.textColor }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search by title, category or club…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-medium text-slate-500">
            Showing <span className="font-bold text-slate-900">{filtered.length}</span> event{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {loading && events.length === 0 ? (
          <div className="space-y-3 p-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <svg width="40" height="40" fill="none" stroke="#cbd5e1" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <p className="text-sm font-medium text-slate-500">No events found</p>
            <p className="text-xs text-slate-400">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Event</th>
                  <th className="px-6 py-3">Club</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => {
                  const status = event.approval_status ?? "approved";
                  const catColor = CATEGORY_COLORS[event.category ?? ""] ?? "bg-slate-100 text-slate-600";
                  return (
                    <tr key={event.id} className="border-b border-slate-50 last:border-0 transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{event.title}</p>
                        {event.category && (
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${catColor}`}>
                            {event.category}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{getClubName(event)}</td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(event.event_date)}</td>
                      <td className="px-6 py-4"><StatusBadge status={status} /></td>
                      <td className="px-6 py-4 text-slate-400">{formatDate(event.created_at)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#1e3a8a] hover:bg-[#eef3ff] hover:text-[#1e3a8a]"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more */}
        {!loading && events.length >= PAGE_SIZE * page && events.length > 0 && (
          <div className="border-t border-slate-100 p-4 text-center">
            <button
              onClick={() => loadEvents(page * PAGE_SIZE, true)}
              className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Load more events
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
