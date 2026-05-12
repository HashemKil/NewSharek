"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type UserMetadata = {
  full_name?: string;
  phone_number?: string;
  student_id?: string;
  major?: string;
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
  }, []);

  const ensureProfile = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw userError || new Error("Could not load the verified account.");
    }

    const metadata = (user.user_metadata || {}) as UserMetadata;
    const profilePayload = {
      id: user.id,
      email: user.email || email.trim().toLowerCase(),
      phone_number: metadata.phone_number || "",
      student_id: metadata.student_id || "",
      full_name: metadata.full_name || "",
      major: metadata.major || "",
      academic_year: "",
      bio: "",
      avatar_url: "",
      skills: [],
      interests: [],
      is_admin: false,
      is_club_admin: false,
      portal_verified: true,
    };

    let { error: profileError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (
      profileError &&
      profileError.message.toLowerCase().includes("phone_number")
    ) {
      const profileWithoutPhone: Partial<typeof profilePayload> = {
        ...profilePayload,
      };
      delete profileWithoutPhone.phone_number;
      const retry = await supabase
        .from("profiles")
        .upsert(profileWithoutPhone, { onConflict: "id" });
      profileError = retry.error;
    }

    if (profileError) {
      throw profileError;
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().replace(/\s/g, "");

    if (!cleanEmail || !cleanCode) {
      setError("Enter your university email and verification code.");
      return;
    }

    setLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: "signup",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      await ensureProfile();
      await supabase.auth.signOut();

      setSuccess("Email verified. You can sign in now.");
      setTimeout(() => router.replace("/login?verified=1"), 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not verify your email. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Enter your university email first.");
      return;
    }

    setResending(true);
    setError("");
    setSuccess("");

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setSuccess("Verification email sent again. Check your inbox.");
    }

    setResending(false);
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10";

  return (
    <main className="flex min-h-screen flex-col bg-[#f2f4f7]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Image
            src="/brand/sharek-logo-cropped.png"
            alt="Sharek"
            width={190}
            height={72}
            priority
            className="h-12 w-auto object-contain"
          />
          <Link href="/login" className="text-sm font-semibold text-[#1e3a8a]">
            Sign In
          </Link>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#1e3a8a]">
            Verify your email
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Enter the verification code sent to your university email. You can
            also click the verification link in the same email.
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleVerify}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="University email"
              className={inputClass}
              required
            />
            <input
              type="text"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/[^\dA-Za-z]/g, "").slice(0, 8))
              }
              placeholder="Verification code"
              className={`${inputClass} text-center text-lg font-semibold tracking-[0.3em]`}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#1e3a8a] py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="mt-4 w-full rounded-lg border border-slate-200 bg-white py-3 text-sm font-semibold text-[#1e3a8a] hover:bg-slate-50 disabled:opacity-60"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>
        </div>
      </section>
    </main>
  );
}
