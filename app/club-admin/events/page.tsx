"use client";

import { useEffect, useMemo, useState } from "react";
import { getClubAdminContext, type ManagedClub } from "../../../lib/clubAdmin";
import { supabase } from "../../../lib/supabase";

type ClubEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  event_date: string | null;
  location: string | null;
  approval_status: string | null;
  created_at: string | null;
  is_club_members_only: boolean | null;
  club_id: string | null;
};

type EventForm = {
  title: string;
  description: string;
  category: string;
  event_date: string;
  location: string;
  is_club_members_only: boolean;
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10";

const emptyForm: EventForm = {
  title: "",
  description: "",
  category: "",
  event_date: "",
  location: "",
  is_club_members_only: false,
};

const statusStyles: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  rejected: "bg-red-50 text-red-600 ring-red-200",
};

export default function ClubAdminEventsPage() {
  const [managedClub, setManagedClub] = useState<ManagedClub | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEvents = async () => {
    setLoading(true);
    setError("");

    const context = await getClubAdminContext();
    if (context.error || !context.managedClub) {
      setManagedClub(null);
      setEvents([]);
      setError(context.error);
      setLoading(false);
      return;
    }

    setManagedClub(context.managedClub);

    const { data, error: eventsError } = await supabase
      .from("events")
      .select(
        "id, title, description, category, event_date, location, approval_status, created_at, is_club_members_only, club_id"
      )
      .eq("club_id", context.managedClub.id)
      .order("created_at", { ascending: false });

    if (eventsError) {
      setError(eventsError.message);
      setEvents([]);
    } else {
      setEvents((data ?? []) as ClubEvent[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(loadEvents);
  }, []);

  const pendingCount = useMemo(
    () =>
      events.filter((event) => (event.approval_status ?? "approved") === "pending")
        .length,
    [events]
  );

  const approvedCount = useMemo(
    () => events.filter((event) => event.approval_status === "approved").length,
    [events]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEvent(null);
  };

  const startEditing = (event: ClubEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title ?? "",
      description: event.description ?? "",
      category: event.category ?? "",
      event_date: event.event_date ? event.event_date.slice(0, 10) : "",
      location: event.location ?? "",
      is_club_members_only: Boolean(event.is_club_members_only),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!managedClub) return;
    if (!form.title.trim()) {
      setError("Event title is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      event_date: form.event_date || null,
      location: form.location.trim() || null,
      is_club_members_only: form.is_club_members_only,
      club_id: managedClub.id,
      approval_status:
        editingEvent?.approval_status === "approved"
          ? "pending"
          : editingEvent?.approval_status ?? "pending",
    };

    if (editingEvent) {
      const { error: updateError } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editingEvent.id)
        .eq("club_id", managedClub.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setEvents((prev) =>
          prev.map((event) =>
            event.id === editingEvent.id ? { ...event, ...payload } : event
          )
        );
        setSuccess(
          editingEvent.approval_status === "approved"
            ? "Event updated and sent back for admin approval."
            : "Event updated successfully."
        );
        resetForm();
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("events")
        .insert(payload)
        .select(
          "id, title, description, category, event_date, location, approval_status, created_at, is_club_members_only, club_id"
        )
        .single();

      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        setEvents((prev) => [data as ClubEvent, ...prev]);
        setSuccess("Event created and submitted for admin approval.");
        resetForm();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (eventId: string) => {
    if (!managedClub) return;

    setDeletingId(eventId);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId)
      .eq("club_id", managedClub.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      if (editingEvent?.id === eventId) {
        resetForm();
      }
      setSuccess("Event removed.");
    }

    setDeletingId(null);
  };

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Club Events</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, update, and manage the events for your club.
          </p>
        </div>
        {managedClub && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">
              Managed Club
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {managedClub.name?.trim() || managedClub.title?.trim() || "Your Club"}
            </p>
          </div>
        )}
      </div>

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

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Events</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{events.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Approval</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Approved</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{approvedCount}</p>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingEvent ? "Edit Event" : "Create New Event"}
            </h2>
            <p className="text-xs text-slate-400">
              New events are submitted as pending so the main admin dashboard can approve them.
            </p>
          </div>
          {editingEvent && (
            <button
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Event Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Enter the event title"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Category
            </label>
            <input
              type="text"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Workshop, Hackathon, Seminar..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Event Date
            </label>
            <input
              type="date"
              value={form.event_date}
              onChange={(event) => setForm((prev) => ({ ...prev, event_date: event.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="Where will this happen?"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Description
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Describe the event for students"
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_club_members_only}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    is_club_members_only: event.target.checked,
                  }))
                }
              />
              Members only event
            </label>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60"
          >
            {saving
              ? editingEvent
                ? "Saving..."
                : "Creating..."
              : editingEvent
              ? "Save Event"
              : "Create Event"}
          </button>
          {!editingEvent && (
            <span className="self-center text-xs text-slate-400">
              The admin can approve it later from the admin dashboard.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Your Club Events</h2>
          <p className="text-xs text-slate-400">
            Approved, pending, and rejected events linked to your club.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            No events found for this club yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => {
              const status = event.approval_status ?? "approved";

              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{event.title}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
                          statusStyles[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {status}
                      </span>
                      {event.is_club_members_only && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                          Members only
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {event.description || "No description provided."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                      <span>{event.category || "No category"}</span>
                      <span>
                        {event.event_date
                          ? new Date(event.event_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "No date"}
                      </span>
                      <span>{event.location || "No location"}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(event)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={deletingId === event.id}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === event.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
