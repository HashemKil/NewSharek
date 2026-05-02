"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  event_date: string | null;
  location: string | null;
  approval_status: string | null;
  created_at: string | null;
  source_url: string | null;
  is_club_members_only: boolean | null;
};

type EditableFields = {
  title: string;
  description: string;
  category: string;
  event_date: string;
  location: string;
  is_club_members_only: boolean;
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

type TeamMember = {
  user_id: string;
  profiles: { full_name: string | null } | null;
};

type Team = {
  id: string;
  name: string;
  created_at: string | null;
  team_members: TeamMember[];
};

type PageTab = "pending" | "active";
type ModalTab = "details" | "registrations" | "teams" | "edit";

// ─── Devpost fetcher ──────────────────────────────────────────────────────────

async function fetchDevpostEvents(): Promise<AdminEvent[]> {
  const res = await fetch("/api/devpost");
  if (!res.ok) return [];
  const json = await res.json();
  const hackathons: Record<string, unknown>[] = json?.hackathons ?? [];
  return [
    ...hackathons.slice(0, 12).map((h) => ({
      id: `__devpost_${h.id ?? Math.random()}`,
      title: (h.title as string) ?? "Untitled",
      description: (h.tagline as string) ?? null,
      category:
        ((h as { themes?: { name: string }[] }).themes?.[0]?.name) ??
        "Hackathon",
      event_date:
        (h.submission_period_dates as string)?.split(" - ")[1] ?? null,
      location: (h.location as string) ?? null,
      approval_status: "pending",
      created_at: new Date().toISOString(),
      // Use the real hackathon URL so each event has a unique source_url
      source_url: (h.url as string | undefined) ?? `https://devpost.com/hackathons/${String(h.id)}`,
      is_club_members_only: false,
    })),
    {
      id: "__mock_2",
      title: "Machine Learning Workshop",
      description:
        "Hands-on workshop introducing the fundamentals of ML using Python and scikit-learn. No prior experience required.",
      category: "Workshop",
      event_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      location: "CS Lab 204",
      approval_status: "pending",
      created_at: new Date().toISOString(),
      source_url: null,
      is_club_members_only: false,
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  approved: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  pending: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-400",
  },
  rejected: {
    badge: "bg-red-50 text-red-600 ring-red-200",
    dot: "bg-red-500",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Hackathon: "bg-purple-50 text-purple-700",
  Workshop: "bg-blue-50 text-blue-700",
  Competition: "bg-orange-50 text-orange-700",
  Seminar: "bg-teal-50 text-teal-700",
  Conference: "bg-indigo-50 text-indigo-700",
  Career: "bg-pink-50 text-pink-700",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isUpcoming(event: AdminEvent) {
  if (!event.event_date) return false;
  return new Date(event.event_date) >= new Date();
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / 86400000
  );
  if (diff < 0) return null;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

// ─── Small shared components ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? {
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function CategoryPill({ category }: { category: string | null }) {
  if (!category) return null;
  const color =
    CATEGORY_COLORS[category] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {category}
    </span>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </label>
  );
}

function EmptyState({
  icon,
  message,
  sub,
}: {
  icon: React.ReactNode;
  message: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-14 text-center">
      <span className="text-slate-300">{icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-500">{message}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Pending Event Card (scraper side — editable) ─────────────────────────────

function PendingCard({
  event,
  isMock,
  onClick,
}: {
  event: AdminEvent;
  isMock: boolean;
  onClick: () => void;
}) {
  const countdown = daysUntil(event.event_date);

  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full flex-col rounded-2xl border text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-300/40 ${
        isMock
          ? "border-dashed border-slate-300 bg-slate-50"
          : "border-slate-200 bg-white hover:border-amber-300"
      }`}
    >
      {/* Top accent */}
      <div className="h-1 w-full rounded-t-2xl bg-amber-400" />

      {isMock && (
        <div className="absolute right-3 top-3">
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 p-5">
        {/* Pills row */}
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill category={event.category} />
          {event.is_club_members_only && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              Club members only
            </span>
          )}
          {countdown && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              {countdown}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-amber-700">
          {event.title}
        </h3>

        {/* Description */}
        {event.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
            {event.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          {event.event_date && (
            <span className="flex items-center gap-1">
              <CalendarIcon />
              {formatDate(event.event_date)}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1 max-w-[160px]">
              <PinIcon />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>

        {event.source_url && (
          <div
            className="flex items-center gap-1 text-xs text-[#1e3a8a]"
            onClick={(e) => e.stopPropagation()}
          >
            <LinkIcon />
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline truncate"
            >
              {event.source_url}
            </a>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        <span>Scraped {formatDate(event.created_at)}</span>
        <span className="flex items-center gap-1 font-semibold text-amber-600 opacity-0 transition-opacity group-hover:opacity-100">
          Edit &amp; review
          <ChevronRightIcon />
        </span>
      </div>
    </button>
  );
}

// ─── Active Event Card (approved/live side — read-only) ───────────────────────

function ActiveCard({
  event,
  onClick,
}: {
  event: AdminEvent;
  onClick: () => void;
}) {
  const upcoming = isUpcoming(event);
  const countdown = daysUntil(event.event_date);

  return (
    <button
      onClick={onClick}
      className="group relative flex w-full flex-col rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
    >
      {/* Top accent */}
      <div className="h-1 w-full rounded-t-2xl bg-emerald-500" />

      <div className="flex flex-col gap-3 p-5">
        {/* Pills row */}
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill category={event.category} />
          {event.is_club_members_only && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              Club members only
            </span>
          )}
          {upcoming && countdown && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {countdown}
            </span>
          )}
          {!upcoming && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              Ended
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-emerald-700">
          {event.title}
        </h3>

        {/* Description */}
        {event.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
            {event.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          {event.event_date && (
            <span className="flex items-center gap-1">
              <CalendarIcon />
              {formatDate(event.event_date)}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1 max-w-[160px]">
              <PinIcon />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live on platform
        </span>
        <span className="flex items-center gap-1 font-semibold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
          View details
          <ChevronRightIcon />
        </span>
      </div>
    </button>
  );
}

// ─── Pending Event Modal (edit + approve/deny) ────────────────────────────────

function PendingModal({
  event,
  isMock,
  onClose,
  onUpdated,
  onApproved,
  onDeleted,
}: {
  event: AdminEvent;
  isMock: boolean;
  onClose: () => void;
  onUpdated: (updated: AdminEvent) => void;
  onApproved: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [edit, setEdit] = useState<EditableFields>({
    title: event.title ?? "",
    description: event.description ?? "",
    category: event.category ?? "",
    event_date: event.event_date ? event.event_date.slice(0, 10) : "",
    location: event.location ?? "",
    is_club_members_only: Boolean(event.is_club_members_only),
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const handleSave = async () => {
    if (isMock) {
      // Devpost event — INSERT as pending into DB
      setSaving(true); setSaveError(""); setSaveSuccess("");
      const { data, error } = await supabase.from("events").insert({
        title: edit.title, description: edit.description || null,
        category: edit.category || null, event_date: edit.event_date || null,
        location: edit.location || null, source_url: event.source_url || null,
        approval_status: "pending",
      }).select("id").single();
      if (error) { setSaveError(error.message); } else {
        setSaveSuccess("Imported as pending event.");
        setTimeout(() => setSaveSuccess(""), 3000);
        onUpdated({ ...event, ...edit, id: data.id, approval_status: "pending" });
      }
      setSaving(false);
      return;
    }
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    const { error } = await supabase
      .from("events")
      .update({
        title: edit.title,
        description: edit.description || null,
        category: edit.category || null,
        event_date: edit.event_date || null,
        location: edit.location || null,
        is_club_members_only: edit.is_club_members_only,
      })
      .eq("id", event.id);

    if (error) {
      setSaveError(error.message);
    } else {
      setSaveSuccess("Changes saved.");
      setTimeout(() => setSaveSuccess(""), 3000);
      onUpdated({
        ...event,
        ...edit,
        category: edit.category || null,
        description: edit.description || null,
        event_date: edit.event_date || null,
        location: edit.location || null,
        is_club_members_only: edit.is_club_members_only,
      });
    }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: "approved" | "rejected") => {
    if (isMock) {
      setApproving(true); setSaveError("");
      if (newStatus === "approved") {
        const { error } = await supabase.from("events").insert({
          title: edit.title, description: edit.description || null,
          category: edit.category || null, event_date: edit.event_date || null,
          location: edit.location || null, source_url: event.source_url || null,
          approval_status: "approved",
        }).select("id").single();
        if (error) { setSaveError(error.message); setApproving(false); return; }
        onApproved(event.id);
      } else {
        onDeleted(event.id);
      }
      setApproving(false); onClose();
      return;
    }
    setApproving(true);
    setSaveError("");
    setSaveSuccess("");
    const { error } = await supabase
      .from("events")
      .update({ approval_status: newStatus })
      .eq("id", event.id);

    if (error) {
      setSaveError(error.message);
    } else {
      setSaveSuccess(`Event ${newStatus}.`);
      setTimeout(() => setSaveSuccess(""), 2000);
      if (newStatus === "approved") {
        onApproved(event.id);
      } else {
        onUpdated({ ...event, approval_status: newStatus });
      }
      onClose();
    }
    setApproving(false);
  };

  const handleDelete = async () => {
    if (isMock) { onDeleted(event.id); onClose(); return; }
    setDeleting(true);
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) { setSaveError(error.message); setDeleting(false); setDeleteConfirm(false); }
    else { onDeleted(event.id); onClose(); }
  };

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          {isMock && (
            <span className="w-fit rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
              From Devpost
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <CategoryPill category={event.category} />
            {event.is_club_members_only && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                Club members only
              </span>
            )}
            <StatusBadge status="pending" />
          </div>
          <h2 className="text-base font-bold text-slate-900">{event.title}</h2>
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#1e3a8a] hover:underline"
            >
              <LinkIcon />
              Scraped from: {event.source_url}
            </a>
          )}
        </div>
        <button onClick={onClose} aria-label="Close" className="flex-shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-6">
          {saveError && <AlertBox type="error">{saveError}</AlertBox>}
          {saveSuccess && <AlertBox type="success">{saveSuccess}</AlertBox>}



          {/* Edit form */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Title</Label>
              <input type="text" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={inputCls} />
            </div>
            <div>
              <Label>Category</Label>
              <input type="text" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="e.g. Workshop, Hackathon" className={inputCls} />
            </div>
            <div>
              <Label>Date</Label>
              <input type="date" value={edit.event_date} onChange={(e) => setEdit({ ...edit, event_date: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <Label>Location</Label>
              <input type="text" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="e.g. Room 101, Main Building" className={inputCls} />
            </div>
            <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={edit.is_club_members_only}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    is_club_members_only: e.target.checked,
                  })
                }
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Club members only
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Only students who joined the responsible club can register.
                </span>
              </span>
            </label>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Event description…" className={`${inputCls} resize-none`} />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="self-start rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>

          <div className="border-t border-slate-100" />

          {/* Approval actions */}
          <div>
            <Label>Approval decision</Label>
            <p className="mb-3 text-xs text-slate-400">
              Save your edits first, then approve or reject the event.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleStatusChange("approved")}
                disabled={approving}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckIcon />
                {approving ? "Processing…" : "Approve & publish"}
              </button>
              <button
                onClick={() => handleStatusChange("rejected")}
                disabled={approving}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                <CloseIcon size={14} />
                {approving ? "Processing…" : "Reject event"}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Danger zone */}
          <div>
            <Label>Danger zone</Label>
            {deleteConfirm ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">Are you sure?</span>
                <button onClick={handleDelete} disabled={deleting} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button onClick={() => setDeleteConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                <TrashIcon />
                Delete event
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Active Event Modal (read + edit + registrations + teams) ─────────────────

function ActiveModal({
  event,
  onClose,
  onUpdated,
}: {
  event: AdminEvent;
  onClose: () => void;
  onUpdated: (updated: AdminEvent) => void;
}) {
  const [activeTab, setActiveTab] = useState<ModalTab>("details");
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState("");
  // Edit tab state
  const [edit, setEdit] = useState<EditableFields>({
    title: event.title ?? "",
    description: event.description ?? "",
    category: event.category ?? "",
    event_date: event.event_date ? event.event_date.slice(0, 10) : "",
    location: event.location ?? "",
    is_club_members_only: Boolean(event.is_club_members_only),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const upcoming = isUpcoming(event);

  const handleSaveEdit = async () => {
    setSaving(true); setSaveError(""); setSaveSuccess("");
    const { error } = await supabase.from("events").update({
      title: edit.title,
      description: edit.description || null,
      category: edit.category || null,
      event_date: edit.event_date || null,
      location: edit.location || null,
    }).eq("id", event.id);
    if (error) { setSaveError(error.message); }
    else {
      setSaveSuccess("Changes saved.");
      setTimeout(() => setSaveSuccess(""), 3000);
      onUpdated({ ...event, ...edit, category: edit.category || null, description: edit.description || null, event_date: edit.event_date || null, location: edit.location || null });
    }
    setSaving(false);
  };

  useEffect(() => {
    if (activeTab !== "registrations") return;
    const load = async () => {
      setRegLoading(true);
      setRegError("");
      try {
        // Fetch registrations first
        const { data: regData, error: regErr } = await supabase
          .from("event_registrations")
          .select("id, user_id, created_at")
          .eq("event_id", event.id)
          .order("created_at", { ascending: false });
        if (regErr) {
          if (regErr.code === "42P01") { setRegistrants([]); setRegLoading(false); return; }
          setRegError(regErr.message); setRegLoading(false); return;
        }
        if (!regData || regData.length === 0) { setRegistrants([]); setRegLoading(false); return; }

        // Then fetch profiles for those user IDs
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
      } catch { setRegError("Failed to load registrations."); }
      setRegLoading(false);
    };
    load();
  }, [activeTab, event.id]);

  useEffect(() => {
    if (activeTab !== "teams") return;
    const load = async () => {
      setTeamsLoading(true);
      setTeamsError("");
      try {
        const { data, error } = await supabase
          .from("teams")
          .select("id, name, created_at, team_members(user_id, profiles(full_name))")
          .eq("event_id", event.id)
          .order("created_at", { ascending: true });
        if (error) {
          if (error.code === "42P01") setTeams([]);
          else setTeamsError(error.message);
        } else {
          setTeams((data as unknown as Team[]) ?? []);
        }
      } catch { setTeamsError("Failed to load teams."); }
      setTeamsLoading(false);
    };
    load();
  }, [activeTab, event.id]);

  const tabs: { key: ModalTab; label: string }[] = [
    { key: "details", label: "Event Info" },
    { key: "edit", label: "Edit" },
    { key: "registrations", label: "Registrations" },
    { key: "teams", label: "Teams" },
  ];

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryPill category={event.category} />
            <StatusBadge status="approved" />
            {upcoming ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                Upcoming
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                Ended
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900">{event.title}</h2>
          <p className="text-xs text-slate-400">
            Published {formatDateTime(event.created_at)}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex-shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <CloseIcon />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Event Info ── */}
        {activeTab === "details" && (
          <div className="flex flex-col gap-5 p-6">
            <InfoRow icon={<CalendarIcon />} label="Date" value={formatDate(event.event_date)} />
            <InfoRow icon={<PinIcon />} label="Location" value={event.location ?? "—"} />
            <InfoRow icon={<TagIcon />} label="Category" value={event.category ?? "—"} />
            {event.source_url && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Source
                </p>
                <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[#1e3a8a] hover:underline">
                  <LinkIcon />
                  {event.source_url}
                </a>
              </div>
            )}
            {event.description && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {event.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Edit ── */}
        {activeTab === "edit" && (
          <div className="flex flex-col gap-5 p-6">
            {saveError && <AlertBox type="error">{saveError}</AlertBox>}
            {saveSuccess && <AlertBox type="success">{saveSuccess}</AlertBox>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Title</Label>
                <input type="text" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label>Category</Label>
                <input type="text" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="e.g. Workshop, Hackathon" className={inputCls} />
              </div>
              <div>
                <Label>Date</Label>
                <input type="date" value={edit.event_date} onChange={(e) => setEdit({ ...edit, event_date: e.target.value })} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <Label>Location</Label>
                <input type="text" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="e.g. Room 101" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={`${inputCls} resize-none`} />
              </div>
            </div>
            <button onClick={handleSaveEdit} disabled={saving} className="self-start rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <p className="text-xs text-slate-400">Changes are reflected live on the homepage immediately after saving.</p>
          </div>
        )}

        {/* ── Registrations ── */}
        {activeTab === "registrations" && (
          <div className="p-6">
            <p className="mb-4 text-sm text-slate-500">
              Users who registered for this event.
            </p>
            {regLoading ? (
              <LoadingSkeleton rows={4} />
            ) : regError ? (
              <AlertBox type="error">{regError}</AlertBox>
            ) : registrants.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon />}
                message="No registrations yet."
                sub="Registered users will appear here once they sign up."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
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
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{r.profiles?.full_name ?? "—"}</p>
                          <p className="text-xs text-slate-400">{r.profiles?.email ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.profiles?.student_id ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{r.profiles?.major ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Teams ── */}
        {activeTab === "teams" && (
          <div className="p-6">
            {teamsLoading ? (
              <LoadingSkeleton rows={3} height="h-20" />
            ) : teamsError ? (
              <AlertBox type="error">{teamsError}</AlertBox>
            ) : teams.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon />}
                message="No teams formed yet."
                sub="Teams created by participants will appear here."
              />
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <div key={team.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-semibold text-slate-800">{team.name}</h4>
                      <span className="rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-xs font-medium text-[#1e3a8a]">
                        {team.team_members?.length ?? 0} member{(team.team_members?.length ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {team.team_members?.map((m) => (
                        <span key={m.user_id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                          {m.profiles?.full_name ?? "Unknown"}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Formed {formatDate(team.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Shared modal shell ───────────────────────────────────────────────────────

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Mini helpers ─────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0 text-slate-400">{icon}</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function AlertBox({ type, children }: { type: "error" | "success"; children: React.ReactNode }) {
  const styles = type === "error"
    ? "border-red-200 bg-red-50 text-red-600"
    : "border-green-200 bg-green-50 text-green-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function LoadingSkeleton({ rows = 4, height = "h-14" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-xl bg-slate-100`} />
      ))}
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ─── API Sources Panel ────────────────────────────────────────────────────────

type ApiSource = { id: string; name: string; curl: string };

function ApiSourcesPanel({ onClose }: { onClose: () => void }) {
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [curl, setCurl] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await supabase.from("site_settings").select("value").eq("key", "api_sources").single();
    setSources((data?.value as ApiSource[]) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const persist = async (next: ApiSource[]) => {
    setSaving(true);
    await supabase.from("site_settings").upsert({ key: "api_sources", value: next, updated_at: new Date().toISOString() });
    setSources(next);
    setSaving(false);
  };

  const handleAdd = () => {
    if (!name.trim() || !curl.trim()) { setErr("Both name and cURL are required."); return; }
    persist([...sources, { id: crypto.randomUUID(), name: name.trim(), curl: curl.trim() }]);
    setName(""); setCurl(""); setErr("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">API Sources</h2>
            <p className="text-xs text-slate-400">Manage cURL data sources for event discovery.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"><CloseIcon /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Built-in Devpost */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Built-in source</p>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-800 text-sm">Devpost — Recommended Hackathons</p>
                <p className="text-xs text-slate-400 mt-0.5">https://devpost.com/api/hackathons/recommended_hackathons</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
            </div>
          </div>

          {/* Custom sources */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Custom sources ({sources.length})</p>
            {loading ? (
              <div className="space-y-2">{[...Array(2)].map((_,i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-slate-400">No custom sources added yet.</p>
            ) : (
              <div className="space-y-2">
                {sources.map(s => (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                        <pre className="mt-1 text-xs text-slate-400 whitespace-pre-wrap break-all line-clamp-3 font-mono">{s.curl}</pre>
                      </div>
                      <button onClick={() => persist(sources.filter(x => x.id !== s.id))} disabled={saving} className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new */}
          <div className="rounded-2xl border border-[#1e3a8a]/20 bg-[#f5f8ff] p-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">Add new source</p>
            {err && <p className="mb-3 text-xs text-red-600">{err}</p>}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Source name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MLH Hackathons" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">cURL command</label>
                <textarea rows={5} value={curl} onChange={e => setCurl(e.target.value)} placeholder={"curl 'https://api.example.com/events' \\\n  -H 'accept: application/json'"} className={`${inputCls} resize-none font-mono text-xs`} />
              </div>
              <button onClick={handleAdd} disabled={saving} className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-60">
                {saving ? "Saving…" : "Add source"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [devpostEvents, setDevpostEvents] = useState<AdminEvent[]>([]);
  const [devpostLoading, setDevpostLoading] = useState(false);
  const devpostFetchedRef = useRef(false);
  const [error, setError] = useState("");
  const [pageTab, setPageTab] = useState<PageTab>("pending");
  const [search, setSearch] = useState("");
  const [selectedPending, setSelectedPending] = useState<{ event: AdminEvent; isMock: boolean } | null>(null);
  const [selectedActive, setSelectedActive] = useState<AdminEvent | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [zincSyncing, setZincSyncing] = useState(false);
  const [zincMsg, setZincMsg] = useState("");

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    const baseSelect =
      "id, title, description, category, event_date, location, approval_status, created_at, source_url";
    const { data, error: fetchError } = await supabase
      .from("events")
      .select(`${baseSelect}, is_club_members_only`)
      .order("created_at", { ascending: false });

    if (fetchError) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("events")
        .select(baseSelect)
        .order("created_at", { ascending: false });

      if (fallbackError) setError(fallbackError.message);
      else setEvents((fallbackData ?? []) as AdminEvent[]);
    } else {
      setEvents(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(loadEvents);
  }, []);

  const pendingEvents = useMemo(
    () => events.filter((e) => (e.approval_status ?? "pending") === "pending" || e.approval_status === "rejected"),
    [events]
  );

  // Always fetch Devpost once on mount — show alongside DB pending events
  useEffect(() => {
    if (devpostFetchedRef.current) return;
    devpostFetchedRef.current = true;
    setDevpostLoading(true);
    fetchDevpostEvents()
      .then(setDevpostEvents)
      .finally(() => setDevpostLoading(false));
  }, []);

  const activeEvents = useMemo(
    () => events.filter((e) => e.approval_status === "approved"),
    [events]
  );

  const term = search.trim().toLowerCase();

  const filteredPending = useMemo(
    () =>
      pendingEvents.filter(
        (e) =>
          !term ||
          e.title?.toLowerCase().includes(term) ||
          e.category?.toLowerCase().includes(term) ||
          e.location?.toLowerCase().includes(term)
      ),
    [pendingEvents, term]
  );

  const filteredActive = useMemo(
    () =>
      activeEvents.filter(
        (e) =>
          !term ||
          e.title?.toLowerCase().includes(term) ||
          e.category?.toLowerCase().includes(term) ||
          e.location?.toLowerCase().includes(term)
      ),
    [activeEvents, term]
  );

  // When a DB event is approved it moves to active tab
  const handleApproved = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, approval_status: "approved" } : e))
    );
    setPageTab("active");
  };

  // Filter out Devpost events already imported to DB (matched by unique source_url)
  const importedUrls = useMemo(
    () => new Set(events.map((e) => e.source_url).filter(Boolean)),
    [events]
  );
  const freshDevpostEvents = useMemo(
    () => devpostEvents.filter((de) => !de.source_url || !importedUrls.has(de.source_url)),
    [devpostEvents, importedUrls]
  );
  const filteredDevpost = useMemo(
    () =>
      freshDevpostEvents.filter(
        (e) =>
          !term ||
          e.title?.toLowerCase().includes(term) ||
          e.category?.toLowerCase().includes(term) ||
          e.location?.toLowerCase().includes(term)
      ),
    [freshDevpostEvents, term]
  );

  // Merge: DB pending events first, then fresh Devpost/mock events
  const displayPending = [...filteredPending, ...filteredDevpost];
  const pendingCount = pendingEvents.length + freshDevpostEvents.length;

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and approve events, or monitor live events and their participants.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Sync Zinc button */}
          <button
            onClick={async () => {
              setZincSyncing(true);
              setZincMsg("");
              try {
                const res = await fetch("/api/zinc-scraper");
                const json = await res.json();
                setZincMsg(json.message ?? json.error ?? "Done");
                if (res.ok && json.inserted > 0) {
                  await loadEvents(); // refresh DB events so new zinc events appear
                }
              } catch {
                setZincMsg("Failed to contact scraper.");
              }
              setZincSyncing(false);
            }}
            disabled={zincSyncing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-60"
          >
            {zincSyncing ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            )}
            {zincSyncing ? "Syncing…" : "Sync Zinc"}
          </button>

          <button
            onClick={() => setShowSources(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#1e3a8a] hover:text-[#1e3a8a]"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Manage Sources
          </button>
        </div>
      </div>

      {/* Zinc sync status message */}
      {zincMsg && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          zincMsg.toLowerCase().includes("error") || zincMsg.toLowerCase().includes("unauthorized") || zincMsg.toLowerCase().includes("not set")
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {zincMsg}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Page-level tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm w-fit">
        <TabBtn
          active={pageTab === "pending"}
          onClick={() => setPageTab("pending")}
          dot="bg-amber-400"
          label="Pending Review"
          count={pendingCount}
        />
        <TabBtn
          active={pageTab === "active"}
          onClick={() => setPageTab("active")}
          dot="bg-emerald-500"
          label="Live Events"
          count={activeEvents.length}
        />
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-sm">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
        />
      </div>

      {/* ── Pending tab ── */}
      {pageTab === "pending" && (
        <>

          {(loading || devpostLoading) ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1e3a8a] border-t-transparent" />
              <p className="text-sm text-slate-500">{loading ? "Loading events…" : "Fetching live events from Devpost…"}</p>
            </div>
          ) : displayPending.length === 0 ? (
            <EmptyState
              icon={<svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
              message="No pending events."
              sub="All caught up — or Devpost returned no results."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayPending.map((event) => {
                const isMock = event.id.startsWith("__");
                return (
                  <PendingCard
                    key={event.id}
                    event={event}
                    isMock={isMock}
                    onClick={() => setSelectedPending({ event, isMock })}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Active tab ── */}
      {pageTab === "active" && (
        loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-slate-200" />)}
          </div>
        ) : filteredActive.length === 0 ? (
          <EmptyState
            icon={
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            message="No live events yet."
            sub="Approved events will appear here and be visible on the home screen."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredActive.map((event) => (
              <ActiveCard key={event.id} event={event} onClick={() => setSelectedActive(event)} />
            ))}
          </div>
        )
      )}

      {/* Modals */}
      {selectedPending && (
        <PendingModal
          event={selectedPending.event}
          isMock={selectedPending.isMock}
          onClose={() => setSelectedPending(null)}
          onUpdated={(updated) => {
            if (selectedPending.isMock) {
              // Was Devpost — now in DB; remove from devpost list, reload DB events
              setDevpostEvents((prev) => prev.filter((e) => e.id !== selectedPending.event.id));
              loadEvents();
            } else {
              setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            }
            setSelectedPending(null);
          }}
          onApproved={(id) => {
            if (selectedPending.isMock) {
              setDevpostEvents((prev) => prev.filter((e) => e.id !== id));
              loadEvents();
              setPageTab("active");
            } else {
              handleApproved(id);
            }
            setSelectedPending(null);
          }}
          onDeleted={(id) => {
            if (selectedPending.isMock) {
              setDevpostEvents((prev) => prev.filter((e) => e.id !== id));
            } else {
              setEvents((prev) => prev.filter((e) => e.id !== id));
            }
            setSelectedPending(null);
          }}
        />
      )}
      {selectedActive && (
        <ActiveModal
          event={selectedActive}
          onClose={() => setSelectedActive(null)}
          onUpdated={(updated) => {
            setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            setSelectedActive(updated);
          }}
        />
      )}
      {showSources && <ApiSourcesPanel onClose={() => setShowSources(false)} />}
    </div>
  );
}

// Tab button helper
function TabBtn({
  active,
  onClick,
  dot,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? "bg-[#1e3a8a] text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${active ? "bg-white/70" : dot}`} />
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
        {count}
      </span>
    </button>
  );
}
