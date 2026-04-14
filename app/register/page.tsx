"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [studentId, setStudentId] = useState("");
  const [major, setMajor] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePSUTEmail = (value: string) => {
    const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return basicEmail.test(value) && value.toLowerCase().endsWith(".psut.edu.jo");
  };

  const validateStudentId = (value: string) => /^\d{8}$/.test(value);
  const validatePhoneNumber = (value: string) => /^\+?\d{7,15}$/.test(value);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanName = `${cleanFirstName} ${cleanLastName}`.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhoneNumber = phoneNumber.trim().replace(/[\s-]/g, "");
    const cleanStudentId = studentId.trim();
    const cleanMajor = major.trim();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanEmail ||
      !cleanPhoneNumber ||
      !cleanMajor ||
      !cleanStudentId ||
      !password ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (!validatePSUTEmail(cleanEmail)) {
      setError("Only PSUT student emails (@std.psut.edu.jo) are allowed.");
      return;
    }

    if (!validateStudentId(cleanStudentId)) {
      setError("Student ID must be exactly 8 digits.");
      return;
    }

    if (!validatePhoneNumber(cleanPhoneNumber)) {
      setError("Phone number must be 7 to 15 digits. You may start it with +.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      const user = data.user;

      if (!user) {
        setError("Account created, but no user data was returned.");
        return;
      }

      const profileInsert = {
        id: user.id,
        email: cleanEmail,
        phone_number: cleanPhoneNumber,
        student_id: cleanStudentId,
        full_name: cleanName,
        major: cleanMajor,
        academic_year: "",
        bio: "",
        avatar_url: "",
        skills: [],
        interests: [],
        is_admin: false,
        is_club_admin: false,
        portal_verified: false,
      };

      let { error: profileError } = await supabase
        .from("profiles")
        .insert(profileInsert);

      if (
        profileError &&
        profileError.message.toLowerCase().includes("phone_number")
      ) {
        const profileWithoutPhone: Partial<typeof profileInsert> = {
          ...profileInsert,
        };
        delete profileWithoutPhone.phone_number;
        const retry = await supabase.from("profiles").insert(profileWithoutPhone);
        profileError = retry.error;
      }

      if (profileError) {
        console.error("Profile insert error:", profileError);
        setError(profileError.message);
        return;
      }

      setSuccess("Account created successfully. Please check your email, then sign in.");

      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneNumber("");
      setStudentId("");
      setMajor("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      console.error("Registration error:", err);
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
            Create Account
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Join Sharek and start exploring opportunities
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={inputClass}
              />

              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <input
              type="email"
              placeholder="University Email (e.g. name@std.psut.edu.jo)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              className={inputClass}
            />

            <input
              type="tel"
              placeholder="Phone Number (e.g. +962790000000)"
              value={phoneNumber}
              onChange={(e) =>
                setPhoneNumber(e.target.value.replace(/[^\d+]/g, "").slice(0, 16))
              }
              inputMode="tel"
              autoComplete="tel"
              required
              className={inputClass}
            />

            <input
              type="text"
              placeholder="Student ID (e.g. 20210001)"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              pattern="\d{8}"
              maxLength={8}
              title="Student ID must be exactly 8 digits."
              required
              className={inputClass}
            />

            <label className="block">
              <select
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Select your major</option>
                <option>Computer Science</option>
                <option>Cyber Security</option>
                <option>Software Engineering</option>
                <option>Computer Graphics and Animation</option>
                <option>Data Science and Artificial Intelligence</option>
                <option>Business Administration</option>
                <option>Accounting</option>
                <option>E-Marketing and Social Media</option>
                <option>Business Information Technology</option>
                <option>Electronics Engineering</option>
                <option>Computer Engineering</option>
                <option>Networks and Information Security Engineering</option>
                <option>Electrical Power and Energy Engineering</option>
                <option>Communications Engineering / Internet of Things</option>
              </select>
            </label>

            <input
              type="password"
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />

            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={inputClass}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a8a] text-white py-3 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-5 flex justify-between text-sm">
            <span className="text-gray-500">Already have an account?</span>
            <Link href="/login" className="text-[#1e3a8a] hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
