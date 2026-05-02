import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface ZincEventPayload {
  title: string;
  description?: string | null;
  event_date?: string | null;
  location?: string | null;
  source_url: string;
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

    // Deduplicate: skip any already in DB
    const sourceUrls = events.map((e) => e.source_url);
    const { data: existing } = await supabase
      .from("events")
      .select("source_url")
      .in("source_url", sourceUrls);

    const existingSet = new Set(
      (existing ?? []).map((r: { source_url: string }) => r.source_url)
    );

    const toInsert = events
      .filter((e) => !existingSet.has(e.source_url))
      .map((e) => ({
        title: e.title,
        description: e.description ?? null,
        category: "Tech",
        event_date: e.event_date ?? null,
        location: e.location ?? "Zinc Hub, Amman",
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
