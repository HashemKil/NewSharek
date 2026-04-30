"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClubAdminContext, type ManagedClub } from "../../../lib/clubAdmin";
import { supabase } from "../../../lib/supabase";

type ClubMember = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  major: string | null;
  academic_year: string | null;
  created_at: string | null;
};

export default function ClubAdminMembersPage() {
  const [managedClub, setManagedClub] = useState<ManagedClub | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadMembers = async () => {
      setLoading(true);
      setError("");

      const context = await getClubAdminContext();
      if (context.error || !context.managedClub) {
        setManagedClub(null);
        setMembers([]);
        setCurrentUserId(null);
        setError(context.error);
        setLoading(false);
        return;
      }

      setManagedClub(context.managedClub);
      setCurrentUserId(context.userId);

      const { data, error: membersError } = await supabase
        .from("club_members")
        .select(
          "id, user_id, full_name, email, student_id, major, academic_year, created_at"
        )
        .eq("club_id", context.managedClub.id)
        .order("created_at", { ascending: true });

      if (membersError) {
        setError(membersError.message);
        setMembers([]);
      } else {
        setMembers((data ?? []) as ClubMember[]);
      }

      setLoading(false);
    };

    void Promise.resolve().then(loadMembers);
  }, []);

  const handleRemoveMember = async (member: ClubMember) => {
    if (!managedClub) return;

    setActionLoading(member.user_id);
    setError("");
    setSuccess("");

    const { error: removeError } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", managedClub.id)
      .eq("user_id", member.user_id);

    if (removeError) {
      setError(removeError.message);
    } else {
      setMembers((prev) => prev.filter((item) => item.user_id !== member.user_id));
      setSuccess("Member removed from the club.");
      setTimeout(() => setSuccess(""), 3000);
    }

    setActionLoading(null);
  };

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Club Members</h1>
          <p className="mt-1 text-sm text-slate-500">
            View the members of your club and manage its roster.
          </p>
        </div>
        {managedClub && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">
              Managed Club
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {managedClub.name?.trim() || managedClub.title?.trim() || "Your Club"}
            </p>
          </div>
        )}
      </div>

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

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Members</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{members.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Admin Access</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">Club-only roster control</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Helpful Link</p>
          <Link href="/clubs" className="mt-2 inline-flex text-sm font-semibold text-[#1e3a8a] hover:underline">
            Open clubs page
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Member Roster</h2>
          <p className="text-xs text-slate-400">
            You can remove members from the club. Your own membership is locked here.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            No members found for this club.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Student ID</th>
                  <th className="px-6 py-3">Major</th>
                  <th className="px-6 py-3">Year</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.user_id === currentUserId;

                  return (
                    <tr
                      key={member.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-800">
                            {member.full_name || "Unknown member"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {member.email || "No email"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {member.student_id || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{member.major || "-"}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {member.academic_year || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {member.created_at
                          ? new Date(member.created_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="px-6 py-4">
                        {isSelf ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            You
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRemoveMember(member)}
                            disabled={actionLoading === member.user_id}
                            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {actionLoading === member.user_id ? "Removing..." : "Remove"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
