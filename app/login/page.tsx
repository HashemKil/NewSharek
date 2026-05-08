"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setSuccess("Email verified successfully. You can sign in now.");
    } else if (params.get("checkEmail") === "1") {
      setSuccess(
        "Check your university email for the verification message before signing in."
      );
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUnverifiedEmail("");
    setLoading(true);

    try {
      const cleanStudentId = studentId.trim();

      // Look up the user's email by student ID. The RPC works even when
      // profiles are hidden by RLS, if the database function is installed.
      const { data: rpcProfile } = await supabase
        .rpc("get_email_by_student_id", { p_student_id: cleanStudentId })
        .maybeSingle();

      const rpcEmail =
        rpcProfile && typeof rpcProfile === "object" && "email" in rpcProfile
          ? String(rpcProfile.email)
          : "";

      let email = rpcEmail;

      if (!email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("student_id", cleanStudentId)
          .maybeSingle();

        email = profile?.email;
      }

      if (!email) {
        setError("No account found for that Student ID.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setUnverifiedEmail(email);
          setError("Please verify your email before signing in.");
          return;
        }
        setError(error.message);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && !user.email_confirmed_at) {
        await supabase.auth.signOut();
        setUnverifiedEmail(email);
        setError("Please verify your email before signing in.");
        return;
      }

      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ portal_verified: true })
          .eq("id", user.id);
      }

      router.push("/home");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;

    setResending(true);
    setError("");
    setSuccess("");

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: unverifiedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setSuccess("Verification email sent again. Check your university email.");
    }

    setResending(false);
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10";

  return (
    <main className="min-h-screen bg-[#f2f4f7] flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Image
            src="/brand/sharek-logo-cropped.png"
            alt="Sharek"
            width={190}
            height={72}
            priority
            className="h-12 w-auto object-contain"
          />
          <div className="text-sm text-gray-600">PSUT Collaboration Platform</div>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-white border rounded-xl p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-[#1e3a8a] mb-2">
            Sign In
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Welcome back to Sharek
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
              {unverifiedEmail && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="mt-3 block rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {resending ? "Sending..." : "Resend verification email"}
                </button>
              )}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              inputMode="numeric"
              required
              className={inputClass}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a8a] text-white py-3 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-5 flex justify-between text-sm">
            <span className="text-gray-500">Donâ€™t have an account?</span>
            <Link href="/register" className="text-[#1e3a8a] hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

