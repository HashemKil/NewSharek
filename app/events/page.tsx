"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type NormalizedEvent = EventItem & {
  rawDateKey: string;
  displayDate: string;
  timeLabel: string;
  status: "upcoming" | "ongoing" | "completed";
  fillPercentage: number;
  isFull: boolean;
  daysFromToday: number | null;
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedWindow, setSelectedWindow] = useState("Soon");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);

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
    };
  };

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: viewData, error: viewError } = await supabase
          .from("events_with_status")
          .select("*")
          .order("event_date", { ascending: true });

        if (!viewError && viewData) {
          setEvents((viewData as EventRow[]).map(mapRowToEvent));
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

        setEvents(((tableData as EventRow[]) || []).map(mapRowToEvent));
      } catch (err) {
        console.error(err);
        setError("Something went wrong while loading events.");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const handleJoinToggle = (eventId: string) => {
    setJoinedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const computeStatus = (
    date: string | null,
    start: string | null,
    end: string | null
  ): "upcoming" | "ongoing" | "completed" => {
    if (!date) return "upcoming";

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventDay = new Date(`${date}T00:00:00`);
    if (Number.isNaN(eventDay.getTime())) return "upcoming";

    if (eventDay > today) return "upcoming";
    if (eventDay < today) return "completed";

    const currentTime = now.toTimeString().slice(0, 5);

    if (start && currentTime < start) return "upcoming";
    if (start && end && currentTime >= start && currentTime <= end) return "ongoing";
    if (end && currentTime > end) return "completed";

    return "upcoming";
  };

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
        timeLabel: formatTimeLabel(event.start_time, event.end_time),
        status:
          event.computed_status ??
          computeStatus(event.date, event.start_time, event.end_time),
        fillPercentage: max > 0 ? Math.min((registered / max) * 100, 100) : 0,
        isFull: max > 0 && registered >= max,
        daysFromToday,
      };
    });
  }, [events]);

  const nearEvents = useMemo(() => {
    return normalizedEvents.filter((event) => {
      if (event.status === "ongoing") return true;
      if (event.daysFromToday === null) return false;
      return event.daysFromToday >= 0 && event.daysFromToday <= 21;
    });
  }, [normalizedEvents]);

  const baseEventsForFilters = useMemo(() => {
    if (selectedWindow === "All") return normalizedEvents;
    if (selectedWindow === "This Week") {
      return normalizedEvents.filter((event) => {
        if (event.status === "ongoing") return true;
        if (event.daysFromToday === null) return false;
        return event.daysFromToday >= 0 && event.daysFromToday <= 7;
      });
    }
    if (selectedWindow === "This Month") {
      return normalizedEvents.filter((event) => {
        if (event.status === "ongoing") return true;
        if (event.daysFromToday === null) return false;
        return event.daysFromToday >= 0 && event.daysFromToday <= 30;
      });
    }
    return nearEvents;
  }, [normalizedEvents, nearEvents, selectedWindow]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(baseEventsForFilters.map((event) => event.category).filter(Boolean))
    ).sort();
    return ["All", ...categories];
  }, [baseEventsForFilters]);

  const filteredEvents = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return baseEventsForFilters.filter((event) => {
      const matchesSearch =
        !search ||
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.category.toLowerCase().includes(search);

      const matchesCategory =
        selectedCategory === "All" || event.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "All" ||
        (selectedStatus === "Joined" && joinedEvents.includes(event.id)) ||
        event.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [
    baseEventsForFilters,
    searchTerm,
    selectedCategory,
    selectedStatus,
    joinedEvents,
  ]);

  const groupedDates = useMemo(() => {
    const map = new Map<string, NormalizedEvent[]>();

    filteredEvents.forEach((event) => {
      if (!map.has(event.rawDateKey)) {
        map.set(event.rawDateKey, []);
      }
      map.get(event.rawDateKey)!.push(event);
    });

    const entries = Array.from(map.entries()).sort((a, b) => {
      const [ka] = a;
      const [kb] = b;
      if (ka === "no-date") return 1;
      if (kb === "no-date") return -1;
      return ka.localeCompare(kb);
    });

    return entries.map(([key, items]) => {
      let parsed: Date | null = null;

      if (key !== "no-date") {
        parsed = new Date(`${key}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) parsed = null;
      }

      return {
        key,
        items,
        dayLabel: parsed
          ? parsed.toLocaleDateString("en-GB", { day: "2-digit" })
          : "--",
        monthLabel: parsed
          ? parsed.toLocaleDateString("en-GB", { month: "2-digit" })
          : "00",
      };
    });
  }, [filteredEvents]);

  useEffect(() => {
    if (groupedDates.length === 0) {
      setSelectedDateKey("");
      return;
    }

    const exists = groupedDates.some((group) => group.key === selectedDateKey);
    if (!selectedDateKey || !exists) {
      setSelectedDateKey(groupedDates[0].key);
    }
  }, [groupedDates, selectedDateKey]);

  useEffect(() => {
    if (
      selectedCategory !== "All" &&
      !categoryOptions.includes(selectedCategory)
    ) {
      setSelectedCategory("All");
    }
  }, [categoryOptions, selectedCategory]);

  const selectedEvents = useMemo(() => {
    if (!selectedDateKey && groupedDates.length > 0) {
      return groupedDates[0].items;
    }

    const found = groupedDates.find((group) => group.key === selectedDateKey);
    return found ? found.items : [];
  }, [groupedDates, selectedDateKey]);

  const getStatusBadge = (status: string) => {
    if (status === "ongoing") return "bg-green-50 text-green-700";
    if (status === "completed") return "bg-slate-100 text-slate-600";
    return "bg-[#e8eefc] text-[#1e3a8a]";
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#1e3a8a] via-[#2847a1] to-[#0f766e] p-6 text-white shadow-xl sm:p-8">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
              Sharek Events
            </span>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Explore events in a clean timeline
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/85 sm:text-base">
              Focus on the nearest activities first, with filters built from the events that are actually available.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-3 lg:grid-cols-4">
            <input
              type="text"
              placeholder="Search by title, category, or keyword"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={selectedWindow}
              onChange={(e) => setSelectedWindow(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
            >
              <option value="Soon">Soon</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="All">All Events</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
            >
              <option value="All">All Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="Joined">Joined</option>
            </select>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("All");
                setSelectedWindow("Soon");
                setSelectedStatus("All");
              }}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset Filters
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
                  Activities Timeline
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {selectedWindow.toLowerCase()} events first to keep the page clean.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {filteredEvents.length} result{filteredEvents.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="relative px-3 py-6">
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-slate-200" />

                  <div className="relative flex items-center gap-8">
                    {groupedDates.length > 0 ? (
                      groupedDates.map((group) => {
                        const isActive = selectedDateKey === group.key;

                        return (
                          <button
                            key={group.key}
                            onClick={() => setSelectedDateKey(group.key)}
                            className="relative flex flex-col items-center text-center"
                          >
                            <span
                              className={`mb-3 text-sm font-semibold ${
                                isActive ? "text-[#1e3a8a]" : "text-slate-500"
                              }`}
                            >
                              {group.dayLabel}/{group.monthLabel}
                            </span>

                            <span
                              className={`z-10 h-4 w-4 rounded-full border-4 ${
                                isActive
                                  ? "border-[#1e3a8a] bg-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            />

                            <span
                              className={`mt-3 text-xs ${
                                isActive ? "text-[#1e3a8a]" : "text-slate-400"
                              }`}
                            >
                              {group.items.length} event
                              {group.items.length > 1 ? "s" : ""}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="relative z-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                        <p className="text-sm text-slate-500">
                          No matching dates found.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {selectedEvents.length > 0 ? (
                selectedEvents.map((event) => {
                  const isJoined = joinedEvents.includes(event.id);

                  return (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-slate-200 p-5 transition hover:border-[#1e3a8a] hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#e8eefc] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
                              {event.category}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
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
                          </div>

                          <h3 className="mt-3 text-xl font-semibold text-slate-900">
                            {event.title}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {event.description || "No description available."}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                            <p>
                              <span className="font-medium text-slate-700">Date:</span>{" "}
                              {event.displayDate}
                            </p>
                            <p>
                              <span className="font-medium text-slate-700">Time:</span>{" "}
                              {event.timeLabel}
                            </p>
                            <p>
                              <span className="font-medium text-slate-700">Place:</span>{" "}
                              {event.location || "TBA"}
                            </p>
                          </div>

                          <div className="mt-5">
                            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                              <span>Registration</span>
                              <span>
                                {event.registered_count}
                                {event.max_capacity ? ` / ${event.max_capacity}` : ""}
                              </span>
                            </div>

                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
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
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            Details
                          </Link>

                          <button
                            onClick={() => handleJoinToggle(event.id)}
                            disabled={event.isFull && !isJoined}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                              event.isFull && !isJoined
                                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                : isJoined
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-[#1e3a8a] text-white hover:opacity-90"
                            }`}
                          >
                            {event.isFull && !isJoined
                              ? "Full"
                              : isJoined
                              ? "Leave"
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
                    No events matched your filters.
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