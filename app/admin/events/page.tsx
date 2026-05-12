"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  EVENT_CATEGORIES,
  inferEventCategory,
  normalizeEventCategory,
} from "../../../lib/eventCategories";
import { supabase } from "../../../lib/supabase";
import { formatTagLabel } from "../../../lib/tagLabels";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type AdminEvent = {
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
  source_url: string | null;
  is_club_members_only: boolean | null;
  club_id: string | null;
  is_team_based: boolean | null;
  is_university_event: boolean | null;
  max_capacity: number | null;
  team_min_size: number | null;
  team_max_size: number | null;
};

type EditableFields = {
  title: string;
  description: string;
  category: string;
  prize: string;
  event_date: string;
  end_date: string;
  registration_deadline: string;
  start_time: string;
  end_time: string;
  location: string;
  location_details: string;
  image_url: string;
  is_club_members_only: boolean;
  club_id: string;
  is_team_based: boolean;
  is_university_event: boolean;
  max_capacity: string;
  team_min_size: string;
  team_max_size: string;
};

type Registrant = {
  id: string;
  user_id: string | null;
  created_at: string | null;
  status?: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    student_id: string | null;
    major: string | null;
  } | null;
};

type TeamMember = {
  id: string;
  user_id: string;
  status: string | null;
  profiles: {
    full_name: string | null;
    email?: string | null;
    student_id?: string | null;
  } | null;
};

type Team = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  max_members?: number | null;
  created_at: string | null;
  team_members: TeamMember[];
};

type ClubOption = {
  id: string;
  name: string | null;
  title?: string | null;
};

type PageTab = "pending" | "working" | "done";
type ModalTab = "details" | "registrations" | "teams" | "edit";

type CreateEventForm = EditableFields & {
  approval_status: "approved" | "pending";
};

const MAX_EVENT_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

const readImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });

// â”€â”€â”€ Devpost fetcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseDevpostDateRange(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { startDate: null, endDate: null, registrationDeadline: null };
  }

  const parts = value
    .split(/\s+(?:-|–|—)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const endText = parts.at(-1) ?? value;
  const year = endText.match(/\b(20\d{2})\b/)?.[1];
  const startText = parts[0] && year && !/\b20\d{2}\b/.test(parts[0]) ? `${parts[0]}, ${year}` : parts[0];

  const parse = (text: string | undefined) => {
    if (!text) return null;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  };

  const startDate = parse(startText);
  const endDate = parse(endText);

  return {
    startDate: startDate ?? endDate,
    endDate: endDate ?? startDate,
    registrationDeadline: endDate ?? startDate,
  };
}

function isFutureDateString(value: string | null) {
  if (!value) return false;
  return value >= new Date().toISOString().slice(0, 10);
}
async function fetchDevpostEvents(): Promise<AdminEvent[]> {
  const res = await fetch("/api/devpost");
  if (!res.ok) return [];
  const json = await res.json();
  const hackathons: Record<string, unknown>[] = json?.hackathons ?? [];

  return hackathons
    .map((h) => {
      const dates = parseDevpostDateRange(h.submission_period_dates);
      return {
        id: `__devpost_${h.id ?? Math.random()}`,
        title: (h.title as string) ?? "Untitled",
        description: (h.tagline as string) ?? null,
        category: normalizeEventCategory(
          ((h as { themes?: { name: string }[] }).themes?.[0]?.name) ??
            "Hackathon"
        ),
        prize: null,
        image_url: null,
        event_date: dates.startDate,
        end_date: dates.endDate,
        registration_deadline: dates.registrationDeadline,
        start_time: null,
        end_time: null,
        location: (h.location as string) ?? null,
        location_details: null,
        approval_status: "pending",
        created_at: new Date().toISOString(),
        source_url: (h.url as string | undefined) ?? `https://devpost.com/hackathons/${String(h.id)}`,
        is_club_members_only: false,
        club_id: null,
        is_team_based: true,
        is_university_event: false,
        max_capacity: null,
        team_min_size: null,
        team_max_size: null,
      };
    })
    .filter((event) =>
      isFutureDateString(event.registration_deadline ?? event.end_date ?? event.event_date)
    )
    .slice(0, 12);
}

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
  Academic: "bg-blue-50 text-blue-700",
  Technology: "bg-indigo-50 text-indigo-700",
  Career: "bg-pink-50 text-pink-700",
  Competition: "bg-orange-50 text-orange-700",
  Social: "bg-teal-50 text-teal-700",
  Other: "bg-slate-100 text-slate-600",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "-";
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

function getEventEndTime(event: AdminEvent) {
  const value = event.end_date || event.event_date;
  if (!value) return null;
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function isEventDone(event: AdminEvent) {
  const endTime = getEventEndTime(event);
  if (!endTime) return false;
  return endTime < Date.now();
}

function isOldScrapedZincEvent(event: AdminEvent) {
  return Boolean(event.source_url?.startsWith("https://zinc.jo/event/") && isEventDone(event));
}

function isRegistrationOpen(event: AdminEvent) {
  if (!event.registration_deadline) return true;
  return new Date(event.registration_deadline).getTime() >= Date.now();
}

function sortWorkingEvents(a: AdminEvent, b: AdminEvent) {
  const aTime = a.event_date ? new Date(a.event_date).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.event_date ? new Date(b.event_date).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

function sortDoneEvents(a: AdminEvent, b: AdminEvent) {
  return (getEventEndTime(b) ?? 0) - (getEventEndTime(a) ?? 0);
}

function normalizeDuplicateText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getDuplicateEventKey(event: AdminEvent) {
  const dateKey = event.event_date ? event.event_date.slice(0, 10) : "no-date";
  return `${normalizeDuplicateText(event.title)}|${dateKey}`;
}

function dedupeEvents<T extends AdminEvent>(items: T[]) {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = getDuplicateEventKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const existingScore =
      (existing.description?.length ?? 0) +
      (existing.location?.length ?? 0) +
      (existing.source_url?.length ?? 0);
    const itemScore =
      (item.description?.length ?? 0) +
      (item.location?.length ?? 0) +
      (item.source_url?.length ?? 0);

    if (itemScore > existingScore) {
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values());
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

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

// â”€â”€â”€ Small shared components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      {formatTagLabel(status)}
    </span>
  );
}

function CategoryPill({
  category,
  title,
  description,
}: {
  category: string | null;
  title?: string | null;
  description?: string | null;
}) {
  const normalizedCategory = inferEventCategory(category, title, description);
  if (!normalizedCategory) return null;
  const color =
    CATEGORY_COLORS[normalizedCategory] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {normalizedCategory}
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

// â”€â”€â”€ Pending Event Card (scraper side â€” editable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          <CategoryPill category={event.category} title={event.title} description={event.description} />
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

// â”€â”€â”€ Active Event Card (approved/live side â€” read-only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ActiveCard({
  event,
  onClick,
}: {
  event: AdminEvent;
  onClick: () => void;
}) {
  const upcoming = isUpcoming(event);
  const done = isEventDone(event);
  const countdown = daysUntil(event.event_date);

  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full flex-col rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 ${
        done
          ? "hover:border-slate-300 focus:ring-slate-300/40"
          : "hover:border-emerald-300 focus:ring-emerald-300/40"
      }`}
    >
      {/* Top accent */}
      <div className={`h-1 w-full rounded-t-2xl ${done ? "bg-slate-400" : "bg-emerald-500"}`} />

      <div className="flex flex-col gap-3 p-5">
        {/* Pills row */}
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill category={event.category} title={event.title} description={event.description} />
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
          {done && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              Done
            </span>
          )}
          {!done && !isRegistrationOpen(event) && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              Registration closed
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
          <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-slate-400" : "bg-emerald-500"}`} />
          {done ? "Finished" : "Available"}
        </span>
        <span className={`flex items-center gap-1 font-semibold opacity-0 transition-opacity group-hover:opacity-100 ${
          done ? "text-slate-600" : "text-emerald-600"
        }`}>
          View details
          <ChevronRightIcon />
        </span>
      </div>
    </button>
  );
}

