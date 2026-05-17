"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// Handles Supabase email-verification links and finalizes the user's profile.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    // Reads tokens Supabase may return in the URL hash after email verification.
    const getHashParams = () => {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      return new URLSearchParams(hash);
    };

    // Exchanges the verification link for a session, verifies the email, and updates the profile.
    const verifyEmail = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = getHashParams();
        const code = params.get("code");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const errorDescription =
          params.get("error_description") || hashParams.get("error_description");

        if (errorDescription) {
          throw new Error(errorDescription.replace(/\+/g, " "));
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw userError || new Error("Could not verify this email.");
        }

        if (!user.email_confirmed_at) {
          throw new Error("Email verification is not complete yet.");
        }

        const metadata = user.user_metadata || {};
        const profilePayload = {
          id: user.id,
          email: user.email || "",
          phone_number:
            typeof metadata.phone_number === "string"
              ? metadata.phone_number
              : "",
          student_id:
            typeof metadata.student_id === "string" ? metadata.student_id : "",
          full_name:
            typeof metadata.full_name === "string" ? metadata.full_name : "",
          major: typeof metadata.major === "string" ? metadata.major : "",
          academic_year: "",
          bio: "",
          avatar_url: "",
          skills: [],
          interests: [],
          is_admin: false,
          is_club_admin: false,
          portal_verified: true,
        };

        const { data: existingProfile, error: existingProfileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (existingProfileError) {
          throw existingProfileError;
        }

        let profileError = null;

        if (existingProfile) {
          const updateResult = await supabase
            .from("profiles")
            .update({ portal_verified: true })
            .eq("id", user.id);
          profileError = updateResult.error;
        } else {
          const insertResult = await supabase
            .from("profiles")
            .insert(profilePayload);
          profileError = insertResult.error;
        }

        if (
          profileError &&
          profileError.message.toLowerCase().includes("phone_number")
        ) {
          const profileWithoutPhone: Partial<typeof profilePayload> = {
            ...profilePayload,
          };
          delete profileWithoutPhone.phone_number;
          const retry = existingProfile
            ? await supabase
                .from("profiles")
                .update({ portal_verified: true })
                .eq("id", user.id)
            : await supabase
                .from("profiles")
                .insert(profileWithoutPhone);
          profileError = retry.error;
        }

        if (profileError) {
          throw profileError;
        }

        await supabase.auth.signOut();
        setMessage("Email verified. Redirecting to sign in...");
        router.replace("/login?verified=1");
      } catch (err) {
        setMessage(
          err instanceof Error
            ? err.message
            : "Could not verify your email. Please try again."
        );
        setTimeout(() => router.replace("/login"), 2500);
      }
    };

    verifyEmail();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f4f7] px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-[#1e3a8a]">
          Sharek Verification
        </h1>
        <p className="mt-4 text-sm text-slate-600">{message}</p>
      </div>
    </main>
  );
}
