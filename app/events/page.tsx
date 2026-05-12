"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { EVENT_CATEGORIES, inferEventCategory } from "../../lib/eventCategories";
import { supabase } from "../../lib/supabase";
import { formatTagLabel } from "../../lib/tagLabels";

type EventRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  prize?: string | null;
  date?: string | null;
  event_date?: string | null;
  end_date?: string | null;
  registration_deadline?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_details?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  thumbnail_url?: string | null;
  club_id?: string | null;
  approval_status?: string | null;
  registered_count?: number | null;
  max_capacity?: number | null;
  computed_status?: "upcoming" | "ongoing" | "completed" | null;
  is_team_based?: boolean | null;
  is_university_event?: boolean | null;
  is_club_members_only?: boolean | null;
  responsible_club?: string | null;
};

type EventItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  prize: string | null;
  date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  location_details: string | null;
  source_url?: string | null;
  image_url: string | null;
  club_id?: string | null;
  approval_status: string | null;
  registered_count: number;
  max_capacity: number | null;
  computed_status?: "upcoming" | "ongoing" | "completed";
  is_team_based: boolean;
  is_university_event: boolean;
  is_club_members_only: boolean;
  responsible_club: string | null;
};

type NormalizedEvent = EventItem & {
  rawDateKey: string;
  displayDate: string;
  timeLabel: string;
  status: "upcoming" | "ongoing" | "completed";
  fillPercentage: number;
  isFull: boolean;
  isRegistrationClosed: boolean;
  daysFromToday: number | null;
  parsedDate: Date | null;
};

type TeamMembershipRow = {
  teams?: { event?: string | null } | { event?: string | null }[] | null;
};

type EventTypeRow = Pick<
  EventRow,
  "id" | "approval_status" | "is_team_based" | "is_university_event" | "is_club_members_only" | "club_id"
  | "end_date" | "registration_deadline"
  | "image_url" | "poster_url" | "banner_url" | "thumbnail_url"
>;

type ClubRow = {
  id: string;
  name?: string | null;
  title?: string | null;
};

type ClubMemberRow = {
  club_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  major: string | null;
  academic_year: string | null;
};

type PendingExternalJoin = {
  eventId: string;
  title: string;
  url: string;
  openedAt: number;
};

const EXTERNAL_JOIN_STORAGE_KEY = "sharek:pendingExternalEventJoin";

const getClubName = (club: ClubRow) =>
  club.name?.trim() || club.title?.trim() || "University club";

type EventImageFields = Pick<
  EventRow,
  "image_url" | "poster_url" | "banner_url" | "thumbnail_url"
>;

const getEventImageUrl = (event: EventImageFields) =>
  event.image_url?.trim() ||
  event.poster_url?.trim() ||
  event.banner_url?.trim() ||
  event.thumbnail_url?.trim() ||
  null;

const STATUS_TABS = [
  "Still Available",
  "All Statuses",
  "Completed",
  "upcoming",
  "ongoing",
  "Joined",
] as const;

const EVENT_TYPE_TABS = [
  "All Types",
  "Solo",
  "Team",
] as const;

const UNIVERSITY_EVENT_FILTERS = [
  "All Events",
  "In University",
  "Outside University",
] as const;

