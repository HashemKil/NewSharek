"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Look up the user's email by student ID from the profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("student_id", studentId)
        .single();

      if (profileError || !profile?.email) {
        setError("No account found for that Student ID.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.push("/home");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10";

  return (
    <main className="min-h-screen bg-[#f2f4f7] flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold text-[#1e3a8a]">Sharek</div>
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
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
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
            <span className="text-gray-500">Don’t have an account?</span>
            <Link href="/register" className="text-[#1e3a8a] hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}