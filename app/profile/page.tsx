"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  email?: string;
  student_id?: string;
  major?: string;
  academic_year?: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  avatar_url?: string;
  is_admin?: boolean;
  is_club_admin?: boolean;
  portal_verified?: boolean;
};

const yearOptions = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "Graduate",
];

const interestOptions = [
  "Hackathons",
  "Student Projects",
  "Workshops",
  "Startup Teams",
  "Research",
  "Competitions",
  "Study Groups",
  "Volunteering",
  "Networking Events",
  "Tech Communities",
];

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editing, setEditing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [studentIdState, setStudentIdState] = useState("");
  const [majorState, setMajorState] = useState("");

  const [year, setYear] = useState("");
  const [bio, setBio] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        setEmail(user.email ?? "");

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          setError(profileError.message);
          return;
        }

        setProfile(data);
        setFullName(data.full_name || "");
        setStudentIdState(data.student_id || "");
        setMajorState(data.major || "");
        setYear(data.academic_year || "");
        setBio(data.bio || "");
        setSkillsInput(data.skills?.join(", ") || "");
        setInterests(data.interests || []);
        setAvatarUrl(data.avatar_url || "");
      } catch {
        setError("Something went wrong while loading your profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleInterestToggle = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest]
    );
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2MB.");
      return;
    }

    setUploadingImage(true);
    setError("");
    setSuccess("");

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      setAvatarUrl(publicUrl);
      setSuccess("Image uploaded. Click Save to keep it.");
    } catch {
      setError("Something went wrong while uploading the image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const cleanedSkills = skillsInput
      .split(",")
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0);

    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          student_id: studentIdState.trim(),
          academic_year: year.trim(),
          bio: bio.trim(),
          skills: cleanedSkills,
          interests,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setProfile(data);
      setStudentIdState(data.student_id || "");
      setSuccess("Profile updated successfully.");
      setEditing(false);
    } catch {
      setError("Something went wrong while saving your profile.");
    } finally {
      setSaving(false);
    }
  };

  const initials =
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    email?.trim()?.charAt(0)?.toUpperCase() ||
    "S";

  const inputClass =
    "mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f3f5f9]">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            Loading profile...
          </div>
        </section>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="min-h-screen bg-[#f3f5f9]">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
            {error}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f9]">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid gap-6 justify-center">
          <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center gap-3">
                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#e8eefc] text-3xl font-bold text-[#1e3a8a]">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profile avatar"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                {editing && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="rounded-lg border border-[#1e3a8a] px-3 py-2 text-xs font-medium text-[#1e3a8a] hover:bg-[#eef3ff] disabled:opacity-60"
                    >
                      {uploadingImage ? "Uploading..." : "Change Photo"}
                    </button>
                  </>
                )}
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile?.full_name || "Student User"}
                </h2>
                <div className="mt-2 flex items-center gap-2">
                  {profile?.portal_verified && (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      Verified
                    </span>
                  )}
                  {profile?.is_admin && (
                    <span className="rounded-full bg-[#fef3c7] px-2 py-1 text-xs font-medium text-[#92400e]">
                      Admin
                    </span>
                  )}
                  {profile?.is_club_admin && (
                    <span className="rounded-full bg-[#ede9fe] px-2 py-1 text-xs font-medium text-[#6d28d9]">
                      Club Admin
                    </span>
                  )}
                </div>
                <p className="mt-1 text-base text-gray-700">{profile?.major || "Major not specified"}</p>
                <p className="mt-2 text-sm text-gray-500">
                  Princess Sumaya University for Technology
                </p>
              </div>

              {!editing ? (
                <button
                  onClick={() => {
                    setEditing(true);
                    setSuccess("");
                    setError("");
                  }}
                  className="rounded-xl border border-[#1e3a8a] px-4 py-2 text-sm font-medium text-[#1e3a8a] transition hover:bg-[#eef3ff]"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setYear(profile?.academic_year || "");
                      setBio(profile?.bio || "");
                      setSkillsInput(profile?.skills?.join(", ") || "");
                      setInterests(profile?.interests || []);
                      setAvatarUrl(profile?.avatar_url || "");
                      setFullName(profile?.full_name || "");
                      setStudentIdState(profile?.student_id || "");
                      setMajorState(profile?.major || "");
                      setError("");
                      setSuccess("");
                    }}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="rounded-xl bg-[#1e3a8a] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-500">Email</h3>
                <p className="mt-2 text-base text-gray-900">{email || "No email"}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">Student ID</h3>
                {!editing ? (
                  <p className="mt-2 text-base text-gray-900">{profile?.student_id || "Not specified"}</p>
                ) : (
                  <input
                    type="text"
                    value={studentIdState}
                    onChange={(e) => setStudentIdState(e.target.value)}
                    placeholder="Student ID"
                    className={inputClass}
                  />
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">Major</h3>
                <p className="mt-2 text-base text-gray-900">
                  {profile?.major || "Not specified"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">Academic Year</h3>
                {!editing ? (
                  <p className="mt-2 text-base text-gray-900">
                    {profile?.academic_year || "Not specified"}
                  </p>
                ) : (
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select academic year</option>
                    {yearOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">
                  Collaboration Interests
                </h3>

                {!editing ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile?.interests && profile.interests.length > 0 ? (
                      profile.interests.map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full bg-[#ecfdf5] px-3 py-1 text-sm font-medium text-[#0f766e]"
                        >
                          {interest}
                        </span>
                      ))
                    ) : (
                      <p className="text-base text-gray-900">Not specified</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-300 bg-white p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {interestOptions.map((interest) => {
                        const selected = interests.includes(interest);

                        return (
                          <label
                            key={interest}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                              selected
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => handleInterestToggle(interest)}
                              className="h-4 w-4 cursor-pointer accent-green-600"
                            />
                            <span>{interest}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-500">About</h3>
              {!editing ? (
                <p className="mt-3 leading-7 text-gray-700">
                  {profile?.bio || "No bio added yet."}
                </p>
              ) : (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                  placeholder="Write a short bio about yourself..."
                  className={inputClass}
                />
              )}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-500">Skills</h3>

              {!editing ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {profile?.skills && profile.skills.length > 0 ? (
                    profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#e8eefc] px-4 py-2 text-sm font-medium text-[#1e3a8a]"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No skills added yet.</p>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="e.g. Flutter, Vue.js, UI/UX, Public Speaking"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Separate skills with commas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}