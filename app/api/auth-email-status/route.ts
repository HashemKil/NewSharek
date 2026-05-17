import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Checks whether a Supabase auth user is already email-confirmed.
export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as {
    email?: string;
  };
  const cleanEmail = email?.trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cleanEmail) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ found: false, confirmed: false, statusKnown: false });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === cleanEmail
    );

    if (user) {
      return NextResponse.json({
        found: true,
        confirmed: Boolean(user.email_confirmed_at),
        statusKnown: true,
      });
    }

    if (data.users.length < 100) break;
  }

  return NextResponse.json({ found: false, confirmed: false, statusKnown: true });
}
