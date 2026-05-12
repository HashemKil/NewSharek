"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { getClubAdminContext, type ManagedClub } from "../../../lib/clubAdmin";
import {
  EVENT_CATEGORIES,
  inferEventCategory,
  normalizeEventCategory,
} from "../../../lib/eventCategories";
import { supabase } from "../../../lib/supabase";
import { formatTagLabel } from "../../../lib/tagLabels";

type ClubEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  prize: string | null;
  image_url?: string | null;
  event_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  location_details: string | null;
  approval_status: string | null;
  created_at: string | null;
  is_club_members_only: boolean | null;
  is_team_based: boolean | null;
  is_university_event: boolean | null;
  max_capacity: number | null;
  club_id: string | null;
};

type EventForm = {
  title: string;
  description: string;
  category: string;
  prize: string;
  image_url: string;
  event_date: string;
  end_date: string;
  registration_deadline: string;
  start_time: string;
  end_time: string;
  location: string;
  location_details: string;
  is_club_members_only: boolean;
  is_team_based: boolean;
  max_capacity: string;
};

type EventRegistration = {
  id: string;
  event_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  major: string | null;
  academic_year: string | null;
  status: "pending" | "approved" | "rejected" | null;
  created_at: string | null;
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10";

const MAX_EVENT_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

const readImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

const fullEventSelect =
  "id, title, description, category, prize, image_url, event_date, end_date, registration_deadline, start_time, end_time, location, location_details, approval_status, created_at, is_club_members_only, is_team_based, is_university_event, max_capacity, club_id";

const legacyEventSelect =
  "id, title, description, category, event_date, location, approval_status, created_at, is_club_members_only, club_id";

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find .* column/i.test(error.message ?? "")
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={normalizeEventCategory(value)}
      onChange={(event) => onChange(event.target.value)}
      className={inputCls}
    >
      <option value="">Choose category</option>
      {EVENT_CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}

const emptyForm: EventForm = {
  title: "",
  description: "",
  category: "",
  prize: "",
  image_url: "",
  event_date: "",
  end_date: "",
  registration_deadline: "",
  start_time: "",
  end_time: "",
  location: "",
  location_details: "",
  is_club_members_only: false,
  is_team_based: false,
  max_capacity: "",
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
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [registrationActionId, setRegistrationActionId] = useState<string | null>(null);
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
      .select(fullEventSelect)
      .eq("club_id", context.managedClub.id)
      .order("created_at", { ascending: false });

    if (eventsError) {
      if (isMissingColumnError(eventsError)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("events")
          .select(legacyEventSelect)
          .eq("club_id", context.managedClub.id)
          .order("created_at", { ascending: false });

        if (legacyError) {
          setError(legacyError.message);
          setEvents([]);
        } else {
          const legacyEvents = (legacyData ?? []) as ClubEvent[];
          setEvents(legacyEvents);
          await loadRegistrations(legacyEvents);
          setError(
            "Event schedule fields are not installed yet. Check the Supabase events table schema to enable end date, deadline, time, capacity, and team fields."
          );
        }
      } else {
        setError(eventsError.message);
        setEvents([]);
      }
    } else {
      const loadedEvents = (data ?? []) as ClubEvent[];
      setEvents(loadedEvents);
      await loadRegistrations(loadedEvents);
    }

    setLoading(false);
  };

  const loadRegistrations = async (clubEvents: ClubEvent[]) => {
    const eventIds = clubEvents.map((event) => event.id);
    if (eventIds.length === 0) {
      setRegistrations([]);
      return;
    }

    const { data, error: registrationError } = await supabase
      .from("event_registrations")
      .select(
        "id, event_id, user_id, full_name, email, student_id, major, academic_year, status, created_at"
      )
      .in("event_id", eventIds)
      .order("created_at", { ascending: false });

    if (registrationError) {
      if (isMissingColumnError(registrationError)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("event_registrations")
          .select(
            "id, event_id, user_id, full_name, email, student_id, major, academic_year, created_at"
          )
          .in("event_id", eventIds)
          .order("created_at", { ascending: false });

        if (legacyError) {
          setRegistrations([]);
          return;
        }

        setRegistrations(
          ((legacyData ?? []) as Omit<EventRegistration, "status">[]).map(
            (registration) => ({ ...registration, status: "approved" })
          )
        );
        return;
      }

      setRegistrations([]);
      return;
    }

    setRegistrations((data ?? []) as EventRegistration[]);
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

  const pendingRegistrationCount = useMemo(
    () => registrations.filter((registration) => registration.status === "pending").length,
    [registrations]
  );

  const registrationsByEventId = useMemo(() => {
    const map = new Map<string, EventRegistration[]>();
    registrations.forEach((registration) => {
      const eventRegistrations = map.get(registration.event_id) ?? [];
      eventRegistrations.push(registration);
      map.set(registration.event_id, eventRegistrations);
    });
    return map;
  }, [registrations]);

  const handleRegistrationStatus = async (
    registration: EventRegistration,
    status: "approved" | "rejected"
  ) => {
    setRegistrationActionId(registration.id);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("event_registrations")
      .update({ status })
      .eq("id", registration.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setRegistrations((current) =>
        current.map((item) =>
          item.id === registration.id ? { ...item, status } : item
        )
      );
      setSuccess(status === "approved" ? "Event join request approved." : "Event join request rejected.");
      setTimeout(() => setSuccess(""), 3000);
    }

    setRegistrationActionId(null);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEvent(null);
  };

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setSuccess("");

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    if (file.size > MAX_EVENT_IMAGE_SIZE_BYTES) {
      setError("Choose an image smaller than 3 MB.");
      return;
    }

    try {
      const imageUrl = await readImageFile(file);
      setForm((current) => ({ ...current, image_url: imageUrl }));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload this image."
      );
    }
  };

  const startEditing = (event: ClubEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title ?? "",
      description: event.description ?? "",
      category: event.category ?? "",
      prize: event.prize ?? "",
      image_url: event.image_url ?? "",
      event_date: event.event_date ? event.event_date.slice(0, 10) : "",
      end_date: event.end_date ? event.end_date.slice(0, 10) : "",
      registration_deadline: toDateTimeInput(event.registration_deadline),
      start_time: event.start_time ? event.start_time.slice(0, 5) : "",
      end_time: event.end_time ? event.end_time.slice(0, 5) : "",
      location: event.location ?? "",
      location_details: event.location_details ?? "",
      is_club_members_only: Boolean(event.is_club_members_only),
      is_team_based: Boolean(event.is_team_based),
      max_capacity: event.max_capacity ? String(event.max_capacity) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!managedClub) return;
    if (!form.title.trim()) {
      setError("Event title is required.");
      return;
    }
    const selectedCategory = normalizeEventCategory(form.category);
    if (!selectedCategory) {
      setError("Choose an event category.");
      return;
    }
    if (!form.event_date) {
      setError("Start date is required.");
      return;
    }
    if (form.end_date && form.end_date < form.event_date) {
      setError("End date cannot be before the start date.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: selectedCategory,
      prize: form.prize.trim() || null,
      image_url: form.image_url || null,
      event_date: form.event_date || null,
      end_date: form.end_date || form.event_date || null,
      registration_deadline: form.registration_deadline || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location.trim() || null,
      location_details: form.location_details.trim() || null,
      is_club_members_only: form.is_club_members_only,
      is_team_based: form.is_team_based,
      is_university_event: true,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
      club_id: managedClub.id,
      approval_status:
        editingEvent?.approval_status === "approved"
          ? "pending"
          : editingEvent?.approval_status ?? "pending",
    };
    const legacyPayload = {
      title: payload.title,
      description: payload.description,
      category: payload.category,
      event_date: payload.event_date,
      location: payload.location,
      is_club_members_only: payload.is_club_members_only,
      club_id: payload.club_id,
      approval_status: payload.approval_status,
    };

    if (editingEvent) {
      let updateError = (
        await supabase
          .from("events")
          .update(payload)
          .eq("id", editingEvent.id)
          .eq("club_id", managedClub.id)
      ).error;

      let usedLegacyPayload = false;

      if (isMissingColumnError(updateError)) {
        updateError = (
          await supabase
            .from("events")
            .update(legacyPayload)
            .eq("id", editingEvent.id)
            .eq("club_id", managedClub.id)
        ).error;
        usedLegacyPayload = !updateError;
      }

      if (updateError) {
        setError(updateError.message);
      } else {
        const nextPayload = usedLegacyPayload ? legacyPayload : payload;
      setEvents((prev) =>
          prev.map((event) =>
            event.id === editingEvent.id ? { ...event, ...nextPayload } : event
          )
        );
        setSuccess(
          usedLegacyPayload
            ? "Event updated with basic fields. Schedule details need the latest events table schema."
            : editingEvent.approval_status === "approved"
            ? "Event updated and sent back for admin approval."
            : "Event updated successfully."
        );
        resetForm();
      }
    } else {
      let insertResult = await supabase
        .from("events")
        .insert(payload)
        .select(fullEventSelect)
        .single();

      let usedLegacyPayload = false;

      if (isMissingColumnError(insertResult.error)) {
        insertResult = await supabase
          .from("events")
          .insert(legacyPayload)
          .select(legacyEventSelect)
          .single();
        usedLegacyPayload = !insertResult.error;
      }

      if (insertResult.error) {
        setError(insertResult.error.message);
      } else if (insertResult.data) {
        setEvents((prev) => [insertResult.data as ClubEvent, ...prev]);
        setSuccess(
          usedLegacyPayload
            ? "Event created with basic fields. Schedule details need the latest events table schema."
            : "Event created and submitted for admin approval."
        );
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
    <div className="px-6 py-8 lg:px-10 2xl:px-12">
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

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Join Requests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pendingRegistrationCount}</p>
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-4">
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
            <CategorySelect
              value={form.category}
              onChange={(category) =>
                setForm((prev) => ({ ...prev, category }))
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Prize
            </label>
            <input
              type="text"
              value={form.prize}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, prize: event.target.value }))
              }
              placeholder="Optional, e.g. 500 JOD or certificates"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Event Image
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {form.image_url ? (
                <div
                  role="img"
                  aria-label="Event image preview"
                  className="mb-3 h-44 w-full rounded-xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${form.image_url})` }}
                />
              ) : (
                <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
                  No image selected
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af]">
                  Upload from device
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFile}
                    className="sr-only"
                  />
                </label>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, image_url: "" }))}
                    className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Start Date
            </label>
            <input
              type="date"
              value={form.event_date}
              onChange={(event) => setForm((prev) => ({ ...prev, event_date: event.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              End Date
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Registration Deadline
            </label>
            <input
              type="datetime-local"
              value={form.registration_deadline}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  registration_deadline: event.target.value,
                }))
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Start Time
            </label>
            <input
              type="time"
              value={form.start_time}
              onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              End Time
            </label>
            <input
              type="time"
              value={form.end_time}
              onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
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
          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Location Details
            </label>
            <textarea
              rows={3}
              value={form.location_details}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  location_details: event.target.value,
                }))
              }
              placeholder="Optional: building, floor, room, entrance, parking, or directions"
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Capacity
            </label>
            <input
              type="number"
              min="1"
              value={form.max_capacity}
              onChange={(event) => setForm((prev) => ({ ...prev, max_capacity: event.target.value }))}
              placeholder={form.is_team_based ? "Number of teams" : "Leave blank for unlimited"}
              className={inputCls}
            />
            {form.is_team_based && (
              <p className="mt-1 text-xs text-slate-400">
                For team-based events, capacity is the number of approved teams.
              </p>
            )}
          </div>
          <div className="flex items-end">
            <label className="inline-flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_team_based}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    is_team_based: event.target.checked,
                  }))
                }
              />
              Team based event
            </label>
          </div>
          <div className="md:col-span-2 xl:col-span-4">
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
            {form.is_club_members_only && managedClub && (
              <p className="mt-2 text-xs text-slate-400">
                This event will be restricted to members of{" "}
                <span className="font-semibold text-slate-600">
                  {managedClub.name?.trim() || managedClub.title?.trim() || "your club"}
                </span>
                .
              </p>
            )}
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
              const eventRegistrations = registrationsByEventId.get(event.id) ?? [];
              const pendingRegistrations = eventRegistrations.filter(
                (registration) => registration.status === "pending"
              );
              const approvedRegistrations = eventRegistrations.filter(
                (registration) => (registration.status ?? "approved") === "approved"
              );

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
                        {formatTagLabel(status)}
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
                      <span>
                        {inferEventCategory(
                          event.category,
                          event.title,
                          event.description
                        ) || "No category"}
                      </span>
                      <span>
                        {event.event_date
                          ? new Date(event.event_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "No date"}
                        {event.end_date && event.end_date !== event.event_date
                          ? ` - ${new Date(event.end_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}`
                          : ""}
                      </span>
                      <span>
                        {event.start_time
                          ? `${event.start_time.slice(0, 5)}${event.end_time ? ` - ${event.end_time.slice(0, 5)}` : ""}`
                          : "No time"}
                      </span>
                      <span>
                        {event.registration_deadline
                          ? `Register by ${new Date(event.registration_deadline).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "No registration deadline"}
                      </span>
                      {event.prize && <span>Prize: {event.prize}</span>}
                      <span>{event.location || "No location"}</span>
                      {event.location_details && <span>{event.location_details}</span>}
                      <span>{event.max_capacity ? `${event.max_capacity} spots` : "Unlimited capacity"}</span>
                      <span>
                        {approvedRegistrations.length} approved
                        {pendingRegistrations.length > 0
                          ? ` · ${pendingRegistrations.length} pending`
                          : ""}
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Event join requests
                          </p>
                          <p className="text-xs text-slate-400">
                            Approve students before they become event participants.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                          {pendingRegistrations.length} pending
                        </span>
                      </div>

                      {pendingRegistrations.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-400">
                          No pending join requests.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {pendingRegistrations.map((registration) => (
                            <div
                              key={registration.id}
                              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {registration.full_name || "Unknown student"}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {registration.email || "No email"} ·{" "}
                                  {registration.student_id || "No student ID"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRegistrationStatus(registration, "approved")
                                  }
                                  disabled={registrationActionId === registration.id}
                                  className="rounded-xl bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                                >
                                  {registrationActionId === registration.id
                                    ? "Saving..."
                                    : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRegistrationStatus(registration, "rejected")
                                  }
                                  disabled={registrationActionId === registration.id}
                                  className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                        className="rounded-xl border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
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