// â”€â”€â”€ Pending Event Modal (edit + approve/deny) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PendingModal({
  event,
  clubs,
  isMock,
  onClose,
  onUpdated,
  onApproved,
  onDeleted,
}: {
  event: AdminEvent;
  clubs: ClubOption[];
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
    club_id: event.club_id ?? "",
    is_team_based: Boolean(event.is_team_based),
    is_university_event: Boolean(event.is_university_event),
    max_capacity: event.max_capacity ? String(event.max_capacity) : "",
    team_min_size: event.team_min_size ? String(event.team_min_size) : "",
    team_max_size: event.team_max_size ? String(event.team_max_size) : "",
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const handleSave = async () => {
    const selectedCategory = normalizeEventCategory(edit.category);
    if (!selectedCategory) {
      setSaveError("Choose an event category.");
      return;
    }
    if (edit.is_club_members_only && !edit.club_id) {
      setSaveError("Choose the club that owns this members-only event.");
      return;
    }
    if (
      edit.is_team_based &&
      edit.team_min_size &&
      edit.team_max_size &&
      Number(edit.team_min_size) > Number(edit.team_max_size)
    ) {
      setSaveError("Minimum team size cannot be larger than maximum team size.");
      return;
    }

    if (isMock) {
      // Devpost event â€” INSERT as pending into DB
      setSaving(true); setSaveError(""); setSaveSuccess("");
      const { data, error } = await supabase.from("events").insert({
        title: edit.title, description: edit.description || null,
        category: selectedCategory, event_date: edit.event_date || null,
        prize: edit.prize.trim() || null,
        end_date: edit.end_date || edit.event_date || null,
        registration_deadline: edit.registration_deadline || null,
        start_time: edit.start_time || null,
        end_time: edit.end_time || null,
        location: edit.location || null, source_url: event.source_url || null,
        location_details: edit.location_details.trim() || null,
        is_club_members_only: edit.is_club_members_only,
        club_id: edit.is_club_members_only ? edit.club_id : null,
        is_team_based: edit.is_team_based,
        is_university_event: edit.is_university_event,
        max_capacity: edit.max_capacity ? Number(edit.max_capacity) : null,
        team_min_size: edit.is_team_based && edit.team_min_size ? Number(edit.team_min_size) : null,
        team_max_size: edit.is_team_based && edit.team_max_size ? Number(edit.team_max_size) : null,
        approval_status: "pending",
      }).select("id").single();
      if (error) { setSaveError(error.message); } else {
        setSaveSuccess("Imported as pending event.");
        setTimeout(() => setSaveSuccess(""), 3000);
        onUpdated({
          ...event,
          id: data.id,
          title: edit.title,
          description: edit.description || null,
          category: selectedCategory,
          prize: edit.prize.trim() || null,
          event_date: edit.event_date || null,
          end_date: edit.end_date || edit.event_date || null,
          registration_deadline: edit.registration_deadline || null,
          start_time: edit.start_time || null,
          end_time: edit.end_time || null,
          location: edit.location || null,
          location_details: edit.location_details.trim() || null,
          is_club_members_only: edit.is_club_members_only,
          club_id: edit.is_club_members_only ? edit.club_id : null,
          is_team_based: edit.is_team_based,
          is_university_event: edit.is_university_event,
          max_capacity: edit.max_capacity ? Number(edit.max_capacity) : null,
          team_min_size: edit.is_team_based && edit.team_min_size ? Number(edit.team_min_size) : null,
          team_max_size: edit.is_team_based && edit.team_max_size ? Number(edit.team_max_size) : null,
          approval_status: "pending",
        });
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
        category: selectedCategory,
        prize: edit.prize.trim() || null,
        event_date: edit.event_date || null,
        end_date: edit.end_date || edit.event_date || null,
        registration_deadline: edit.registration_deadline || null,
        start_time: edit.start_time || null,
        end_time: edit.end_time || null,
        location: edit.location || null,
        location_details: edit.location_details.trim() || null,
        is_club_members_only: edit.is_club_members_only,
        club_id: edit.is_club_members_only ? edit.club_id : null,
        is_team_based: edit.is_team_based,
        is_university_event: edit.is_university_event,
        max_capacity: edit.max_capacity ? Number(edit.max_capacity) : null,
        team_min_size: edit.is_team_based && edit.team_min_size ? Number(edit.team_min_size) : null,
        team_max_size: edit.is_team_based && edit.team_max_size ? Number(edit.team_max_size) : null,
      })
      .eq("id", event.id);

    if (error) {
      setSaveError(error.message);
    } else {
      setSaveSuccess("Changes saved.");
      setTimeout(() => setSaveSuccess(""), 3000);
      onUpdated({
        ...event,
        category: selectedCategory,
        description: edit.description || null,
        prize: edit.prize.trim() || null,
        event_date: edit.event_date || null,
        end_date: edit.end_date || edit.event_date || null,
        registration_deadline: edit.registration_deadline || null,
        start_time: edit.start_time || null,
        end_time: edit.end_time || null,
        location: edit.location || null,
        location_details: edit.location_details.trim() || null,
        is_club_members_only: edit.is_club_members_only,
        club_id: edit.is_club_members_only ? edit.club_id : null,
        is_team_based: edit.is_team_based,
        is_university_event: edit.is_university_event,
        max_capacity: edit.max_capacity ? Number(edit.max_capacity) : null,
        team_min_size: edit.is_team_based && edit.team_min_size ? Number(edit.team_min_size) : null,
        team_max_size: edit.is_team_based && edit.team_max_size ? Number(edit.team_max_size) : null,
      });
    }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: "approved" | "rejected") => {
    if (isMock) {
      const selectedCategory = normalizeEventCategory(edit.category);
      if (newStatus === "approved" && !selectedCategory) {
        setSaveError("Choose an event category.");
        return;
      }
      setApproving(true); setSaveError("");
      if (newStatus === "approved") {
        const { error } = await supabase.from("events").insert({
          title: edit.title, description: edit.description || null,
          category: selectedCategory, event_date: edit.event_date || null,
          prize: edit.prize.trim() || null,
          end_date: edit.end_date || edit.event_date || null,
          registration_deadline: edit.registration_deadline || null,
          start_time: edit.start_time || null,
          end_time: edit.end_time || null,
          location: edit.location || null, source_url: event.source_url || null,
          location_details: edit.location_details.trim() || null,
          is_club_members_only: edit.is_club_members_only,
          club_id: edit.is_club_members_only ? edit.club_id : null,
          is_team_based: edit.is_team_based,
          is_university_event: edit.is_university_event,
          max_capacity: edit.max_capacity ? Number(edit.max_capacity) : null,
          team_min_size: edit.is_team_based && edit.team_min_size ? Number(edit.team_min_size) : null,
          team_max_size: edit.is_team_based && edit.team_max_size ? Number(edit.team_max_size) : null,
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
            <CategoryPill category={event.category} title={event.title} description={event.description} />
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
              <CategorySelect
                value={edit.category}
                onChange={(category) => setEdit({ ...edit, category })}
              />
            </div>
            <div>
              <Label>Prize</Label>
              <input
                type="text"
                value={edit.prize}
                onChange={(e) => setEdit({ ...edit, prize: e.target.value })}
                placeholder="Optional prize"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Date</Label>
              <input type="date" value={edit.event_date} onChange={(e) => setEdit({ ...edit, event_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <Label>Registration Deadline</Label>
              <input
                type="datetime-local"
                value={edit.registration_deadline}
                onChange={(e) => setEdit({ ...edit, registration_deadline: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Location</Label>
              <input type="text" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="e.g. Room 101, Main Building" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <Label>Location Details</Label>
              <textarea
                rows={3}
                value={edit.location_details}
                onChange={(e) => setEdit({ ...edit, location_details: e.target.value })}
                placeholder="Optional: building, floor, room, entrance, parking, or directions"
                className={`${inputCls} resize-none`}
              />
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
            {edit.is_club_members_only && (
              <div className="sm:col-span-2">
                <Label>Owning Club</Label>
                <select
                  value={edit.club_id}
                  onChange={(e) => setEdit({ ...edit, club_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Choose a club</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name?.trim() || club.title?.trim() || "Untitled club"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={edit.is_team_based}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    is_team_based: e.target.checked,
                    team_min_size: e.target.checked ? edit.team_min_size : "",
                    team_max_size: e.target.checked ? edit.team_max_size : "",
                  })
                }
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Team based
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Students register by creating or joining a team.
                </span>
              </span>
            </label>
            {edit.is_team_based && (
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <div>
                  <Label>Minimum Team Size</Label>
                  <input
                    type="number"
                    min="1"
                    value={edit.team_min_size}
                    onChange={(e) => setEdit({ ...edit, team_min_size: e.target.value })}
                    placeholder="e.g. 2"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Maximum Team Size</Label>
                  <input
                    type="number"
                    min={edit.team_min_size || "1"}
                    value={edit.team_max_size}
                    onChange={(e) => setEdit({ ...edit, team_max_size: e.target.value })}
                    placeholder="e.g. 5"
                    className={inputCls}
                  />
                </div>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Event description..." className={`${inputCls} resize-none`} />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="self-start rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60">
            {saving ? "Saving..." : "Save changes"}
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
                {approving ? "Processing..." : "Approve & publish"}
              </button>
              <button
                onClick={() => handleStatusChange("rejected")}
                disabled={approving}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                <CloseIcon size={14} />
                {approving ? "Processing..." : "Reject event"}
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
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button onClick={() => setDeleteConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-2 rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
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

// â”€â”€â”€ Active Event Modal (read + edit + registrations + teams) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CreateEventModal({
  onClose,
  onCreated,
  clubs,
  clubsError,
}: {
  onClose: () => void;
  onCreated: (created: AdminEvent) => void;
  clubs: ClubOption[];
  clubsError: string;
}) {
  const [form, setForm] = useState<CreateEventForm>({
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
    club_id: "",
    is_team_based: false,
    is_university_event: false,
    max_capacity: "",
    team_min_size: "",
    team_max_size: "",
    approval_status: "approved",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");

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

  const handleCreate = async () => {
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
    if (form.is_club_members_only && !form.club_id) {
      setError("Choose the club that owns this members-only event.");
      return;
    }
    if (
      form.is_team_based &&
      form.team_min_size &&
      form.team_max_size &&
      Number(form.team_min_size) > Number(form.team_max_size)
    ) {
      setError("Minimum team size cannot be larger than maximum team size.");
      return;
    }

    setSaving(true);
    setError("");

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
      club_id: form.is_club_members_only ? form.club_id : null,
      is_team_based: form.is_team_based,
      is_university_event: form.is_university_event,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
      team_min_size: form.is_team_based && form.team_min_size ? Number(form.team_min_size) : null,
      team_max_size: form.is_team_based && form.team_max_size ? Number(form.team_max_size) : null,
      approval_status: form.approval_status,
      source_url: null,
    };

    let { data, error: insertError } = await supabase
      .from("events")
      .insert(payload)
      .select(
        "id, title, description, category, prize, image_url, event_date, end_date, registration_deadline, start_time, end_time, location, location_details, approval_status, created_at, source_url, is_club_members_only, club_id, is_team_based, is_university_event, max_capacity, team_min_size, team_max_size"
      )
      .single();

    if (insertError && /image_url|column/i.test(insertError.message)) {
      const payloadWithoutImage: Partial<typeof payload> = { ...payload };
      delete payloadWithoutImage.image_url;
      const retry = await supabase
        .from("events")
        .insert(payloadWithoutImage)
        .select(
          "id, title, description, category, prize, event_date, end_date, registration_deadline, start_time, end_time, location, location_details, approval_status, created_at, source_url, is_club_members_only, club_id, is_team_based, is_university_event, max_capacity, team_min_size, team_max_size"
        )
        .single();
      data = retry.data
        ? ({ ...retry.data, image_url: null } as typeof data)
        : null;
      insertError = retry.error;
    }

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    onCreated(data as AdminEvent);
    setSaving(false);
    onClose();
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Create Event</h2>
          <p className="mt-1 text-xs text-slate-500">
            Add a platform event directly from the admin dashboard.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex-shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {error && (
            <div className="sm:col-span-2">
              <AlertBox type="error">{error}</AlertBox>
            </div>
          )}

          <div className="sm:col-span-2">
            <Label>Title</Label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Event title"
              className={inputCls}
            />
          </div>

          <div>
            <Label>Category</Label>
            <CategorySelect
              value={form.category}
              onChange={(category) => setForm({ ...form, category })}
            />
          </div>

          <div>
            <Label>Prize</Label>
            <input
              type="text"
              value={form.prize}
              onChange={(e) => setForm({ ...form, prize: e.target.value })}
              placeholder="Optional, e.g. 500 JOD or certificates"
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Event Image</Label>
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
            <Label>Start Date</Label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Registration Deadline</Label>
            <input
              type="datetime-local"
              value={form.registration_deadline}
              onChange={(e) =>
                setForm({ ...form, registration_deadline: e.target.value })
              }
              className={inputCls}
            />
          </div>

          <div>
            <Label>Start Time</Label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <Label>End Time</Label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Location</Label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Where will this happen?"
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Location Details</Label>
            <textarea
              rows={3}
              value={form.location_details}
              onChange={(e) =>
                setForm({ ...form, location_details: e.target.value })
              }
              placeholder="Optional: building, floor, room, entrance, parking, or directions"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <Label>Capacity</Label>
            <input
              type="number"
              min="1"
              value={form.max_capacity}
              onChange={(e) => setForm({ ...form, max_capacity: e.target.value })}
              placeholder={
                form.is_team_based
                  ? "Number of teams"
                  : "Leave blank for unlimited"
              }
              className={inputCls}
            />
            {form.is_team_based && (
              <p className="mt-1 text-xs text-slate-400">
                For team-based events, capacity is the number of approved teams.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Describe the event for students"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <Label>Status</Label>
            <select
              value={form.approval_status}
              onChange={(e) =>
                setForm({
                  ...form,
                  approval_status:
                    e.target.value as CreateEventForm["approval_status"],
                })
              }
              className={inputCls}
            >
              <option value="approved">Publish now</option>
              <option value="pending">Save for review</option>
            </select>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_team_based}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_team_based: e.target.checked,
                  team_min_size: e.target.checked ? form.team_min_size : "",
                  team_max_size: e.target.checked ? form.team_max_size : "",
                })
              }
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Team based
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Students register by creating or joining a team.
              </span>
            </span>
          </label>

          {form.is_team_based && (
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Minimum Team Size</Label>
                <input
                  type="number"
                  min="1"
                  value={form.team_min_size}
                  onChange={(e) => setForm({ ...form, team_min_size: e.target.value })}
                  placeholder="e.g. 2"
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Maximum Team Size</Label>
                <input
                  type="number"
                  min={form.team_min_size || "1"}
                  value={form.team_max_size}
                  onChange={(e) => setForm({ ...form, team_max_size: e.target.value })}
                  placeholder="e.g. 5"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_university_event}
              onChange={(e) =>
                setForm({ ...form, is_university_event: e.target.checked })
              }
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                University event
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Mark it as an official platform event.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_club_members_only}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_club_members_only: e.target.checked,
                  club_id: e.target.checked ? form.club_id : "",
                })
              }
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Club members only
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Restrict registration when the event is connected to a club.
              </span>
            </span>
          </label>

          {form.is_club_members_only && (
            <div className="sm:col-span-2">
              <Label>Owning Club</Label>
              <select
                value={form.club_id}
                onChange={(e) => setForm({ ...form, club_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Choose a club</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name?.trim() || club.title?.trim() || "Untitled club"}
                  </option>
                ))}
              </select>
              {clubsError && (
                <p className="mt-2 text-xs text-red-500">{clubsError}</p>
              )}
              {!clubsError && clubs.length === 0 && (
                <p className="mt-2 text-xs text-slate-400">Loading clubs...</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create event"}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
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

function ActiveModal({
  event,
  clubs,
  onClose,
  onUpdated,
}: {
  event: AdminEvent;
  clubs: ClubOption[];
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
  const [teamSavingId, setTeamSavingId] = useState<string | null>(null);
  const [memberSavingId, setMemberSavingId] = useState<string | null>(null);
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [addMemberStudentId, setAddMemberStudentId] = useState("");
  // Edit tab state
  const [edit, setEdit] = useState<EditableFields>({
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
    club_id: event.club_id ?? "",
    is_team_based: Boolean(event.is_team_based),
    is_university_event: Boolean(event.is_university_event),
    max_capacity: event.max_capacity ? String(event.max_capacity) : "",
    team_min_size: event.team_min_size ? String(event.team_min_size) : "",
    team_max_size: event.team_max_size ? String(event.team_max_size) : "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const upcoming = isUpcoming(event);

  const handleSaveEdit = async () => {
    const selectedCategory = normalizeEventCategory(edit.category);
    if (!selectedCategory) {
      setSaveError("Choose an event category.");
      return;
    }
    if (edit.is_club_members_only && !edit.club_id) {
      setSaveError("Choose the club that owns this members-only event.");
      return;
    }
    if (
      edit.is_team_based &&
      edit.team_min_size &&
      edit.team_max_size &&
      Number(edit.team_min_size) > Number(edit.team_max_size)
    ) {
      setSaveError("Team minimum size cannot be larger than the maximum size.");
      return;
    }

    setSaving(true); setSaveError(""); setSaveSuccess("");
    const { error } = await supabase.from("events").update({
      title: edit.title,
      description: edit.description || null,
      category: selectedCategory,
      prize: edit.prize.trim() || null,
      event_date: edit.event_date || null,
      end_date: edit.end_date || edit.event_date || null,
      registration_deadline: edit.registration_deadline || null,
      start_time: edit.start_time || null,
      end_time: edit.end_time || null,
      location: edit.location || null,
      location_details: edit.location_details.trim() || null,
      is_club_members_only: edit.is_club_members_only,
      club_id: edit.is_club_members_only ? edit.club_id : null,
      is_team_based: edit.is_team_based,
      is_university_event: edit.is_university_event,
      max_capacity: edit.max_capacity ? Number(edit.max_capacity) : null,
      team_min_size: edit.is_team_based && edit.team_min_size ? Number(edit.team_min_size) : null,
      team_max_size: edit.is_team_based && edit.team_max_size ? Number(edit.team_max_size) : null,
    }).eq("id", event.id);
    if (error) { setSaveError(error.message); }
    else {
      setSaveSuccess("Changes saved.");
      setTimeout(() => setSaveSuccess(""), 3000);
      onUpdated({
        ...event,
        ...edit,
        category: selectedCategory,
        description: edit.description || null,
        prize: edit.prize.trim() || null,
        event_date: edit.event_date || null,
        end_date: edit.end_date || edit.event_date || null,
        registration_deadline: edit.registration_deadline || null,
        start_time: edit.start_time || null,
        end_time: edit.end_time || null,
        location: edit.location || null,
        location_details: edit.location_details.trim() || null,
        is_club_members_only: edit.is_club_members_only,
        club_id: edit.is_club_members_only ? edit.club_id : null,
        is_team_based: edit.is_team_based,
        is_university_event: edit.is_university_event,
        max_capacity: edit.max_capacity ? Number(edit.max_capacity) : null,
        team_min_size: edit.is_team_based && edit.team_min_size ? Number(edit.team_min_size) : null,
        team_max_size: edit.is_team_based && edit.team_max_size ? Number(edit.team_max_size) : null,
      });
    }
    setSaving(false);
  };

  useEffect(() => {
    if (activeTab !== "registrations") return;
    const load = async () => {
      setRegLoading(true);
      setRegError("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setRegError("You need to be signed in as an admin to view registrations.");
          setRegLoading(false);
          return;
        }

        const response = await fetch(
          `/api/admin/event-registrations?eventId=${encodeURIComponent(event.id)}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const json = await response.json();

        if (!response.ok) {
          setRegError(json?.error || "Failed to load registrations.");
          setRegLoading(false);
          return;
        }

        setRegistrants((json?.registrations ?? []) as Registrant[]);
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
          .select("id, name, description, status, max_members, created_at, team_members(id, user_id, status, profiles(full_name, email, student_id))")
          .ilike("event", event.title)
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
  }, [activeTab, event.title]);

  const updateTeamStatus = async (teamId: string, status: "approved" | "rejected") => {
    if (status === "approved" && event.max_capacity) {
      const approvedTeams = teams.filter(
        (team) => (team.status ?? "pending") === "approved" && team.id !== teamId
      ).length;

      if (approvedTeams >= event.max_capacity) {
        setTeamsError(`This event is already at its ${event.max_capacity} team capacity.`);
        return;
      }
    }

    setTeamSavingId(teamId);
    setTeamsError("");
    const { error } = await supabase.from("teams").update({ status }).eq("id", teamId);

    if (error) {
      setTeamsError(error.message);
    } else {
      setTeams((prev) =>
        prev.map((team) => (team.id === teamId ? { ...team, status } : team))
      );
    }
    setTeamSavingId(null);
  };

  const updateMemberStatus = async (
    memberId: string,
    status: "approved" | "rejected" | "pending" | "invited"
  ) => {
    setMemberSavingId(memberId);
    setTeamsError("");
    const { error } = await supabase
      .from("team_members")
      .update({ status })
      .eq("id", memberId);

    if (error) {
      setTeamsError(error.message);
    } else {
      setTeams((prev) =>
        prev.map((team) => ({
          ...team,
          team_members: team.team_members.map((member) =>
            member.id === memberId ? { ...member, status } : member
          ),
        }))
      );
    }
    setMemberSavingId(null);
  };

  const addMemberToTeam = async (teamId: string) => {
    const studentId = addMemberStudentId.trim();
    if (!studentId) {
      setTeamsError("Student ID is required.");
      return;
    }

    setTeamSavingId(teamId);
    setTeamsError("");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, student_id")
      .eq("student_id", studentId)
      .maybeSingle();

    if (profileError || !profile) {
      setTeamsError(profileError?.message || "No profile found for this Student ID.");
      setTeamSavingId(null);
      return;
    }

    const { data, error } = await supabase
      .from("team_members")
      .upsert(
        { team_id: teamId, user_id: profile.id, status: "approved" },
        { onConflict: "team_id,user_id" }
      )
      .select("id, user_id, status, profiles(full_name, email, student_id)")
      .single();

    if (error) {
      setTeamsError(error.message);
    } else {
      setTeams((prev) =>
        prev.map((team) => {
          if (team.id !== teamId) return team;
          const nextMember = data as unknown as TeamMember;
          const existing = team.team_members.some(
            (member) => member.id === nextMember.id
          );

          return {
            ...team,
            team_members: existing
              ? team.team_members.map((member) =>
                  member.id === nextMember.id ? nextMember : member
                )
              : [...team.team_members, nextMember],
          };
        })
      );
      setAddMemberStudentId("");
      setAddMemberTeamId(null);
    }

    setTeamSavingId(null);
  };

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
            <CategoryPill category={event.category} title={event.title} description={event.description} />
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
        {/* â”€â”€ Event Info â”€â”€ */}
        {activeTab === "details" && (
          <div className="flex flex-col gap-5 p-6">
            <InfoRow icon={<CalendarIcon />} label="Date" value={formatDate(event.event_date)} />
            <InfoRow icon={<CalendarIcon />} label="Registration deadline" value={formatDateTime(event.registration_deadline)} />
            <InfoRow icon={<PinIcon />} label="Location" value={event.location ?? "-"} />
            {event.location_details && (
              <InfoRow icon={<PinIcon />} label="Location details" value={event.location_details} />
            )}
            <InfoRow icon={<TagIcon />} label="Category" value={inferEventCategory(event.category, event.title, event.description) || "-"} />
            {event.prize && <InfoRow icon={<TagIcon />} label="Prize" value={event.prize} />}
            {event.is_team_based && (
              <InfoRow
                icon={<PeopleIcon />}
                label="Team size"
                value={
                  event.team_min_size || event.team_max_size
                    ? `${event.team_min_size ?? 1} - ${event.team_max_size ?? "unlimited"} members`
                    : "Not specified"
                }
              />
            )}
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

        {/* â”€â”€ Edit â”€â”€ */}
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
                <CategorySelect
                  value={edit.category}
                  onChange={(category) => setEdit({ ...edit, category })}
                />
              </div>
              <div>
                <Label>Prize</Label>
                <input
                  type="text"
                  value={edit.prize}
                  onChange={(e) => setEdit({ ...edit, prize: e.target.value })}
                  placeholder="Optional prize"
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Date</Label>
                <input type="date" value={edit.event_date} onChange={(e) => setEdit({ ...edit, event_date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label>Registration Deadline</Label>
                <input
                  type="datetime-local"
                  value={edit.registration_deadline}
                  onChange={(e) => setEdit({ ...edit, registration_deadline: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Location</Label>
                <input type="text" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="e.g. Room 101" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <Label>Location Details</Label>
                <textarea
                  rows={3}
                  value={edit.location_details}
                  onChange={(e) => setEdit({ ...edit, location_details: e.target.value })}
                  placeholder="Optional: building, floor, room, entrance, parking, or directions"
                  className={`${inputCls} resize-none`}
                />
              </div>
              <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={edit.is_club_members_only}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      is_club_members_only: e.target.checked,
                      club_id: e.target.checked ? edit.club_id : "",
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Club members only
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Only members of the owning club can register.
                  </span>
                </span>
              </label>
              {edit.is_club_members_only && (
                <div className="sm:col-span-2">
                  <Label>Owning Club</Label>
                  <select
                    value={edit.club_id}
                    onChange={(e) => setEdit({ ...edit, club_id: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Choose a club</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name?.trim() || club.title?.trim() || "Untitled club"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={edit.is_team_based}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      is_team_based: e.target.checked,
                      team_min_size: e.target.checked ? edit.team_min_size : "",
                      team_max_size: e.target.checked ? edit.team_max_size : "",
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Team based
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Students register by creating or joining a team.
                  </span>
                </span>
              </label>
              {edit.is_team_based && (
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <div>
                    <Label>Minimum Team Size</Label>
                    <input
                      type="number"
                      min="1"
                      value={edit.team_min_size}
                      onChange={(e) => setEdit({ ...edit, team_min_size: e.target.value })}
                      placeholder="e.g. 2"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Maximum Team Size</Label>
                    <input
                      type="number"
                      min={edit.team_min_size || "1"}
                      value={edit.team_max_size}
                      onChange={(e) => setEdit({ ...edit, team_max_size: e.target.value })}
                      placeholder="e.g. 5"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={`${inputCls} resize-none`} />
              </div>
            </div>
            <button onClick={handleSaveEdit} disabled={saving} className="self-start rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60">
              {saving ? "Saving..." : "Save changes"}
            </button>
            <p className="text-xs text-slate-400">Changes are reflected live on the homepage immediately after saving.</p>
          </div>
        )}

        {/* â”€â”€ Registrations â”€â”€ */}
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
                          <p className="font-medium text-slate-800">{r.profiles?.full_name ?? "-"}</p>
                          <p className="text-xs text-slate-400">{r.profiles?.email ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.profiles?.student_id ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-500">{r.profiles?.major ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Teams â”€â”€ */}
        {activeTab === "teams" && (
          <div className="p-6">
            {event.is_team_based && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Team capacity:{" "}
                <span className="font-semibold text-slate-900">
                  {event.max_capacity
                    ? `${event.max_capacity} teams`
                    : "Unlimited teams"}
                </span>
              </div>
            )}
            {teamsLoading ? (
              <LoadingSkeleton rows={3} height="h-20" />
            ) : teams.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon />}
                message="No teams formed yet."
                sub="Teams created by participants will appear here."
              />
            ) : (
              <div className="space-y-4">
                {teamsError && <AlertBox type="error">{teamsError}</AlertBox>}
                {teams.map((team) => {
                  const status = team.status ?? "pending";
                  const approvedCount =
                    team.team_members?.filter((member) => member.status === "approved")
                      .length ?? 0;

                  return (
                  <div key={team.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-800">{team.name}</h4>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : status === "rejected"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {formatTagLabel(status)}
                          </span>
                        </div>
                        {team.description && (
                          <p className="mt-1 text-xs text-slate-500">{team.description}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {approvedCount} approved member{approvedCount !== 1 ? "s" : ""}
                          {team.max_members ? ` / ${team.max_members}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => updateTeamStatus(team.id, "approved")}
                          disabled={teamSavingId === team.id || status === "approved"}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve team
                        </button>
                        <button
                          onClick={() => updateTeamStatus(team.id, "rejected")}
                          disabled={teamSavingId === team.id || status === "rejected"}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {team.team_members?.map((m) => (
                        <div key={m.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {m.profiles?.full_name ?? "Unknown"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {m.profiles?.student_id ?? "No student ID"} - {formatTagLabel(m.status ?? "pending")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => updateMemberStatus(m.id, "approved")}
                              disabled={memberSavingId === m.id || m.status === "approved"}
                              className="rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateMemberStatus(m.id, "rejected")}
                              disabled={memberSavingId === m.id || m.status === "rejected"}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {addMemberTeamId === team.id ? (
                      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row">
                        <input
                          type="text"
                          value={addMemberStudentId}
                          onChange={(e) => setAddMemberStudentId(e.target.value)}
                          placeholder="Student ID"
                          className={inputCls}
                        />
                        <button
                          onClick={() => addMemberToTeam(team.id)}
                          disabled={teamSavingId === team.id}
                          className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setAddMemberTeamId(null);
                            setAddMemberStudentId("");
                          }}
                          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddMemberTeamId(team.id)}
                        className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Add member by Student ID
                      </button>
                    )}
                    <p className="mt-2 text-xs text-slate-400">Formed {formatDate(team.created_at)}</p>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// â”€â”€â”€ Shared modal shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Mini helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ SVG Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ API Sources Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                <p className="font-semibold text-slate-800 text-sm">Devpost - Recommended Hackathons</p>
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
                {saving ? "Saving..." : "Add source"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [clubsError, setClubsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [devpostEvents, setDevpostEvents] = useState<AdminEvent[]>([]);
  const [devpostLoading, setDevpostLoading] = useState(false);
  const devpostFetchedRef = useRef(false);
  const [error, setError] = useState("");
  const [pageTab, setPageTab] = useState<PageTab>("pending");
  const [search, setSearch] = useState("");
  const [selectedPending, setSelectedPending] = useState<{ event: AdminEvent; isMock: boolean } | null>(null);
  const [selectedActive, setSelectedActive] = useState<AdminEvent | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [zincSyncing, setZincSyncing] = useState(false);
  const [zincMsg, setZincMsg] = useState("");

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    const fallbackSelect =
      "id, title, description, category, event_date, location, approval_status, created_at, source_url";
    const baseSelect =
      "id, title, description, category, prize, image_url, event_date, end_date, registration_deadline, start_time, end_time, location, location_details, approval_status, created_at, source_url, club_id, is_team_based, is_university_event, max_capacity, team_min_size, team_max_size";
    const { data, error: fetchError } = await supabase
      .from("events")
      .select(`${baseSelect}, is_club_members_only`)
      .order("created_at", { ascending: false });

    if (fetchError) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("events")
        .select(fallbackSelect)
        .order("created_at", { ascending: false });

      if (fallbackError) setError(fallbackError.message);
      else setEvents((fallbackData ?? []) as AdminEvent[]);
    } else {
      setEvents(data ?? []);
    }
    setLoading(false);
  };

  const loadClubs = async () => {
    setClubsError("");

    const { data, error } = await supabase
      .from("clubs")
      .select("id, name")
      .order("name", { ascending: true });

    if (!error && data && data.length > 0) {
      setClubs(data as ClubOption[]);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setClubsError("Sign in again to load clubs.");
      return;
    }

    try {
      const res = await fetch("/api/admin/clubs", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();

      if (!res.ok) {
        setClubsError(json.error ?? error?.message ?? "Could not load clubs.");
        return;
      }

      setClubs((json.clubs ?? []) as ClubOption[]);
      if ((json.clubs ?? []).length === 0) {
        setClubsError("No clubs found. Create clubs before assigning an owning club.");
      }
    } catch {
      setClubsError(error?.message ?? "Could not load clubs.");
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadEvents();
      loadClubs();
    });
  }, []);

  const pendingEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          ((e.approval_status ?? "pending") === "pending" || e.approval_status === "rejected") &&
          !isOldScrapedZincEvent(e)
      ),
    [events]
  );

  // Always fetch Devpost once on mount â€” show alongside DB pending events
  useEffect(() => {
    if (devpostFetchedRef.current) return;
    devpostFetchedRef.current = true;
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return;
      setDevpostLoading(true);
      fetchDevpostEvents()
        .then((data) => {
          if (!cancelled) setDevpostEvents(data);
        })
        .finally(() => {
          if (!cancelled) setDevpostLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const approvedEvents = useMemo(
    () => events.filter((e) => e.approval_status === "approved"),
    [events]
  );

  const workingEvents = useMemo(
    () => approvedEvents.filter((e) => !isEventDone(e)).sort(sortWorkingEvents),
    [approvedEvents]
  );

  const openWorkingCount = useMemo(
    () =>
      workingEvents.filter(
        (event) =>
          isRegistrationOpen(event) &&
          (!event.max_capacity || event.max_capacity > 0)
      ).length,
    [workingEvents]
  );

  const doneEvents = useMemo(
    () => approvedEvents.filter(isEventDone).sort(sortDoneEvents),
    [approvedEvents]
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

  const filteredWorking = useMemo(
    () =>
      workingEvents.filter(
        (e) =>
          !term ||
          e.title?.toLowerCase().includes(term) ||
          e.category?.toLowerCase().includes(term) ||
          e.location?.toLowerCase().includes(term)
      ),
    [workingEvents, term]
  );

  const filteredDone = useMemo(
    () =>
      doneEvents.filter(
        (e) =>
          !term ||
          e.title?.toLowerCase().includes(term) ||
          e.category?.toLowerCase().includes(term) ||
          e.location?.toLowerCase().includes(term)
      ),
    [doneEvents, term]
  );

  // When a DB event is approved it moves to active tab
  const handleApproved = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, approval_status: "approved" } : e))
    );
    const approvedEvent = events.find((event) => event.id === id);
    setPageTab(approvedEvent && isEventDone(approvedEvent) ? "done" : "working");
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
  const dedupedPendingEvents = useMemo(
    () => dedupeEvents([...pendingEvents, ...freshDevpostEvents]),
    [pendingEvents, freshDevpostEvents]
  );
  const displayPending = dedupeEvents([...filteredPending, ...filteredDevpost]);
  const pendingCount = dedupedPendingEvents.length;

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10 2xl:px-12">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and approve events, or monitor live events and their participants.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => setShowCreateEvent(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af]"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create Event
          </button>

          {/* Sync Zinc button */}
          <button
            onClick={async () => {
              setZincSyncing(true);
              setZincMsg("");
              try {
                // â”€â”€ Browser-side scraping (avoids server geo-restrictions) â”€â”€
                // The browser is in Jordan so zinc.jo is reachable.
                // We use corsproxy.io to allow cross-origin POST from the browser.
                const IT_KW = [
                  "tech","technology","software","hardware","ai","artificial intelligence",
                  "machine learning","ml","data","cyber","security","programming","coding",
                  "developer","web","mobile","app","digital","cloud","devops","automation",
                  "blockchain","robotics","iot","computer","information technology"," it ",
                  "startup","innovation","hackathon","bootcamp","workshop","seminar",
                  "conference","javascript","python","react","node","api","ui","ux",
                  "design","network","stem","engineering","training",
                ];
                const isIT = (title: string, desc: string) => {
                  const t = `${title} ${desc}`.toLowerCase();
                  return IT_KW.some((k) => t.includes(k));
                };
                const cleanText = (value: string) => {
                  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
                  const withoutHtml = withoutCdata.replace(/<[^>]+>/g, " ");
                  const textarea = document.createElement("textarea");
                  textarea.innerHTML = withoutHtml;
                  return textarea.value.replace(/\s+/g, " ").trim();
                };
                const normalizeScrapedDate = (value: string | null | undefined) => {
                  if (!value) return null;
                  const trimmed = value.trim();
                  if (!trimmed) return null;

                  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                  if (iso) {
                    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
                  }

                  const slash = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
                  if (slash) {
                    return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
                  }

                  const parsed = new Date(trimmed);
                  if (Number.isNaN(parsed.getTime())) return null;
                  return parsed.toISOString().slice(0, 10);
                };
                const todayIso = new Date().toISOString().slice(0, 10);
                const isStillUsefulEvent = (startDate: string | null, endDate: string | null) => {
                  const finalDate = normalizeScrapedDate(endDate) ?? normalizeScrapedDate(startDate);
                  return !!finalDate && finalDate >= todayIso;
                };
                const getTag = (block: string, tag: string) => {
                  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
                  return m ? cleanText(m[1]) : "";
                };
                const getFirstTag = (block: string, tags: string[]) => {
                  for (const tag of tags) {
                    const value = getTag(block, tag);
                    if (value) return value;
                  }
                  return "";
                };
                const absoluteZincUrl = (value: string) => {
                  if (!value) return "";
                  if (/^https?:\/\//i.test(value)) return value;
                  return `https://zinc.jo/${value.replace(/^\/+/, "")}`;
                };

                const PROXY = "https://corsproxy.io/?";
                const ZINC_URL = "https://zinc.jo/en/Events/Search_EventsFilters";
                const allEvents: {
                  title: string;
                  category: string | null;
                  description: string;
                  event_date: string | null;
                  end_date: string | null;
                  start_time: string | null;
                  end_time: string | null;
                  location: string;
                  location_details: string | null;
                  image_url: string | null;
                  source_url: string;
                }[] = [];
                let reachedZinc = false;

                for (let page = 1; page <= 5; page++) {
                  const body = new URLSearchParams({
                    PageNumber: String(page), PageSize: "20",
                    FromDate: "", ToDate: "", EventTitle: "", InsideZINC: "",
                  });
                  let xml = "";
                  try {
                    const r = await fetch(PROXY + encodeURIComponent(ZINC_URL), {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest",
                      },
                      body: body.toString(),
                    });
                    if (!r.ok) break;
                    xml = await r.text();
                  } catch { break; }

                  reachedZinc = true;
                  const rawEvents = [...xml.matchAll(/<Events>([\s\S]*?)<\/Events>/g)];
                  const pageEvents: typeof allEvents = [];
                  for (const match of rawEvents) {
                    const b = match[1];
                    const id = getTag(b, "ID");
                    if (!id) continue;
                    const title = getTag(b, "EventTitle") || "Untitled";
                    const description = getTag(b, "Description") || getTag(b, "ShortDescription");
                    if (!isIT(title, description)) continue;
                    const eventDate = getTag(b, "EventStartDate") || getTag(b, "EventEndDate") || null;
                    const endDate = getTag(b, "EventEndDate") || null;
                    if (!isStillUsefulEvent(eventDate, endDate)) continue;
                    const meetingRoom =
                      getTag(b, "MeetingRoomEnglishName") ||
                      getTag(b, "MeetingRoomArabichName");
                    const location =
                      getFirstTag(b, ["LocationEnglishName", "LocationArabicName", "VenueEnglishName", "VenueArabicName"]) ||
                      meetingRoom ||
                      "Zinc Hub, Amman";
                    const image =
                      getFirstTag(b, ["EventImage", "Image", "ImageURL", "ImageUrl", "EventImageUrl", "Logo"]) ||
                      "";
                    pageEvents.push({
                      title,
                      category: getFirstTag(b, ["CategoryEnglishName", "CategoryArabicName", "EventCategory", "EventTypeName"]) || null,
                      description,
                      event_date: eventDate,
                      end_date: endDate,
                      start_time: getFirstTag(b, ["EventStartTime", "StartTime", "FromTime"]) || null,
                      end_time: getFirstTag(b, ["EventEndTime", "EndTime", "ToTime"]) || null,
                      location,
                      location_details: meetingRoom && meetingRoom !== location ? meetingRoom : null,
                      image_url: image ? absoluteZincUrl(image) : null,
                      source_url: `https://zinc.jo/event/${id}`,
                    });
                  }
                  allEvents.push(...pageEvents);
                  if (rawEvents.length < 20) break; // last page
                }

                if (!reachedZinc) {
                  setZincMsg("Could not reach zinc.jo - the CORS proxy may be unavailable. Try again in a moment.");
                  setZincSyncing(false);
                  return;
                }

                if (allEvents.length === 0) {
                  setZincMsg("No upcoming IT-related events found on Zinc.");
                  setZincSyncing(false);
                  return;
                }

                // Save to DB via server endpoint (uses service role key)
                const res = await fetch("/api/zinc-save", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(allEvents),
                });
                const json = await res.json();
                setZincMsg(json.message ?? json.error ?? "Done");
                if (res.ok && json.inserted > 0) {
                  await loadEvents();
                }
              } catch {
                setZincMsg("Failed to contact scraper.");
              }
              setZincSyncing(false);
            }}
            disabled={zincSyncing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-60"
          id="sync-webscrapers-btn"
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
            {zincSyncing ? "Syncing..." : "Sync Webscrapers"}
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
          active={pageTab === "working"}
          onClick={() => setPageTab("working")}
          dot="bg-emerald-500"
          label={`Available (${openWorkingCount} open)`}
          count={workingEvents.length}
        />
        <TabBtn
          active={pageTab === "done"}
          onClick={() => setPageTab("done")}
          dot="bg-slate-400"
          label="Done"
          count={doneEvents.length}
        />
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-sm">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
        />
      </div>

      {/* â”€â”€ Pending tab â”€â”€ */}
      {pageTab === "pending" && (
        <>

          {(loading || devpostLoading) ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1e3a8a] border-t-transparent" />
              <p className="text-sm text-slate-500">{loading ? "Loading events..." : "Fetching live events from Devpost..."}</p>
            </div>
          ) : displayPending.length === 0 ? (
            <EmptyState
              icon={<svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
              message="No pending events."
              sub="All caught up - or Devpost returned no results."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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

      {/* â”€â”€ Active tab â”€â”€ */}
      {pageTab === "working" && (
        loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-slate-200" />)}
          </div>
        ) : filteredWorking.length === 0 ? (
          <EmptyState
            icon={
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            message="No available events."
          sub="Approved events that have not ended yet will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredWorking.map((event) => (
              <ActiveCard key={event.id} event={event} onClick={() => setSelectedActive(event)} />
            ))}
          </div>
        )
      )}

      {pageTab === "done" && (
        loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-slate-200" />)}
          </div>
        ) : filteredDone.length === 0 ? (
          <EmptyState
            icon={
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            message="No done events yet."
            sub="Approved events move here after their end date passes."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredDone.map((event) => (
              <ActiveCard key={event.id} event={event} onClick={() => setSelectedActive(event)} />
            ))}
          </div>
        )
      )}

      {/* Modals */}
      {showCreateEvent && (
        <CreateEventModal
          onClose={() => setShowCreateEvent(false)}
          clubs={clubs}
          clubsError={clubsError}
          onCreated={(created) => {
            setEvents((prev) => [created, ...prev]);
            setPageTab(
              created.approval_status === "approved"
                ? isEventDone(created)
                  ? "done"
                  : "working"
                : "pending"
            );
          }}
        />
      )}
      {selectedPending && (
        <PendingModal
          event={selectedPending.event}
          clubs={clubs}
          isMock={selectedPending.isMock}
          onClose={() => setSelectedPending(null)}
          onUpdated={(updated) => {
            if (selectedPending.isMock) {
              // Was Devpost â€” now in DB; remove from devpost list, reload DB events
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
              setPageTab("working");
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
          clubs={clubs}
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




