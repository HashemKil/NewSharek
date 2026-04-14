"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

type ClubRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  email?: string | null;
  location?: string | null;
  president?: string | null;
  created_at?: string | null;
};

type EventRow = {
  id: string;
  title: string | null;
  category: string | null;
  club_id: string | null;
  event_date?: string | null;
};

type Club = ClubRow & {
  displayName: string;
  eventCount: number;
  upcomingEvents: EventRow[];
};

const CLUB_FILTERS = [
  "All Clubs",
  "Technical",
  "Business",
  "Community",
  "Arts & Media",
  "Sports",
] as const;

const getClubName = (club: ClubRow) =>
  club.name?.trim() || club.title?.trim() || "Untitled club";

const getClubGroup = (club: Club) => {
  const text = [
    club.displayName,
    club.category || "",
    club.description || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    [
      "tech",
      "computer",
      "software",
      "cyber",
      "security",
      "ai",
      "data",
      "engineering",
      "robot",
      "coding",
      "programming",
    ].some((keyword) => text.includes(keyword))
  ) {
    return "Technical";
  }

  if (
    ["business", "entrepreneur", "startup", "marketing", "finance", "accounting"].some(
      (keyword) => text.includes(keyword)
    )
  ) {
    return "Business";
  }

  if (
    ["media", "design", "art", "music", "film", "photo", "content"].some((keyword) =>
      text.includes(keyword)
    )
  ) {
    return "Arts & Media";
  }

  if (
    ["sport", "football", "basketball", "fitness", "chess", "gaming"].some((keyword) =>
      text.includes(keyword)
    )
  ) {
    return "Sports";
  }

  return "Community";
};

const formatDate = (value?: string | null) => {
  if (!value) return "Date not set";
  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1);

  if (!year || Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ClubsPage() {
  const router = useRouter();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Clubs");

  useEffect(() => {
    const loadClubs = async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const [clubsResult, eventsResult] = await Promise.all([
          supabase.from("clubs").select("*"),
          supabase
            .from("events")
            .select("id, title, category, club_id, event_date"),
        ]);

        if (clubsResult.error) {
          setError(clubsResult.error.message);
          setClubs([]);
          return;
        }

        if (eventsResult.error) {
          setError(eventsResult.error.message);
          setClubs([]);
          return;
        }

        const eventRows = ((eventsResult.data || []) as EventRow[]).sort((a, b) => {
          const aDate = a.event_date ?? "";
          const bDate = b.event_date ?? "";
          return aDate.localeCompare(bDate);
        });

        const loadedClubs = ((clubsResult.data || []) as ClubRow[])
          .map((club) => {
            const relatedEvents = eventRows.filter(
              (event) => event.club_id && event.club_id === club.id
            );

            return {
              ...club,
              displayName: getClubName(club),
              eventCount: relatedEvents.length,
              upcomingEvents: relatedEvents.slice(0, 3),
            };
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        setClubs(loadedClubs);
      } catch (err) {
        console.error("CLUBS LOAD ERROR:", err);
        setError("Something went wrong while loading clubs.");
        setClubs([]);
      } finally {
        setLoading(false);
      }
    };

    loadClubs();
  }, [router]);

  const filteredClubs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clubs.filter((club) => {
      const matchesSearch =
        !query ||
        club.displayName.toLowerCase().includes(query) ||
        (club.description || "").toLowerCase().includes(query) ||
        (club.category || "").toLowerCase().includes(query) ||
        (club.location || "").toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === "All Clubs" || getClubGroup(club) === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [clubs, search, selectedCategory]);

  const resetFilters = () => {
    setSearch("");
    setSelectedCategory("All Clubs");
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#1e3a8a]">
                Clubs
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                Find student clubs
              </h1>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clubs..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-4 focus:ring-[#1e3a8a]/10"
              />
              <button
                type="button"
                onClick={resetFilters}
                disabled={!search && selectedCategory === "All Clubs"}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {CLUB_FILTERS.map((category) => {
              const active = selectedCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-slate-700 bg-slate-700 text-white shadow-sm"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading clubs...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {filteredClubs.length} club{filteredClubs.length !== 1 ? "s" : ""}
              </h2>
            </div>

            {filteredClubs.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredClubs.map((club) => {
                  const logo = club.logo_url || club.image_url || "";

                  return (
                    <article
                      key={club.id}
                      className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1e3a8a]/30 hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        {logo ? (
                          <div
                            aria-label={`${club.displayName} logo`}
                            className="h-16 w-16 rounded-lg border border-slate-200 bg-cover bg-center"
                            style={{ backgroundImage: `url(${logo})` }}
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[#c7d5fb] bg-[#eef3ff] text-xl font-bold text-[#1e3a8a]">
                            {club.displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {club.category || "Club"}
                            </span>
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              {club.eventCount} event{club.eventCount !== 1 ? "s" : ""}
                            </span>
                          </div>

                          <h3 className="mt-3 text-xl font-semibold text-slate-900">
                            {club.displayName}
                          </h3>
                          {club.location && (
                            <p className="mt-1 text-sm text-slate-500">
                              {club.location}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">
                        {club.description || "No description added yet."}
                      </p>

                      {club.upcomingEvents.length > 0 && (
                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            Events
                          </p>
                          <div className="mt-3 space-y-2">
                            {club.upcomingEvents.map((event) => (
                              <Link
                                key={event.id}
                                href={`/events/${event.id}`}
                                className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-[#1e3a8a]/40 hover:bg-slate-50"
                              >
                                <span className="font-semibold">
                                  {event.title || "Untitled event"}
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                  {formatDate(event.event_date)}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {club.website_url && (
                          <a
                            href={club.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Website
                          </a>
                        )}
                        {club.instagram_url && (
                          <a
                            href={club.instagram_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Instagram
                          </a>
                        )}
                        {club.email && (
                          <a
                            href={`mailto:${club.email}`}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Email
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  No clubs found
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Try another search or category.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
