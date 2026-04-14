"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

type EventRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  date?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  source_url?: string | null;
  club_id?: string | null;
  registered_count?: number | null;
  max_capacity?: number | null;
  computed_status?: "upcoming" | "ongoing" | "completed" | null;
  is_team_based?: boolean | null;
  is_university_event?: boolean | null;
};

type EventItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  source_url?: string | null;
  club_id?: string | null;
  registered_count: number;
  max_capacity: number | null;
  computed_status?: "upcoming" | "ongoing" | "completed";
  is_team_based: boolean;
  is_university_event: boolean;
};

type NormalizedEvent = EventItem & {
  rawDateKey: string;
  displayDate: string;
  timeLabel: string;
  status: "upcoming" | "ongoing" | "completed";
  fillPercentage: number;
  isFull: boolean;
  daysFromToday: number | null;
  parsedDate: Date | null;
};

type TimelineEvent = NormalizedEvent & {
  day: number;
  leftPercent: number;
  stackIndex: number;
};

type TeamMembershipRow = {
  teams?: { event?: string | null } | { event?: string | null }[] | null;
};

const STATUS_TABS = [
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

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState<(typeof STATUS_TABS)[number]>("All Statuses");
  const [selectedEventType, setSelectedEventType] =
    useState<(typeof EVENT_TYPE_TABS)[number]>("All Types");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [jumpToDate, setJumpToDate] = useState("");
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);
  const [statusClock, setStatusClock] = useState(0);

  const today = useMemo(() => {
    void statusClock;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [statusClock]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const mapRowToEvent = (row: EventRow): EventItem => {
    const pickedDate = row.event_date ?? row.date ?? null;

    return {
      id: row.id,
      title: row.title ?? "Untitled Event",
      description: row.description ?? "",
      category: row.category ?? "Event",
      date: pickedDate,
      start_time: row.start_time ?? null,
      end_time: row.end_time ?? null,
      location: row.location ?? "TBA",
      source_url: row.source_url ?? null,
      club_id: row.club_id ?? null,
      registered_count: row.registered_count ?? 0,
      max_capacity: row.max_capacity ?? null,
      computed_status: row.computed_status ?? undefined,
      is_team_based: Boolean(row.is_team_based),
      is_university_event: Boolean(row.is_university_event),
    };
  };

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
          loadedEvents = (viewData as EventRow[]).map(mapRowToEvent);
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

        loadedEvents = ((tableData as EventRow[]) || []).map(mapRowToEvent);
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
  }, []);

  const loadJoinedEvents = async (loadedEvents: EventItem[]) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setJoinedEvents([]);
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
  };

  const handleJoinToggle = (eventId: string) => {
    setJoinedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
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
    start: string | null,
    end: string | null
  ): "upcoming" | "ongoing" | "completed" => {
    const now = new Date();
    const startsAt = parseEventDateTime(date, start, "start");
    const endsAt = parseEventDateTime(date, end, "end");

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
        displayDate: dateInfo.displayDate,
        parsedDate: dateInfo.parsed,
        timeLabel: formatTimeLabel(event.start_time, event.end_time),
        status: computeStatus(event.date, event.start_time, event.end_time),
        fillPercentage: max > 0 ? Math.min((registered / max) * 100, 100) : 0,
        isFull: max > 0 && registered >= max,
        daysFromToday,
      };
    });
  }, [computeStatus, events, today]);

  const baseEvents = useMemo(() => normalizedEvents, [normalizedEvents]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(baseEvents.map((event) => event.category).filter(Boolean))
    ).sort();

    return ["All Categories", ...categories];
  }, [baseEvents]);

  const filteredEvents = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return baseEvents
      .filter((event) => {
        const matchesSearch =
          !search ||
          event.title.toLowerCase().includes(search) ||
          event.description.toLowerCase().includes(search) ||
          event.category.toLowerCase().includes(search) ||
          event.location.toLowerCase().includes(search);

        const matchesStatus =
          selectedStatus === "All Statuses" ||
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

        return (
          matchesSearch && matchesStatus && matchesCategory && matchesEventType
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
    joinedEvents,
  ]);

  const availableMonths = useMemo(() => {
    const map = new Map<string, Date>();

    filteredEvents.forEach((event) => {
      if (!event.parsedDate) return;

      const year = event.parsedDate.getFullYear();
      const month = event.parsedDate.getMonth();
      const key = `${year}-${month}`;

      if (!map.has(key)) {
        map.set(key, new Date(year, month, 1));
      }
    });

    const months = Array.from(map.values()).sort(
      (a, b) => a.getTime() - b.getTime()
    );

    if (months.length === 0) {
      return [new Date(today.getFullYear(), today.getMonth(), 1)];
    }

    return months;
  }, [filteredEvents, today]);

  useEffect(() => {
    const exists = availableMonths.some(
      (m) =>
        m.getFullYear() === currentMonth.getFullYear() &&
        m.getMonth() === currentMonth.getMonth()
    );

    if (!exists && availableMonths.length > 0) {
      setCurrentMonth(availableMonths[0]);
    }
  }, [availableMonths, currentMonth]);

  useEffect(() => {
    if (!jumpToDate) return;

    const picked = new Date(`${jumpToDate}T00:00:00`);
    if (Number.isNaN(picked.getTime())) return;

    setCurrentMonth(new Date(picked.getFullYear(), picked.getMonth(), 1));
    setSelectedDateKey(jumpToDate);
  }, [jumpToDate]);

  const monthEvents = useMemo(() => {
    return filteredEvents.filter((event) => {
      if (!event.parsedDate) return false;
      return (
        event.parsedDate.getFullYear() === currentMonth.getFullYear() &&
        event.parsedDate.getMonth() === currentMonth.getMonth()
      );
    });
  }, [filteredEvents, currentMonth]);

  const daysInCurrentMonth = useMemo(() => {
    return new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate();
  }, [currentMonth]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth]);

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const dayCounts = new Map<string, number>();

    return monthEvents.map((event) => {
      const day = event.parsedDate?.getDate() ?? 1;
      const leftPercent =
        daysInCurrentMonth <= 1
          ? 0
          : ((day - 1) / (daysInCurrentMonth - 1)) * 100;

      const key = event.rawDateKey;
      const stackIndex = dayCounts.get(key) ?? 0;
      dayCounts.set(key, stackIndex + 1);

      return {
        ...event,
        day,
        leftPercent,
        stackIndex,
      };
    });
  }, [monthEvents, daysInCurrentMonth]);

  useEffect(() => {
    if (timelineEvents.length === 0) {
      setSelectedDateKey("");
      return;
    }

    const exists = timelineEvents.some(
      (event) => event.rawDateKey === selectedDateKey
    );

    if (!selectedDateKey || !exists) {
      setSelectedDateKey(timelineEvents[0].rawDateKey);
    }
  }, [timelineEvents, selectedDateKey]);

  const selectedEvents = useMemo(() => {
    if (!selectedDateKey) return [];
    return timelineEvents.filter((event) => event.rawDateKey === selectedDateKey);
  }, [timelineEvents, selectedDateKey]);

  const currentMonthIndex = useMemo(() => {
    return availableMonths.findIndex(
      (m) =>
        m.getFullYear() === currentMonth.getFullYear() &&
        m.getMonth() === currentMonth.getMonth()
    );
  }, [availableMonths, currentMonth]);

  const goToPrevMonth = () => {
    if (currentMonthIndex <= 0) return;
    setCurrentMonth(availableMonths[currentMonthIndex - 1]);
    setSelectedDateKey("");
  };

  const goToNextMonth = () => {
    if (currentMonthIndex >= availableMonths.length - 1) return;
    setCurrentMonth(availableMonths[currentMonthIndex + 1]);
    setSelectedDateKey("");
  };

  const getStatusBadge = (status: string) => {
    if (status === "ongoing") {
      return "bg-green-50 text-green-700 border-green-200";
    }
    if (status === "completed") {
      return "bg-slate-100 text-slate-600 border-slate-200";
    }
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedStatus("All Statuses");
    setSelectedEventType("All Types");
    setSelectedCategory("All Categories");
    setSelectedDateKey("");
    setJumpToDate("");
  };

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedStatus !== "All Statuses" ||
    selectedEventType !== "All Types" ||
    selectedCategory !== "All Categories" ||
    Boolean(jumpToDate);

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Events</h1>
            </div>

            <div className="w-full lg:max-w-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-4 focus:ring-[#1e3a8a]/10"
                />

                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="jump-date">
                    Go to date
                  </label>
                  <input
                    id="jump-date"
                    type="date"
                    value={jumpToDate}
                    onChange={(e) => setJumpToDate(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1e3a8a] focus:ring-4 focus:ring-[#1e3a8a]/10"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((tab) => {
              const active = selectedStatus === tab;

              return (
                <button
                  key={tab}
                  onClick={() => setSelectedStatus(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[#1e3a8a] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab === "upcoming"
                    ? "Upcoming"
                    : tab === "ongoing"
                    ? "Ongoing"
                    : tab}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {EVENT_TYPE_TABS.map((type) => {
              const active = selectedEventType === type;

              return (
                <button
                  key={type}
                  onClick={() => setSelectedEventType(type)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? "border-[#1e3a8a] bg-[#1e3a8a] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {categoryOptions.map((category) => {
                const active = selectedCategory === category;

                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? "border-[#1e3a8a] bg-[#1e3a8a]/10 text-[#1e3a8a]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            <button
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                hasActiveFilters
                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              Reset filters
            </button>
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

        {!loading && !error && (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Events Timeline
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Events are positioned based on their day inside the month.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {filteredEvents.length} result{filteredEvents.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-6">
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
                    {timelineEvents.length} event{timelineEvents.length !== 1 ? "s" : ""}
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

                  {timelineEvents.map((event) => {
                    const isActive = selectedDateKey === event.rawDateKey;
                    const verticalOffset = event.stackIndex * 16;

                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedDateKey(event.rawDateKey)}
                        className="absolute -translate-x-1/2"
                        style={{
                          left: `${event.leftPercent}%`,
                          top: `${56 - verticalOffset}px`,
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-5 w-5 rounded-full border-4 shadow-sm transition ${
                              isActive
                                ? "border-[#1e3a8a] bg-white"
                                : "border-slate-300 bg-white hover:border-[#1e3a8a]"
                            }`}
                          />

                          <span
                            className={`mt-2 block max-w-[90px] truncate text-center text-xs font-medium ${
                              isActive ? "text-[#1e3a8a]" : "text-slate-500"
                            }`}
                          >
                            {event.day}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {selectedEvents.length > 0 ? (
                selectedEvents.map((event) => {
                  const isJoined = joinedEvents.includes(event.id);

                  return (
                    <article
                      key={event.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-[#1e3a8a]/30 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {event.category}
                            </span>
                            <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                              {getEventTypeLabel(event)}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(
                                event.status
                              )}`}
                            >
                              {event.status}
                            </span>

                            {isJoined && (
                              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                Joined
                              </span>
                            )}

                            {event.isFull && (
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                                Full
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

                          <button
                            onClick={() => handleJoinToggle(event.id)}
                            disabled={
                              isJoined ||
                              (event.isFull && !isJoined) ||
                              event.status === "completed"
                            }
                            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                              event.status === "completed"
                                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500"
                                : isJoined
                                ? "cursor-not-allowed bg-green-50 text-green-700"
                                : event.isFull && !isJoined
                                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                : "bg-[#1e3a8a] text-white hover:opacity-90"
                            }`}
                          >
                            {event.status === "completed"
                              ? "Completed"
                              : isJoined
                              ? "Joined"
                              : event.isFull && !isJoined
                              ? "Full"
                              : "Join"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                  <p className="text-sm text-slate-500">
                    No events in this month.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
