import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RegistrationRow = {
  id: string;
  user_id: string | null;
  created_at: string | null;
  status?: string | null;
  full_name?: string | null;
  email?: string | null;
  student_id?: string | null;
  major?: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  major: string | null;
};

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase server credentials are not configured." },
      { status: 500 }
    );
  }

  if (!token) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  if (!eventId) {
    return NextResponse.json({ error: "Missing event id." }, { status: 400 });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const registrationResult = await adminClient
    .from("event_registrations")
    .select("id, user_id, created_at, status, full_name, email, student_id, major")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  let registrationData = registrationResult.data as RegistrationRow[] | null;
  let registrationError = registrationResult.error;

  if (registrationError?.code === "42P01") {
    return NextResponse.json({ registrations: [] });
  }

  if (registrationError) {
    const fallback = await adminClient
      .from("event_registrations")
      .select("id, user_id, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    registrationData = fallback.data as RegistrationRow[] | null;
    registrationError = fallback.error;
  }

  if (registrationError) {
    return NextResponse.json({ error: registrationError.message }, { status: 500 });
  }

  const registrations = (registrationData ?? []) as RegistrationRow[];
  const userIds = registrations
    .map((registration) => registration.user_id)
    .filter((id): id is string => Boolean(id));

  const { data: profilesData } = userIds.length
    ? await adminClient
        .from("profiles")
        .select("id, full_name, email, student_id, major")
        .in("id", userIds)
    : { data: [] as ProfileRow[] };

  const profilesById = new Map(
    ((profilesData ?? []) as ProfileRow[]).map((profileRow) => [
      profileRow.id,
      profileRow,
    ])
  );

  return NextResponse.json({
    registrations: registrations.map((registration) => {
      const profileRow = registration.user_id
        ? profilesById.get(registration.user_id)
        : null;

      return {
        id: registration.id,
        user_id: registration.user_id,
        created_at: registration.created_at,
        status: registration.status ?? null,
        profiles: profileRow ?? {
          full_name: registration.full_name ?? null,
          email: registration.email ?? null,
          student_id: registration.student_id ?? null,
          major: registration.major ?? null,
        },
      };
    }),
  });
}
