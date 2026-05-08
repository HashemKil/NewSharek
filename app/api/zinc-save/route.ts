import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inferEventCategory } from "../../../lib/eventCategories";

export interface ZincEventPayload {
  title: string;
  category?: string | null;
  description?: string | null;
  event_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_details?: string | null;
  image_url?: string | null;
  source_url: string;
}

function normalizeDuplicateText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getDuplicateKey(event: Pick<ZincEventPayload, "title" | "event_date">) {
  const dateKey = event.event_date ? event.event_date.slice(0, 10) : "no-date";
  return `${normalizeDuplicateText(event.title)}|${dateKey}`;
}

function normalizeDate(value: string | null | undefined) {
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
}

function normalizeTime(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2];
  const meridian = match[3]?.toUpperCase();

  if (meridian === "PM" && hours < 12) hours += 12;
  if (meridian === "AM" && hours === 12) hours = 0;
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return null;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function isUpcomingOrOngoing(event: ZincEventPayload) {
  const eventDate = normalizeDate(event.event_date);
  const endDate = normalizeDate(event.end_date) ?? eventDate;
  const today = new Date().toISOString().slice(0, 10);

  return !!endDate && endDate >= today;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. " +
            "Add it to Vercel → Project Settings → Environment Variables.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const events: ZincEventPayload[] = await request.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ message: "No events to save.", inserted: 0 });
    }

    const currentScrapedEvents = events.filter(isUpcomingOrOngoing);

    if (currentScrapedEvents.length === 0) {
      return NextResponse.json({
        message: "No upcoming Zinc events to save.",
        inserted: 0,
      });
    }

    const uniqueScrapedEvents = Array.from(
      currentScrapedEvents.reduce((map, event) => {
        const key = getDuplicateKey(event);
        const existing = map.get(key);
        const existingScore =
          (existing?.description?.length ?? 0) + (existing?.location?.length ?? 0);
        const eventScore =
          (event.description?.length ?? 0) + (event.location?.length ?? 0);

        if (!existing || eventScore > existingScore) {
          map.set(key, event);
        }

        return map;
      }, new Map<string, ZincEventPayload>()).values()
    );

    // Deduplicate: skip any already in DB by URL or by same title/date.
    const { data: existing } = await supabase
      .from("events")
      .select("title, event_date, source_url");

    const existingSet = new Set(
      (existing ?? [])
        .map((r: { source_url: string | null }) => r.source_url)
        .filter(Boolean)
    );

    const existingDuplicateSet = new Set(
      (existing ?? []).map((r: { title: string | null; event_date: string | null }) =>
        getDuplicateKey({
          title: r.title ?? "",
          event_date: r.event_date,
        })
      )
    );

    const toInsert = uniqueScrapedEvents
      .filter((e) => !existingSet.has(e.source_url))
      .filter((e) => !existingDuplicateSet.has(getDuplicateKey(e)))
      .filter(isUpcomingOrOngoing)
      .map((e) => ({
        title: e.title,
        description: e.description ?? null,
        category: inferEventCategory(e.category, e.title, e.description),
        image_url: e.image_url ?? null,
        event_date: normalizeDate(e.event_date),
        end_date: normalizeDate(e.end_date) ?? normalizeDate(e.event_date),
        start_time: normalizeTime(e.start_time),
        end_time: normalizeTime(e.end_time),
        location: e.location ?? "Zinc Hub, Amman",
        location_details: e.location_details ?? null,
        source_url: e.source_url,
        approval_status: "pending",
        is_club_members_only: false,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({
        message: "All scraped IT events are already in the database.",
        inserted: 0,
      });
    }

    const { error } = await supabase.from("events").insert(toInsert);
    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `✓ ${toInsert.length} new IT event(s) from Zinc added for admin review.`,
      inserted: toInsert.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
