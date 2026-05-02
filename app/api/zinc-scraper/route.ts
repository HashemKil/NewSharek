import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── IT keyword filter ────────────────────────────────────────────────────────
const IT_KEYWORDS = [
  "tech", "technology", "software", "hardware",
  "ai", "artificial intelligence", "machine learning", "ml", "deep learning",
  "data", "data science", "analytics", "database",
  "cyber", "cybersecurity", "security", "hacking",
  "programming", "coding", "developer", "development",
  "web", "mobile", "app", "application", "frontend", "backend", "fullstack",
  "digital", "cloud", "devops", "automation", "infrastructure",
  "blockchain", "crypto",
  "robotics", "iot", "internet of things", "embedded",
  "computer", "computing", "information technology", " it ",
  "startup", "innovation", "product", "agile", "scrum",
  "hackathon", "bootcamp", "training", "workshop", "seminar", "conference",
  "javascript", "typescript", "python", "java", "react", "node", "api",
  "ui", "ux", "design", "network", "stem", "engineering",
];

function isItRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return IT_KEYWORDS.some((kw) => text.includes(kw));
}

// ─── XML parser (no extra dependencies) ──────────────────────────────────────
interface ZincEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  totalCount: number;
}

function getTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function parseZincXML(xml: string): ZincEvent[] {
  const events: ZincEvent[] = [];
  for (const match of xml.matchAll(/<Events>([\s\S]*?)<\/Events>/g)) {
    const b = match[1];
    const id = getTag(b, "ID");
    if (!id) continue;
    events.push({
      id,
      title: getTag(b, "EventTitle") || "Untitled Event",
      description: getTag(b, "Description") || getTag(b, "ShortDescription"),
      startDate: getTag(b, "EventStartDate"),
      endDate: getTag(b, "EventEndDate"),
      location:
        getTag(b, "MeetingRoomEnglishName") ||
        getTag(b, "MeetingRoomArabichName") ||
        "Zinc Hub, Amman",
      totalCount: parseInt(getTag(b, "SearchCount") || "0", 10),
    });
  }
  return events;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Step 1: establish a session by loading the events page ──────────────────
async function getZincSession(): Promise<string> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("https://zinc.jo/en/Home/Events", {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
    });
    clearTimeout(t);

    // Collect all Set-Cookie headers into a single Cookie string
    const raw = res.headers.get("set-cookie") ?? "";
    if (!raw) return "";

    // Parse multiple cookies (they may be comma-separated or in a single header)
    const cookies = raw
      .split(/,(?=[^ ])/g) // split on commas not followed by a space (cookie boundary)
      .map((c) => c.split(";")[0].trim()) // take only name=value part
      .filter(Boolean)
      .join("; ");

    return cookies;
  } catch {
    return "";
  }
}

// ─── Step 2: fetch one page of events using the session ──────────────────────
async function fetchZincPage(
  page: number,
  cookie: string
): Promise<ZincEvent[]> {
  const body = new URLSearchParams({
    PageNumber: String(page),
    PageSize: "20",
    FromDate: "",
    ToDate: "",
    EventTitle: "",
    InsideZINC: "",
  });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch("https://zinc.jo/en/Events/Search_EventsFilters", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://zinc.jo/en/Home/Events",
        "User-Agent": UA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseZincXML(xml);
  } catch {
    clearTimeout(t);
    return [];
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL is not configured." },
        { status: 500 }
      );
    }
    if (!serviceKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY is not set. " +
            "Go to Supabase → Settings → API → copy the service_role secret key, " +
            "then add it to Vercel → Project Settings → Environment Variables " +
            "(or .env.local for local testing).",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ── Establish zinc.jo session first ──────────────────────────────────────
    const sessionCookie = await getZincSession();

    // ── Paginate through events (max 5 pages × 20 = 100 events) ─────────────
    const allZincEvents: ZincEvent[] = [];
    let totalCount = Infinity;

    for (let page = 1; page <= 5 && allZincEvents.length < totalCount; page++) {
      const pageEvents = await fetchZincPage(page, sessionCookie);
      if (pageEvents.length === 0) break;
      if (page === 1 && pageEvents[0]?.totalCount) {
        totalCount = pageEvents[0].totalCount;
      }
      allZincEvents.push(...pageEvents);
    }

    if (allZincEvents.length === 0) {
      return NextResponse.json({
        message:
          "Could not fetch events from zinc.jo — the site may require login or is blocking server requests. " +
          `Session cookie obtained: ${sessionCookie ? "yes" : "no"}.`,
        total_scraped: 0,
        it_filtered: 0,
        inserted: 0,
      });
    }

    // ── Filter IT-related events ──────────────────────────────────────────────
    const itEvents = allZincEvents.filter((e) =>
      isItRelated(e.title, e.description)
    );

    if (itEvents.length === 0) {
      return NextResponse.json({
        message: `Scraped ${allZincEvents.length} events from Zinc — none matched IT/Tech keywords this week.`,
        total_scraped: allZincEvents.length,
        it_filtered: 0,
        inserted: 0,
      });
    }

    // ── Deduplicate ───────────────────────────────────────────────────────────
    const sourceUrls = itEvents.map((e) => `https://zinc.jo/event/${e.id}`);
    const { data: existing } = await supabase
      .from("events")
      .select("source_url")
      .in("source_url", sourceUrls);

    const existingSet = new Set(
      (existing ?? []).map((r: { source_url: string }) => r.source_url)
    );

    const toInsert = itEvents
      .filter((e) => !existingSet.has(`https://zinc.jo/event/${e.id}`))
      .map((e) => ({
        title: e.title,
        description: e.description || null,
        category: "Tech",
        event_date: e.endDate || e.startDate || null,
        location: e.location,
        source_url: `https://zinc.jo/event/${e.id}`,
        approval_status: "pending",
        is_club_members_only: false,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({
        message: `All ${itEvents.length} IT event(s) from Zinc are already in the database.`,
        total_scraped: allZincEvents.length,
        it_filtered: itEvents.length,
        inserted: 0,
      });
    }

    const { error: insertError } = await supabase
      .from("events")
      .insert(toInsert);

    if (insertError) {
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `✓ Zinc sync complete — ${toInsert.length} new IT event(s) added for admin review.`,
      total_scraped: allZincEvents.length,
      it_filtered: itEvents.length,
      inserted: toInsert.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Unexpected error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
