"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

type EventItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
  url?: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      setError("");

      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .order("date", { ascending: true });

        if (error) {
          setError(error.message);
          return;
        }

        setEvents((data as EventItem[]) || []);
      } catch {
        setError("Something went wrong while loading events.");
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

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(events.map((event) => event.category).filter(Boolean))
    );
    return ["All", ...categories];
  }, [events]);

  const locationOptions = useMemo(() => {
    const locations = Array.from(
      new Set(events.map((event) => event.location).filter(Boolean))
    );
    return ["All", ...locations];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || event.category === selectedCategory;

      const matchesLocation =
        selectedLocation === "All" || event.location === selectedLocation;

      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [events, searchTerm, selectedCategory, selectedLocation]);

  const formatDate = (value: string) => {
    if (!value) return "No date";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString("en-GB");
  };

  return (
    <main className="min-h-screen bg-[#f3f5f9]">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-xl border px-4 py-3"
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border px-4 py-3"
          >
            {categoryOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="rounded-xl border px-4 py-3"
          >
            {locationOptions.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-[#1e3a8a]">
                {event.title}
              </h2>

              <p className="text-sm text-gray-600 mt-2">
                {event.description}
              </p>

              <p className="mt-3 text-sm text-gray-500">
                {event.location} • {formatDate(event.date)}
              </p>

              <div className="mt-6 flex justify-between">
                <Link
                  href={`/events/${event.id}`}
                  className="border px-4 py-2 rounded-lg text-[#1e3a8a]"
                >
                  View Details
                </Link>

                <button
                  onClick={() => handleJoinToggle(event.id)}
                  className={`px-4 py-2 rounded-lg ${
                    joinedEvents.includes(event.id)
                      ? "bg-red-100 text-red-600"
                      : "bg-[#1e3a8a] text-white"
                  }`}
                >
                  {joinedEvents.includes(event.id) ? "Leave" : "Join"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}