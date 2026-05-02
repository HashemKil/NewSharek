"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Club = {
  id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  created_at: string | null;
  memberCount?: number;
};

type Member = {
  id: string; // club_members row id
  user_id: string;
  created_at: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    student_id: string | null;
    major: string | null;
    is_club_admin: boolean | null;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10";

// ─── Club Detail Modal ────────────────────────────────────────────────────────

function ClubModal({
  club,
  onClose,
  onUpdated,
}: {
  club: Club;
  onClose: () => void;
  onUpdated: (c: Club) => void;
}) {
  const displayName = club.name?.trim() || "Unnamed Club";

  // Edit state
  const [editName, setEditName] = useState(displayName);
  const [editCategory, setEditCategory] = useState(club.category ?? "");
  const [editDesc, setEditDesc] = useState(club.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersErr, setMembersErr] = useState("");
  const [tab, setTab] = useState<"info" | "members">("info");

  // Load members
  useEffect(() => {
    if (tab !== "members") return;
    const load = async () => {
      setMembersLoading(true);
      setMembersErr("");
      try {
        const { data: rows, error } = await supabase
          .from("club_members")
          .select("id, user_id, created_at")
          .eq("club_id", club.id)
          .order("created_at", { ascending: true });

        if (error) { setMembersErr(error.message); setMembersLoading(false); return; }
        if (!rows || rows.length === 0) { setMembers([]); setMembersLoading(false); return; }

        const userIds = rows.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, student_id, major, is_club_admin")
          .in("id", userIds);

        setMembers(
          rows.map((r) => ({
            ...r,
            profiles: profiles?.find((p) => p.id === r.user_id) ?? null,
          })) as Member[]
        );
      } catch {
        setMembersErr("Failed to load members.");
      }
      setMembersLoading(false);
    };
    load();
  }, [tab, club.id]);

  const handleSave = async () => {
    setSaving(true); setSaveErr(""); setSaveMsg("");
    const { error } = await supabase
      .from("clubs")
      .update({
        name: editName.trim() || null,
        category: editCategory.trim() || null,
        description: editDesc.trim() || null,
      })
      .eq("id", club.id);

    if (error) { setSaveErr(error.message); }
    else {
      setSaveMsg("Saved successfully.");
      setTimeout(() => setSaveMsg(""), 3000);
      onUpdated({ ...club, name: editName.trim() || null, category: editCategory.trim() || null, description: editDesc.trim() || null });
    }
    setSaving(false);
  };

  const handleRemoveMember = async (member: Member) => {
    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("id", member.id);
    if (!error) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    }
  };

  const handleToggleAdmin = async (member: Member) => {
    const current = member.profiles?.is_club_admin ?? false;
    const { error } = await supabase
      .from("profiles")
      .update({ is_club_admin: !current })
      .eq("id", member.user_id);

    if (!error) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, profiles: m.profiles ? { ...m.profiles, is_club_admin: !current } : null }
            : m
        )
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">Club Details</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">{displayName}</h2>
            {club.category && (
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {club.category}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {(["info", "members"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "border-[#1e3a8a] text-[#1e3a8a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "info" ? "Club Info & Edit" : `Members${members.length > 0 ? ` (${members.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Info / Edit tab ── */}
          {tab === "info" && (
            <div className="flex flex-col gap-5 p-6">
              {saveErr && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{saveErr}</div>
              )}
              {saveMsg && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{saveMsg}</div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Club Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Category</label>
                <input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="e.g. Technology, Sports…" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Description</label>
                <textarea rows={4} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Club description…" className={`${inputCls} resize-none`} />
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 pt-2">
                <button onClick={handleSave} disabled={saving} className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60">
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <p className="text-xs text-slate-400">Created {fmt(club.created_at)}</p>
              </div>
            </div>
          )}

          {/* ── Members tab ── */}
          {tab === "members" && (
            <div className="p-6">
              {membersLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : membersErr ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{membersErr}</div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-14 text-center">
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-slate-300">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <p className="text-sm font-medium text-slate-500">No members yet.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Student ID</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Joined</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const isAdmin = m.profiles?.is_club_admin ?? false;
                        return (
                          <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{m.profiles?.full_name ?? "—"}</p>
                              <p className="text-xs text-slate-400">{m.profiles?.email ?? ""}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.profiles?.student_id ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isAdmin ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {isAdmin ? "Club Admin" : "Member"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{fmt(m.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleAdmin(m)}
                                  title={isAdmin ? "Remove admin role" : "Make club admin"}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                    isAdmin
                                      ? "bg-purple-50 text-purple-700 hover:bg-purple-100"
                                      : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                                  }`}
                                >
                                  {isAdmin ? "Remove Admin" : "Make Admin"}
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(m)}
                                  title="Remove from club"
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Club Card ────────────────────────────────────────────────────────────────

function ClubCard({ club, onClick }: { club: Club; onClick: () => void }) {
  const displayName = club.name?.trim() || "Unnamed Club";
  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1e3a8a]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
    >
      <div className="h-1 w-full rounded-t-2xl bg-[#1e3a8a]" />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            {club.category && (
              <span className="mb-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {club.category}
              </span>
            )}
            <h3 className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#1e3a8a]">
              {displayName}
            </h3>
          </div>
          <span className="flex-shrink-0 rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-xs font-bold text-[#1e3a8a]">
            {club.memberCount ?? 0} members
          </span>
        </div>
        {club.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{club.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        <span>Created {fmt(club.created_at)}</span>
        <span className="flex items-center gap-1 font-semibold text-[#1e3a8a] opacity-0 transition-opacity group-hover:opacity-100">
          Manage
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Club | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      // Fetch clubs
      const { data: clubRows, error: clubErr } = await supabase
        .from("clubs")
        .select("id, name, category, description, created_at")
        .order("created_at", { ascending: false });

      if (clubErr) { setError(clubErr.message); setLoading(false); return; }

      // Fetch member counts via a count query
      const { data: memberRows } = await supabase
        .from("club_members")
        .select("club_id");

      const countMap: Record<string, number> = {};
      (memberRows ?? []).forEach((r) => {
        countMap[r.club_id] = (countMap[r.club_id] ?? 0) + 1;
      });

      setClubs(
        (clubRows ?? []).map((c) => ({ ...c, memberCount: countMap[c.id] ?? 0 })) as Club[]
      );
      setLoading(false);
    };
    load();
  }, []);

  const term = search.trim().toLowerCase();
  const filtered = clubs.filter(
    (c) =>
      !term ||
      (c.name ?? "").toLowerCase().includes(term) ||
      (c.category ?? "").toLowerCase().includes(term)
  );

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Club Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          View and manage all clubs — edit details, manage members, and assign admin roles.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          {error.includes("permission") || error.includes("policy") ? (
            <span className="block mt-1 text-xs">Run <code className="font-mono bg-red-100 px-1 rounded">admin-clubs-policies.sql</code> in Supabase SQL Editor to grant admin access.</span>
          ) : null}
        </div>
      )}

      {/* Stats bar */}
      {!loading && (
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-xs text-slate-400">Total clubs</span>
            <span className="ml-2 font-bold text-slate-900">{clubs.length}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-xs text-slate-400">Total members</span>
            <span className="ml-2 font-bold text-slate-900">
              {clubs.reduce((s, c) => s + (c.memberCount ?? 0), 0)}
            </span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6 relative max-w-sm">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search clubs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
          <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-slate-300">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No clubs found.</p>
          <p className="text-xs text-slate-400">Clubs created by users will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((club) => (
            <ClubCard key={club.id} club={club} onClick={() => setSelected(club)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <ClubModal
          club={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setClubs((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
            setSelected(updated);
          }}
        />
      )}
    </div>
  );
}
