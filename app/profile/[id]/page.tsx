"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppNavbar from "../../../components/AppNavbar";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone_number?: string | null;
  student_id?: string | null;
  major?: string | null;
  academic_year?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
  avatar_url?: string | null;
  portal_verified?: boolean | null;
  is_club_admin?: boolean | null;
};

type ManagedClub = {
  id: string;
  name?: string | null;
  title?: string | null;
};

type ClubMembershipRow = {
  club_id: string;
  clubs?: ManagedClub | ManagedClub[] | null;
};

const getClubName = (club: ManagedClub) =>
  club.name?.trim() || club.title?.trim() || "Untitled club";

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [managedClub, setManagedClub] = useState<ManagedClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!id) return;

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

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();

        if (profileError || !data) {
          setError(profileError?.message || "Profile not found.");
          return;
        }

        const loadedProfile = data as Profile;
        setProfile(loadedProfile);
        setAvatarUrl(loadedProfile.avatar_url || "");
        const { data: managedClubData, error: managedClubError } = await supabase
          .from("clubs")
          .select("id, name, title")
          .eq("club_admin_id", loadedProfile.id)
          .limit(1)
          .maybeSingle();

        if (managedClubError) {
          console.warn("Could not load managed club:", managedClubError.message);
          setManagedClub(null);
        } else {
          let nextManagedClub = (managedClubData as ManagedClub | null) || null;

          if (!nextManagedClub) {
            const { data: membershipData, error: membershipError } = await supabase
              .from("club_members")
              .select("club_id, clubs(id, name, title)")
              .eq("user_id", loadedProfile.id)
              .limit(1);

            if (membershipError) {
              console.warn("Could not load fallback club admin membership:", membershipError.message);
            } else {
              const membership = ((membershipData || []) as ClubMembershipRow[])[0];
              const membershipClub = Array.isArray(membership?.clubs)
                ? membership.clubs[0]
                : membership?.clubs;
              nextManagedClub = membershipClub || null;
            }
          }

          setManagedClub(nextManagedClub);
        }
        setLoading(false);

        if (
          loadedProfile.avatar_url &&
          loadedProfile.avatar_url.includes("/object/public/avatars/")
        ) {
          try {
            const parts = loadedProfile.avatar_url.split("/object/public/avatars/");
            const objectPath = parts[1];

            if (objectPath) {
              const { data: signedData, error: signedError } =
                await supabase.storage.from("avatars").createSignedUrl(objectPath, 60);

              if (!signedError && signedData?.signedUrl) {
                setAvatarUrl(signedData.signedUrl);
              }
            }
          } catch (err) {
            console.warn("Could not create signed URL for avatar:", err);
          }
        }
      } catch (err) {
        console.error("MEMBER PROFILE ERROR:", err);
        setError("Something went wrong while loading this profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id, router]);

  const initials =
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    profile?.email?.trim()?.charAt(0)?.toUpperCase() ||
    "S";

  return (
    <main className="min-h-screen bg-[#f3f5f9]">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/profile"
            className="text-sm font-medium text-[#1e3a8a] hover:underline"
          >
            Back to profile
          </Link>

          {loading && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading profile...
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
              {error}
            </div>
          )}

          {!loading && profile && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#e8eefc] text-3xl font-bold text-[#1e3a8a]">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profile avatar"
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {profile.full_name || "Student User"}
                    </h1>
                    {profile.portal_verified && (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        Verified
                      </span>
                    )}
                    {managedClub && (
                      <span className="rounded-full bg-[#ede9fe] px-2 py-1 text-xs font-medium text-[#6d28d9]">
                        Admin of {getClubName(managedClub)}
                      </span>
                    )}
                  </div>
                  {managedClub && (
                    <p className="mt-2 text-sm font-medium text-[#1e3a8a]">
                      Club Admin of {getClubName(managedClub)}
                    </p>
                  )}
                  <p className="mt-1 text-base text-gray-700">
                    {profile.major || "Major not specified"}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Princess Sumaya University for Technology
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <h2 className="text-sm font-semibold text-gray-500">Email</h2>
                  <p className="mt-2 text-base text-gray-900">
                    {profile.email || "Not specified"}
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-500">
                    Phone Number
                  </h2>
                  <p className="mt-2 text-base text-gray-900">
                    {profile.phone_number || "Not specified"}
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-500">
                    Student ID
                  </h2>
                  <p className="mt-2 text-base text-gray-900">
                    {profile.student_id || "Not specified"}
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-500">Major</h2>
                  <p className="mt-2 text-base text-gray-900">
                    {profile.major || "Not specified"}
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-500">
                    Academic Year
                  </h2>
                  <p className="mt-2 text-base text-gray-900">
                    {profile.academic_year || "Not specified"}
                  </p>
                </div>
              </div>

              {managedClub && (
                <div className="mt-8 rounded-2xl border border-[#d9e3ff] bg-[#f8fbff] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1e3a8a]">
                        Leadership
                      </p>
                      <h2 className="mt-2 text-lg font-bold text-slate-900">
                        Club Admin of {getClubName(managedClub)}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        This student is the assigned admin for this club.
                      </p>
                    </div>

                    <Link
                      href={`/clubs/${managedClub.id}`}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#1e3a8a] px-4 py-2 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eef3ff]"
                    >
                      View club
                    </Link>
                  </div>
                </div>
              )}

              <div className="mt-8">
                <h2 className="text-sm font-semibold text-gray-500">About</h2>
                <p className="mt-3 leading-7 text-gray-700">
                  {profile.bio || "No bio added yet."}
                </p>
              </div>

              <div className="mt-8">
                <h2 className="text-sm font-semibold text-gray-500">Skills</h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  {profile.skills && profile.skills.length > 0 ? (
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
              </div>

              <div className="mt-8">
                <h2 className="text-sm font-semibold text-gray-500">
                  Collaboration Interests
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.interests && profile.interests.length > 0 ? (
                    profile.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full bg-[#ecfdf5] px-3 py-1 text-sm font-medium text-[#0f766e]"
                      >
                        {interest}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No interests added yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