const DATE_RANGE_FILTERS = [
  "Any Date",
  "Today",
  "Next 7 Days",
  "This Month",
  "Future",
  "Past",
] as const;

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState<(typeof STATUS_TABS)[number]>("Still Available");
  const [selectedEventType, setSelectedEventType] =
    useState<(typeof EVENT_TYPE_TABS)[number]>("All Types");
  const [selectedUniversityFilter, setSelectedUniversityFilter] =
    useState<(typeof UNIVERSITY_EVENT_FILTERS)[number]>("All Events");
  const [selectedDateRange, setSelectedDateRange] =
    useState<(typeof DATE_RANGE_FILTERS)[number]>("Any Date");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);
  const [joinedClubIds, setJoinedClubIds] = useState<string[]>([]);
  const [joinMessage, setJoinMessage] = useState("");
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [pendingExternalJoin, setPendingExternalJoin] =
    useState<PendingExternalJoin | null>(null);
  const [statusClock, setStatusClock] = useState(0);

  const today = useMemo(() => {
    void statusClock;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [statusClock]);

  const mapRowToEvent = (row: EventRow): EventItem => {
    const pickedDate = row.event_date ?? row.date ?? null;

    return {
      id: row.id,
      title: row.title ?? "Untitled Event",
      description: row.description ?? "",
      category: inferEventCategory(row.category, row.title, row.description),
      prize: row.prize ?? null,
      date: pickedDate,
      end_date: row.end_date ?? null,
      registration_deadline: row.registration_deadline ?? null,
      start_time: row.start_time ?? null,
      end_time: row.end_time ?? null,
      location: row.location ?? "TBA",
      location_details: row.location_details ?? null,
      source_url: row.source_url ?? null,
    image_url: getEventImageUrl(row),
    club_id: row.club_id ?? null,
    approval_status: row.approval_status ?? null,
    registered_count: row.registered_count ?? 0,
      max_capacity: row.max_capacity ?? null,
      computed_status: row.computed_status ?? undefined,
      is_team_based: Boolean(row.is_team_based),
      is_university_event: Boolean(row.is_university_event),
      is_club_members_only: Boolean(row.is_club_members_only),
      responsible_club: row.responsible_club ?? null,
    };
  };

  const attachResponsibleClubs = useCallback(async (items: EventItem[]) => {
    const clubIds = Array.from(
      new Set(
        items
          .filter((event) => event.is_university_event && event.club_id)
          .map((event) => event.club_id as string)
      )
    );

    if (clubIds.length === 0) return items;

    const { data: clubData } = await supabase
      .from("clubs")
      .select("*")
      .in("id", clubIds);

    const clubNameById = new Map(
      ((clubData || []) as ClubRow[]).map((club) => [club.id, getClubName(club)])
    );

    return items.map((event) => ({
      ...event,
      responsible_club: event.club_id
        ? clubNameById.get(event.club_id) ?? event.responsible_club
        : event.responsible_club,
    }));
  }, []);

  const getEventTypeLabel = (event: Pick<EventItem, "is_team_based">) => {
    return event.is_team_based ? "Team based" : "Solo based";
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStatusClock((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: viewData, error: viewError } = await supabase
          .from("events_with_status")
          .select("*")
          .order("event_date", { ascending: true });

        let loadedEvents: EventItem[] = [];

        if (!viewError && viewData) {
          const eventIds = (viewData as EventRow[]).map((event) => event.id);
          const eventTypeSelect =
            "id, approval_status, is_team_based, is_university_event, is_club_members_only, club_id, end_date, registration_deadline";
          const eventTypeImageSelect = `${eventTypeSelect}, image_url, poster_url, banner_url, thumbnail_url`;
          const typeResult = await supabase
            .from("events")
            .select(eventTypeImageSelect)
            .in("id", eventIds);
          const fallbackTypeResult = typeResult.error
            ? await supabase
                .from("events")
                .select(eventTypeSelect)
                .in("id", eventIds)
            : null;
          const typeData = fallbackTypeResult?.data ?? typeResult.data;

          const typeByEventId = new Map(
            ((typeData || []) as EventTypeRow[]).map((event) => [
              event.id,
              event,
            ])
          );

          loadedEvents = (viewData as EventRow[]).map((event) =>
            mapRowToEvent({
              ...event,
              is_team_based:
                typeByEventId.get(event.id)?.is_team_based ??
                event.is_team_based,
              is_university_event:
                typeByEventId.get(event.id)?.is_university_event ??
                event.is_university_event,
              is_club_members_only:
                typeByEventId.get(event.id)?.is_club_members_only ??
                event.is_club_members_only,
              approval_status:
                typeByEventId.get(event.id)?.approval_status ??
                event.approval_status,
              image_url:
                getEventImageUrl(typeByEventId.get(event.id) ?? event) ??
                getEventImageUrl(event),
              end_date: typeByEventId.get(event.id)?.end_date ?? event.end_date,
              registration_deadline:
                typeByEventId.get(event.id)?.registration_deadline ??
                event.registration_deadline,
              club_id: typeByEventId.get(event.id)?.club_id ?? event.club_id,
            })
          );
          loadedEvents = await attachResponsibleClubs(
            loadedEvents.filter(
              (event) => (event.approval_status ?? "approved") === "approved"
            )
          );
          setEvents(loadedEvents);
          setLoading(false);
          loadJoinedEvents(loadedEvents);
          return;
        }

        const { data: tableData, error: tableError } = await supabase
          .from("events")
          .select("*")
          .order("date", { ascending: true });

        if (tableError) {
          setError(tableError.message);
          setEvents([]);
          return;
        }

        loadedEvents = await attachResponsibleClubs(
          ((tableData as EventRow[]) || [])
            .map(mapRowToEvent)
            .filter(
              (event) => (event.approval_status ?? "approved") === "approved"
            )
        );
        setEvents(loadedEvents);
        setLoading(false);
        loadJoinedEvents(loadedEvents);
      } catch (err) {
        console.error(err);
        setError("Something went wrong while loading events.");
        setEvents([]);
        setLoading(false);
      } finally {
      }
    };

    loadEvents();
  }, [attachResponsibleClubs]);

  const loadJoinedEvents = async (loadedEvents: EventItem[]) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setJoinedEvents([]);
      setJoinedClubIds([]);
      return;
    }

    const joined = new Set<string>();

    const { data: registrations } = await supabase
      .from("event_registrations")
      .select("event_id")
      .eq("user_id", user.id);

    ((registrations || []) as { event_id: string }[]).forEach((registration) => {
      joined.add(registration.event_id);
    });

    const { data: memberships } = await supabase
      .from("team_members")
      .select("teams(event)")
      .eq("user_id", user.id)
      .neq("status", "rejected");

    const eventIdByTitle = new Map(
      loadedEvents.map((event) => [event.title.toLowerCase(), event.id])
    );

    ((memberships || []) as TeamMembershipRow[]).forEach((membership) => {
      const team = Array.isArray(membership.teams)
        ? membership.teams[0]
        : membership.teams;
      const eventTitle = team?.event?.toLowerCase();
      const eventId = eventTitle ? eventIdByTitle.get(eventTitle) : undefined;

      if (eventId) {
        joined.add(eventId);
      }
    });

    setJoinedEvents(Array.from(joined));

    const { data: clubMemberships } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .eq("status", "approved");

    setJoinedClubIds(
      ((clubMemberships || []) as ClubMemberRow[]).map(
        (membership) => membership.club_id
      )
    );
  };

  const markExternalEventJoined = useCallback(async (eventId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return false;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, student_id, major, academic_year")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setJoinMessage(profileError?.message ?? "Could not load your profile.");
      return false;
    }

    const userProfile = profile as ProfileRow;
    const { error: registrationError } = await supabase
      .from("event_registrations")
      .upsert(
        {
          event_id: eventId,
          user_id: userProfile.id,
          full_name: userProfile.full_name,
          email: userProfile.email,
          student_id: userProfile.student_id,
          major: userProfile.major,
          academic_year: userProfile.academic_year,
          status: "approved",
        },
        { onConflict: "event_id,user_id" }
      );

    if (registrationError) {
      setJoinMessage(registrationError.message);
      return false;
    }

    const joinedEvent = events.find((event) => event.id === eventId);

    setJoinedEvents((prev) =>
      prev.includes(eventId) ? prev : [...prev, eventId]
    );
    setJoinMessage(
      joinedEvent?.is_team_based
        ? "Marked as joined as group."
        : "Marked as joined."
    );
    return true;
  }, [events, router]);

  const handleJoinEvent = async (eventId: string) => {
    setJoiningEventId(eventId);
    setJoinMessage("");

    try {
      await markExternalEventJoined(eventId);
    } finally {
      setJoiningEventId(null);
    }
  };

  const askAboutExternalRegistration = useCallback(async () => {
    const raw = window.localStorage.getItem(EXTERNAL_JOIN_STORAGE_KEY);
    if (!raw) return;

    let pending: PendingExternalJoin | null = null;
    try {
      pending = JSON.parse(raw) as PendingExternalJoin;
    } catch {
      window.localStorage.removeItem(EXTERNAL_JOIN_STORAGE_KEY);
      return;
    }

    if (!pending?.eventId) {
      window.localStorage.removeItem(EXTERNAL_JOIN_STORAGE_KEY);
      return;
    }

    if (Date.now() - (pending.openedAt ?? 0) < 1500) return;

    setPendingExternalJoin(pending);
  }, []);

  const confirmExternalRegistration = async (completed: boolean) => {
    const pending = pendingExternalJoin;
    window.localStorage.removeItem(EXTERNAL_JOIN_STORAGE_KEY);
    setPendingExternalJoin(null);

    if (!pending) return;

    if (completed) {
      await markExternalEventJoined(pending.eventId);
    } else {
      setJoinMessage("No problem. The event was not marked as joined.");
    }
  };

  useEffect(() => {
    const handleReturn = () => {
      if (document.visibilityState === "visible") {
        void askAboutExternalRegistration();
      }
    };

    window.addEventListener("focus", handleReturn);
    document.addEventListener("visibilitychange", handleReturn);

    return () => {
      window.removeEventListener("focus", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };
  }, [askAboutExternalRegistration]);

  const handleExternalJoin = (event: NormalizedEvent) => {
    if (!event.source_url) {
      setJoinMessage("This event does not have an external registration link yet.");
      return;
    }

    window.localStorage.setItem(
      EXTERNAL_JOIN_STORAGE_KEY,
      JSON.stringify({
        eventId: event.id,
        title: event.title,
        url: event.source_url,
        openedAt: Date.now(),
      } satisfies PendingExternalJoin)
    );

    window.open(event.source_url, "_blank", "noopener,noreferrer");
    setJoinMessage("Register on the external site, then come back to Sharek.");
  };

  const openEventDetails = (
    eventId: string,
    target: EventTarget | null
  ) => {
    if (
      target instanceof HTMLElement &&
      target.closest("a, button, input, select, textarea")
    ) {
      return;
    }

    router.push(`/events/${eventId}`);
  };

  const parseEventDateTime = useCallback((
    date: string | null,
    time: string | null,
    fallback: "start" | "end"
  ) => {
    if (!date) return null;

    const datePart = date.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) return null;

    let hours = fallback === "end" ? 23 : 0;
    let minutes = fallback === "end" ? 59 : 0;
    let seconds = fallback === "end" ? 59 : 0;

    if (time) {
      const [rawHours, rawMinutes, rawSeconds] = time.split(":");
      hours = Number(rawHours);
      minutes = Number(rawMinutes ?? 0);
      seconds = Number(rawSeconds ?? 0);
    }

    if (![hours, minutes, seconds].every(Number.isFinite)) return null;

    const parsed = new Date(
      year,
      month - 1,
      day,
      hours,
      minutes,
      seconds,
      fallback === "end" ? 999 : 0
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const computeStatus = useCallback((
    date: string | null,
    endDate: string | null,
    start: string | null,
    end: string | null
  ): "upcoming" | "ongoing" | "completed" => {
    const now = new Date();
    const startsAt = parseEventDateTime(date, start, "start");
    const endsAt = parseEventDateTime(endDate || date, end, "end");

    if (!startsAt || !endsAt) return "upcoming";

    const effectiveEndsAt = new Date(endsAt);
    if (effectiveEndsAt < startsAt) {
      effectiveEndsAt.setDate(effectiveEndsAt.getDate() + 1);
    }

    if (now < startsAt) return "upcoming";
    if (now > effectiveEndsAt) return "completed";

    return "ongoing";
  }, [parseEventDateTime]);

  const formatDateInfo = (value: string | null) => {
    if (!value) {
      return {
        rawDateKey: "no-date",
        displayDate: "No date",
        parsed: null as Date | null,
      };
    }

    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return {
        rawDateKey: "no-date",
        displayDate: "No date",
        parsed: null as Date | null,
      };
    }

    return {
      rawDateKey: value,
      displayDate: parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      parsed,
    };
  };

  const formatDateRange = useCallback((start: string | null, end: string | null) => {
    const startInfo = formatDateInfo(start);
    if (!end || end === start) return startInfo.displayDate;

    const endInfo = formatDateInfo(end);
    if (endInfo.rawDateKey === "no-date") return startInfo.displayDate;

    return `${startInfo.displayDate} - ${endInfo.displayDate}`;
  }, []);

  const formatTimeLabel = (start: string | null, end: string | null) => {
    const formatOne = (time: string) => {
      const [hours, minutes] = time.split(":");
      const d = new Date();
      d.setHours(Number(hours), Number(minutes || 0), 0, 0);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    };

    if (start && end) return `${formatOne(start)} - ${formatOne(end)}`;
    if (start) return formatOne(start);
    return "Time not set";
  };

  const normalizedEvents = useMemo<NormalizedEvent[]>(() => {
    return events.map((event) => {
      const dateInfo = formatDateInfo(event.date);
      const registered = event.registered_count ?? 0;
      const max = event.max_capacity ?? 0;

      let daysFromToday: number | null = null;
      if (dateInfo.parsed) {
        const diffMs = dateInfo.parsed.getTime() - today.getTime();
        daysFromToday = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        ...event,
        rawDateKey: dateInfo.rawDateKey,
        displayDate: formatDateRange(event.date, event.end_date),
        parsedDate: dateInfo.parsed,
        timeLabel: formatTimeLabel(event.start_time, event.end_time),
        status: computeStatus(
          event.date,
          event.end_date,
          event.start_time,
          event.end_time
        ),
        fillPercentage: max > 0 ? Math.min((registered / max) * 100, 100) : 0,
        isFull: max > 0 && registered >= max,
        isRegistrationClosed: event.registration_deadline
          ? new Date(event.registration_deadline) < new Date()
          : false,
        daysFromToday,
      };
    });
  }, [computeStatus, events, formatDateRange, today]);

  const baseEvents = useMemo(() => normalizedEvents, [normalizedEvents]);

  const categoryOptions = useMemo(() => {
    const availableCategories = new Set(
      baseEvents.map((event) => event.category).filter(Boolean)
    );
    const categories = EVENT_CATEGORIES.filter((category) =>
      availableCategories.has(category)
    );

    return ["All Categories", ...categories];
  }, [baseEvents]);

  const todayKey = useMemo(() => {
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [today]);

  const filteredEvents = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return baseEvents
      .filter((event) => {
        const matchesSearch =
          !search ||
          event.title.toLowerCase().includes(search) ||
          event.description.toLowerCase().includes(search) ||
          event.category.toLowerCase().includes(search) ||
          event.location.toLowerCase().includes(search) ||
          (event.responsible_club || "").toLowerCase().includes(search);

        const matchesStatus =
          selectedStatus === "All Statuses" ||
          (selectedStatus === "Still Available" &&
            event.status !== "completed" &&
            !event.isRegistrationClosed &&
            !event.isFull) ||
          (selectedStatus === "Joined" && joinedEvents.includes(event.id)) ||
          (selectedStatus === "Completed" && event.status === "completed") ||
          event.status === selectedStatus;

        const matchesCategory =
          selectedCategory === "All Categories" ||
          event.category === selectedCategory;

        const matchesEventType =
          selectedEventType === "All Types" ||
          (selectedEventType === "Solo" && !event.is_team_based) ||
          (selectedEventType === "Team" && event.is_team_based);

        const matchesUniversityFilter =
          selectedUniversityFilter === "All Events" ||
          (selectedUniversityFilter === "In University" &&
            event.is_university_event) ||
          (selectedUniversityFilter === "Outside University" &&
            !event.is_university_event);

        const matchesDateRange =
          selectedDateRange === "Any Date" ||
          (selectedDateRange === "Today" && event.rawDateKey === todayKey) ||
          (selectedDateRange === "Next 7 Days" &&
            Boolean(event.parsedDate) &&
            event.parsedDate! >= today &&
            event.parsedDate! <= weekEnd) ||
          (selectedDateRange === "This Month" &&
            Boolean(event.parsedDate) &&
            event.parsedDate! >= monthStart &&
            event.parsedDate! <= monthEnd) ||
          (selectedDateRange === "Future" &&
            Boolean(event.parsedDate) &&
            event.parsedDate! >= today) ||
          (selectedDateRange === "Past" &&
            Boolean(event.parsedDate) &&
            event.parsedDate! < today);

        const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
        const matchesCustomDateRange =
          (!fromDate ||
            Number.isNaN(fromDate.getTime()) ||
            (Boolean(event.parsedDate) && event.parsedDate! >= fromDate)) &&
          (!toDate ||
            Number.isNaN(toDate.getTime()) ||
            (Boolean(event.parsedDate) && event.parsedDate! <= toDate));

        return (
          matchesSearch &&
          matchesStatus &&
          matchesCategory &&
          matchesEventType &&
          matchesUniversityFilter &&
          matchesDateRange &&
          matchesCustomDateRange
        );
      })
      .sort((a, b) => {
        const aTime = a.parsedDate
          ? a.parsedDate.getTime()
          : Number.POSITIVE_INFINITY;
        const bTime = b.parsedDate
          ? b.parsedDate.getTime()
          : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
  }, [
    baseEvents,
    searchTerm,
    selectedStatus,
    selectedCategory,
    selectedEventType,
    selectedUniversityFilter,
    selectedDateRange,
    joinedEvents,
    dateFrom,
    dateTo,
    today,
    todayKey,
  ]);

  const joinedAvailableEvents = useMemo(
    () =>
      baseEvents
        .filter(
          (event) =>
            joinedEvents.includes(event.id) && event.status !== "completed"
        )
        .sort((a, b) => {
          const aTime = a.parsedDate
            ? a.parsedDate.getTime()
            : Number.POSITIVE_INFINITY;
          const bTime = b.parsedDate
            ? b.parsedDate.getTime()
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        }),
    [baseEvents, joinedEvents]
  );

  const availableMonths: Date[] = [];
  const currentMonthIndex = 0;
  const monthEvents: NormalizedEvent[] = [];
  const timelineDays: Array<{
    rawDateKey: string;
    day: number;
    leftPercent: number;
    eventCount: number;
  }> = [];
  const daysInCurrentMonth = 0;
  const monthLabel = "";
  const goToPrevMonth = () => {};
  const goToNextMonth = () => {};
  const selectedEvents = filteredEvents;

  const getStatusBadge = (status: string) => {
    void status;
    return "border-sky-200 bg-sky-50 text-sky-700";
  };

  const eventTypeBadgeClass =
    "rounded-full border border-[#c7d5fb] bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a]";

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedStatus("Still Available");
    setSelectedEventType("All Types");
    setSelectedUniversityFilter("All Events");
    setSelectedDateRange("Any Date");
    setSelectedCategory("All Categories");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedStatus !== "Still Available" ||
    selectedEventType !== "All Types" ||
    selectedUniversityFilter !== "All Events" ||
    selectedDateRange !== "Any Date" ||
    selectedCategory !== "All Categories" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar />

      <section className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Events</h1>
              <p className="mt-1 text-sm text-slate-500">
                Find events by status, date, type, and category.
              </p>
            </div>

            <button
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                hasActiveFilters
                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              Reset filters
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="md:col-span-2 xl:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search
              </span>
              <input
                type="text"
                placeholder="Search title, club, place, or category"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-4 focus:ring-[#1e3a8a]/10"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Status
              </span>
              <select
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(e.target.value as (typeof STATUS_TABS)[number])
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
              >
                {STATUS_TABS.map((status) => (
                  <option key={status} value={status}>
                    {formatTagLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Event Type
              </span>
              <select
                value={selectedEventType}
                onChange={(e) =>
                  setSelectedEventType(e.target.value as (typeof EVENT_TYPE_TABS)[number])
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
              >
                {EVENT_TYPE_TABS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                University
              </span>
              <select
                value={selectedUniversityFilter}
                onChange={(e) =>
                  setSelectedUniversityFilter(
                    e.target.value as (typeof UNIVERSITY_EVENT_FILTERS)[number]
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
              >
                {UNIVERSITY_EVENT_FILTERS.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Category
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                When
              </span>
              <select
                value={selectedDateRange}
                onChange={(e) =>
                  setSelectedDateRange(e.target.value as (typeof DATE_RANGE_FILTERS)[number])
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
              >
                {DATE_RANGE_FILTERS.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                From Date
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                To Date
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
              />
            </label>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading events...</p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {joinMessage && (
          <div className="mt-6 rounded-[28px] border border-sky-200 bg-sky-50 p-6 text-sm text-sky-700 shadow-sm">
            {joinMessage}
          </div>
        )}

        {!loading && !error && (
          <>
          <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Joined Events
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Events you joined that are still upcoming or ongoing.
                </p>
              </div>
              <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                {joinedAvailableEvents.length} active
              </span>
            </div>

            {joinedAvailableEvents.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {joinedAvailableEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => router.push(`/events/${event.id}`)}
                    className="rounded-3xl border border-sky-100 bg-sky-50/50 p-5 text-left transition hover:border-[#1e3a8a]/30 hover:bg-white hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {formatTagLabel(event.category)}
                      </span>
                      <span className={eventTypeBadgeClass}>
                        {getEventTypeLabel(event)}
                      </span>
                      <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                        {event.is_team_based ? "Joined as group" : "Joined"}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(
                          event.status
                        )}`}
                      >
                        {formatTagLabel(event.status)}
                      </span>
                    </div>

                    <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-slate-900">
                      {event.title}
                    </h3>
                    <div className="mt-4 grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <span className="block text-xs font-medium text-slate-400">
                          Date
                        </span>
                        <span className="mt-1 block font-medium text-slate-700">
                          {event.displayDate}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <span className="block text-xs font-medium text-slate-400">
                          Place
                        </span>
                        <span className="mt-1 block truncate font-medium text-slate-700">
                          {event.location || "TBA"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-sm text-slate-500">
                No active joined events yet.
              </div>
            )}
          </section>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Events
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing all events that match the current filters.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {filteredEvents.length} result{filteredEvents.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="hidden">
              <div className="mb-8 flex items-center justify-between">
                <button
                  onClick={goToPrevMonth}
                  disabled={currentMonthIndex <= 0}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition ${
                    currentMonthIndex <= 0
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[#1e3a8a] hover:text-[#1e3a8a]"
                  }`}
                >
                  ‹
                </button>

                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900">{monthLabel}</p>
                  <p className="text-sm text-slate-500">
                    {monthEvents.length} event{monthEvents.length !== 1 ? "s" : ""} on{" "}
                    {timelineDays.length} day{timelineDays.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <button
                  onClick={goToNextMonth}
                  disabled={currentMonthIndex >= availableMonths.length - 1}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition ${
                    currentMonthIndex >= availableMonths.length - 1
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[#1e3a8a] hover:text-[#1e3a8a]"
                  }`}
                >
                  ›
                </button>
              </div>

              <div className="relative px-2 pt-8 pb-16">
                <div className="absolute left-0 right-0 top-[56px] h-[3px] -translate-y-1/2 rounded-full bg-slate-200" />

                <div className="relative h-28">
                  {Array.from({ length: daysInCurrentMonth }, (_, i) => {
                    const day = i + 1;
                    const leftPercent =
                      daysInCurrentMonth <= 1
                        ? 0
                        : (i / (daysInCurrentMonth - 1)) * 100;

                    return (
                      <div
                        key={day}
                        className="absolute top-[56px] -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${leftPercent}%` }}
                      >
                        <div className="h-3 w-[1px] bg-slate-300" />
                        <span className="mt-3 block text-center text-[11px] text-slate-400">
                          {day}
                        </span>
                      </div>
                    );
                  })}

                  {timelineDays.map((day) => {
                    const isActive = selectedDateKey === day.rawDateKey;

                    return (
                      <button
                        key={day.rawDateKey}
                        onClick={() => setSelectedDateKey(day.rawDateKey)}
                        className="absolute -translate-x-1/2"
                        style={{
                          left: `${day.leftPercent}%`,
                          top: "56px",
                        }}
                        title={`${day.eventCount} event${
                          day.eventCount !== 1 ? "s" : ""
                        } on this day`}
                      >
                        <div className="flex flex-col items-center">
                          <div className="relative">
                            <div
                              className={`h-5 w-5 rounded-full border-4 shadow-sm transition ${
                                isActive
                                  ? "border-[#1e3a8a] bg-white"
                                  : "border-slate-300 bg-white hover:border-[#1e3a8a]"
                              }`}
                            />
                            {day.eventCount > 1 && (
                              <span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1e3a8a] px-1 text-[10px] font-bold text-white shadow-sm">
                                {day.eventCount}
                              </span>
                            )}
                          </div>

                          <span
                            className={`mt-2 block max-w-[90px] truncate text-center text-xs font-medium ${
                              isActive ? "text-[#1e3a8a]" : "text-slate-500"
                            }`}
                          >
                            {day.day}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              {selectedEvents.length > 0 ? (
                selectedEvents.map((event) => {
                  const isJoined = joinedEvents.includes(event.id);
                  const isLockedClubEvent =
                    event.is_club_members_only &&
                    Boolean(event.club_id) &&
                    !joinedClubIds.includes(event.club_id as string);
                  const usesExternalRegistration =
                    Boolean(event.source_url) && !event.is_university_event;

                  return (
                    <article
                      key={event.id}
                      role="link"
                      tabIndex={0}
                      onClick={(clickEvent) =>
                        openEventDetails(event.id, clickEvent.target)
                      }
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                          keyEvent.preventDefault();
                          openEventDetails(event.id, keyEvent.target);
                        }
                      }}
                      className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-[#1e3a8a]/30 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/10"
                    >
                      {event.image_url && (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="mb-5 h-64 w-full rounded-2xl object-cover"
                        />
                      )}
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {formatTagLabel(event.category)}
                            </span>
                            <span className={eventTypeBadgeClass}>
                              {getEventTypeLabel(event)}
                            </span>
                            {event.is_university_event && event.responsible_club && (
                              <span className="rounded-full border border-[#c7d5fb] bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                                {event.responsible_club}
                              </span>
                            )}

                            {event.is_club_members_only && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                Club members only
                              </span>
                            )}

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(
                                event.status
                              )}`}
                            >
                              {formatTagLabel(event.status)}
                            </span>

                            {isJoined && (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                                {event.is_team_based ? "Joined as group" : "Joined"}
                              </span>
                            )}

                            {event.isFull && (
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                                Full
                              </span>
                            )}
                            {event.prize && (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                Prize: {event.prize}
                              </span>
                            )}
                            {event.isRegistrationClosed && event.status !== "completed" && (
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                                Registration closed
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 text-xl font-semibold text-slate-900">
                            {event.title}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {event.description || "No description available."}
                          </p>

                          <div className="mt-4 grid gap-3 text-sm text-slate-500 sm:grid-cols-3">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <span className="block text-xs font-medium text-slate-400">
                                Date
                              </span>
                              <span className="mt-1 block font-medium text-slate-700">
                                {event.displayDate}
                              </span>
                            </div>

                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <span className="block text-xs font-medium text-slate-400">
                                Time
                              </span>
                              <span className="mt-1 block font-medium text-slate-700">
                                {event.timeLabel}
                              </span>
                            </div>

                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <span className="block text-xs font-medium text-slate-400">
                                Place
                              </span>
                              <span className="mt-1 block font-medium text-slate-700">
                                {event.location || "TBA"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-5">
                            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                              <span>Registration</span>
                              <span>
                                {event.registered_count}
                                {event.max_capacity ? ` / ${event.max_capacity}` : ""}
                              </span>
                            </div>

                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${
                                  event.isFull ? "bg-red-500" : "bg-[#1e3a8a]"
                                }`}
                                style={{ width: `${event.fillPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Link
                            href={`/events/${event.id}`}
                            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            Details
                          </Link>

                          {usesExternalRegistration &&
                          !isJoined &&
                          !event.isFull &&
                          event.status !== "completed" &&
                          !event.isRegistrationClosed &&
                          !isLockedClubEvent ? (
                            <button
                              onClick={(buttonEvent) => {
                                buttonEvent.stopPropagation();
                                handleExternalJoin(event);
                              }}
                              className="rounded-2xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                              {event.is_team_based ? "Join as group" : "Join"}
                            </button>
                          ) : event.is_team_based &&
                            !isJoined &&
                            !event.isFull &&
                            event.status !== "completed" &&
                            !event.isRegistrationClosed &&
                            !isLockedClubEvent ? (
                            <Link
                              href={`/events/${event.id}`}
                              className="rounded-2xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                              Join as group
                            </Link>
                          ) : (
                            <button
                              onClick={(buttonEvent) => {
                                buttonEvent.stopPropagation();
                                void handleJoinEvent(event.id);
                              }}
                              disabled={
                                event.is_team_based ||
                                isJoined ||
                                joiningEventId === event.id ||
                                (event.isFull && !isJoined) ||
                                event.status === "completed" ||
                                event.isRegistrationClosed ||
                                isLockedClubEvent
                              }
                              className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                                event.status === "completed"
                                  ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500"
                                  : event.isRegistrationClosed
                                  ? "cursor-not-allowed bg-red-50 text-red-600"
                                  : joiningEventId === event.id
                                  ? "cursor-wait bg-[#1e3a8a] text-white opacity-75"
                                  : isJoined
                                  ? "cursor-not-allowed bg-sky-50 text-sky-700"
                                  : event.isFull && !isJoined
                                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                  : isLockedClubEvent
                                  ? "cursor-not-allowed bg-amber-50 text-amber-700"
                                  : event.is_team_based
                                  ? "cursor-not-allowed bg-slate-100 text-slate-500"
                                  : "bg-[#1e3a8a] text-white hover:opacity-90"
                              }`}
                              title={isLockedClubEvent ? "Join the club first" : undefined}
                            >
                              {event.status === "completed"
                                ? "Completed"
                                : event.isRegistrationClosed
                                ? "Registration closed"
                                : joiningEventId === event.id
                                ? "Joining..."
                                : isJoined
                                ? event.is_team_based
                                  ? "Joined as group"
                                  : "Joined"
                                : event.isFull && !isJoined
                                ? "Full"
                                : isLockedClubEvent
                                ? "Members only"
                                : event.is_team_based
                                ? "Join as group"
                                : "Join"}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                  <p className="text-sm text-slate-500">
                    No events match these filters.
                  </p>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </section>
      {pendingExternalJoin && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">
              External registration
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Did you register?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Did you finish registering for{" "}
              <span className="font-semibold text-slate-700">
                {pendingExternalJoin.title}
              </span>{" "}
              on the external event website?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => confirmExternalRegistration(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => confirmExternalRegistration(true)}
                className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af]"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
