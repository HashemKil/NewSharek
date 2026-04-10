"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type AdminEvent = {
  id: string;
  title: string;
  category: string | null;
  event_date: string | null;
  location: string | null;
  approval_status: string | null;
  created_at: string | null;
  source_url: string | null;
};

const statusStyle: Record<string, string> = {
  approved: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("events")
      .select(
        "id, title, category, event_date, location, approval_status, created_at, source_url"
      )
      .order("event_date", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEvents(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Update approval_status in Supabase for a single event
  const handleStatusChange = async (
    eventId: string,
    newStatus: "approved" | "rejected"
  ) => {
    setActionLoading(eventId);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("events")
      .update({ approval_status: newStatus })
      .eq("id", eventId);

    if (updateError) {
      setError(updateError.message);
    } else {
      // Optimistically update local state instead of re-fetching
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, approval_status: newStatus } : e
        )
      );
      setSuccess(
        `Event ${newStatus === "approved" ? "approved" : "rejected"} successfully.`
      );
      setTimeout(() => setSuccess(""), 3000);
    }

    setActionLoading(null);
  };

  const handleDelete = async (eventId: string) => {
    setActionLoading(eventId);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setSuccess("Event deleted successfully.");
      setTimeout(() => setSuccess(""), 3000);
    }

    setActionLoading(null);
    setDeleteConfirm(null);
  };

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !term ||
        event.title?.toLowerCase().includes(term) ||
        event.category?.toLowerCase().includes(term) ||
        event.location?.toLowerCase().includes(term);

      const status = event.approval_status ?? "approved";
      const matchesStatus =
        filterStatus === "all" || status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [events, search, filterStatus]);

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Event Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review, approve, reject, or delete events on the platform.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by title, category, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10 sm:w-72"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            No events match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => {
                  const status = event.approval_status ?? "approved";
                  const isProcessing = actionLoading === event.id;

                  return (
                    <tr
                      key={event.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="max-w-[200px] px-6 py-4">
                        <p className="truncate font-medium text-slate-800">
                          {event.title}
                        </p>
                        {event.source_url && (
                          <a
                            href={event.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#1e3a8a] hover:underline"
                          >
                            Source ↗
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {event.category ?? "—"}
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
                      <td className="max-w-[140px] px-6 py-4 text-slate-500">
                        <span className="truncate block">{event.location ?? "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                            statusStyle[status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Approve button — only shown when not already approved */}
                          {status !== "approved" && (
                            <button
                              onClick={() => handleStatusChange(event.id, "approved")}
                              disabled={isProcessing}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                            >
                              {isProcessing ? "..." : "Approve"}
                            </button>
                          )}

                          {/* Reject button — only shown when not already rejected */}
                          {status !== "rejected" && (
                            <button
                              onClick={() => handleStatusChange(event.id, "rejected")}
                              disabled={isProcessing}
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                            >
                              {isProcessing ? "..." : "Reject"}
                            </button>
                          )}

                          {/* Delete with confirm step */}
                          {deleteConfirm === event.id ? (
                            <>
                              <button
                                onClick={() => handleDelete(event.id)}
                                disabled={isProcessing}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                              >
                                {isProcessing ? "..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(event.id)}
                              disabled={isProcessing}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
