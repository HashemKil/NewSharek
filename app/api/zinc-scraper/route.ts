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
  "blockchain", "crypto", "nft",
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

// ─── Simple XML parser (no extra dependencies) ────────────────────────────────
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

// ─── Fetch one page from Zinc ─────────────────────────────────────────────────
async function fetchZincPage(page: number): Promise<ZincEvent[]> {
  const body = new URLSearchParams({
    PageNumber: String(page),
    PageSize: "30",
    FromDate: "",
    ToDate: "",
    EventTitle: "",
    InsideZINC: "",
  });

  const res = await fetch("https://zinc.jo/en/Events/Search_EventsFilters", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://zinc.jo/en/Home/Events",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    body: body.toString(),
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];
  const xml = await res.text();
  return parseZincXML(xml);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  // Auth check: allow Vercel cron (Bearer token) or same-origin admin trigger
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const host = request.headers.get("host") ?? "";
    const origin = request.headers.get("origin") ?? "";
    const isLocal = host.includes("localhost") || origin.includes("localhost");
    const isSameOrigin = origin !== "" && host !== "" && origin.includes(host.split(":")[0]);
    if (!isLocal && !isSameOrigin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Require service role key to bypass RLS for inserting
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not set. " +
          "Go to Supabase → Settings → API → copy the service_role key, " +
          "then add it to .env.local and your Vercel environment variables.",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Paginate through Zinc events ──────────────────────────────────────────
  const allZincEvents: ZincEvent[] = [];
  let totalCount = Infinity;

  for (let page = 1; page <= 15 && allZincEvents.length < totalCount; page++) {
    const pageEvents = await fetchZincPage(page);
    if (pageEvents.length === 0) break;
    if (page === 1 && pageEvents[0]?.totalCount) {
      totalCount = pageEvents[0].totalCount;
    }
    allZincEvents.push(...pageEvents);
  }

  // ── Filter IT-related events ──────────────────────────────────────────────
  const itEvents = allZincEvents.filter((e) =>
    isItRelated(e.title, e.description)
  );

  if (itEvents.length === 0) {
    return NextResponse.json({
      message: "No IT-related events found on Zinc this week.",
      total_scraped: allZincEvents.length,
      it_filtered: 0,
      inserted: 0,
    });
  }

  // ── Deduplicate: skip events already in DB by source_url ─────────────────
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
      message: "All IT events from Zinc are already in the database.",
      total_scraped: allZincEvents.length,
      it_filtered: itEvents.length,
      inserted: 0,
    });
  }

  const { error: insertError } = await supabase.from("events").insert(toInsert);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Zinc sync complete — ${toInsert.length} new IT event(s) added for admin review.`,
    total_scraped: allZincEvents.length,
    it_filtered: itEvents.length,
    inserted: toInsert.length,
  });
}
