"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Club = {
  id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  created_at: string | null;
  club_admin_id: string | null;
  memberCount?: number;
};

type Member = {
  id: string; // club_members row id
  user_id: string;
  created_at: string | null;
  status?: "pending" | "approved" | "rejected" | null;
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

const CLUB_CATEGORIES = ["Business", "Creative", "Tech", "Other"];
const MAX_CLUB_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

const readImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });

// ─── Club Detail Modal ────────────────────────────────────────────────────────

function CreateClubModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (club: Club) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CLUB_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    if (file.size > MAX_CLUB_IMAGE_SIZE_BYTES) {
      setError("Club image must be 3 MB or smaller.");
      return;
    }

    try {
      const uploadedImage = await readImageFile(file);
      setImageUrl(uploadedImage);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read this image.");
    }
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Club name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const { data, error: createError } = await supabase
      .from("clubs")
      .insert({
        name: trimmedName,
        category,
        description: description.trim() || null,
        image_url: imageUrl || null,
      })
      .select("id, name, category, description, logo_url, image_url, created_at, club_admin_id")
      .single();

    if (createError && /image_url|column/i.test(createError.message)) {
      const { data: retryData, error: retryError } = await supabase
        .from("clubs")
        .insert({
          name: trimmedName,
          category,
          description: description.trim() || null,
        })
        .select("id, name, category, description, created_at, club_admin_id")
        .single();

      if (retryError) {
        setError(retryError.message);
        setSaving(false);
        return;
      }

      onCreated({ ...(retryData as Club), image_url: null, memberCount: 0 });
      setSaving(false);
      onClose();
      return;
    }

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return;
    }

    onCreated({ ...(data as Club), memberCount: 0 });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">New Club</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Add a club</h2>
            <p className="mt-1 text-sm text-slate-500">Create a club that students can discover and request to join.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-5 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Club Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Robotics Club"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CLUB_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Club Image</label>
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center">
              <div
                className="h-24 w-full rounded-xl border border-slate-200 bg-white bg-cover bg-center sm:w-32"
                style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
              >
                {!imageUrl && (
                  <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Preview
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-sm font-medium text-slate-700">Upload from your device</p>
                <p className="text-xs text-slate-400">PNG, JPG, or WebP. Max 3 MB.</p>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af]">
                    Choose image
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this club do?"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60"
            >
              {saving ? "Creating..." : "Add club"}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClubModal({
  club,
  onClose,
  onUpdated,
  onDeleted,
}: {
  club: Club;
  onClose: () => void;
  onUpdated: (c: Club) => void;
  onDeleted: (id: string) => void;
}) {
  const displayName = club.name?.trim() || "Unnamed Club";

  // Edit state
  const [editName, setEditName] = useState(displayName);
  const [editCategory, setEditCategory] = useState(club.category ?? "");
  const [editDesc, setEditDesc] = useState(club.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState(
    club.club_admin_id ?? ""
  );
  const [adminSearch, setAdminSearch] = useState("");

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersErr, setMembersErr] = useState("");
  const [tab, setTab] = useState<"info" | "members">("info");

  // Load members
  useEffect(() => {
    const load = async () => {
      setMembersLoading(true);
      setMembersErr("");
      try {
        const { data: rows, error } = await supabase
          .from("club_members")
          .select("id, user_id, created_at, status")
          .eq("club_id", club.id)
          .eq("status", "approved")
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
  }, [club.id]);

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

  const handleAssignClubAdmin = async () => {
    setAdminSaving(true);
    setSaveErr("");
    setSaveMsg("");

    const previousAdminUserId = club.club_admin_id;
    const nextAdminUserId = selectedAdminUserId || null;

    const { error: clubUpdateError } = await supabase
      .from("clubs")
      .update({ club_admin_id: nextAdminUserId })
      .eq("id", club.id);

    if (clubUpdateError) {
      setSaveErr(clubUpdateError.message);
      setAdminSaving(false);
      return;
    }

    if (nextAdminUserId) {
      await supabase
        .from("profiles")
        .update({ is_club_admin: true })
        .eq("id", nextAdminUserId);
    }

    if (previousAdminUserId && previousAdminUserId !== nextAdminUserId) {
      const { count } = await supabase
        .from("clubs")
        .select("id", { count: "exact", head: true })
        .eq("club_admin_id", previousAdminUserId);

      if ((count ?? 0) === 0) {
        await supabase
          .from("profiles")
          .update({ is_club_admin: false })
          .eq("id", previousAdminUserId);
      }
    }

    setMembers((prev) =>
      prev.map((member) => ({
        ...member,
        profiles: member.profiles
          ? {
              ...member.profiles,
              is_club_admin:
                member.user_id === nextAdminUserId
                  ? true
                  : member.user_id === previousAdminUserId &&
                    previousAdminUserId !== nextAdminUserId
                  ? false
                  : member.profiles.is_club_admin,
            }
          : null,
      }))
    );

    onUpdated({ ...club, club_admin_id: nextAdminUserId });
    setSaveMsg("Club admin updated successfully.");
    setTimeout(() => setSaveMsg(""), 3000);
    setAdminSaving(false);
  };

  const handleRemoveMember = async (member: Member) => {
    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("id", member.id);
    if (!error) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      if (member.user_id === club.club_admin_id) {
        await supabase
          .from("clubs")
          .update({ club_admin_id: null })
          .eq("id", club.id);
        await supabase
          .from("profiles")
          .update({ is_club_admin: false })
          .eq("id", member.user_id);
        setSelectedAdminUserId("");
        onUpdated({ ...club, club_admin_id: null });
      }
    }
  };

  const handleToggleAdmin = async (member: Member) => {
    const isAssignedClubAdmin = club.club_admin_id === member.user_id;
    setSaveErr("");
    setSaveMsg("");

    if (isAssignedClubAdmin) {
      const { error: clubUpdateError } = await supabase
        .from("clubs")
        .update({ club_admin_id: null })
        .eq("id", club.id);

      if (clubUpdateError) {
        setSaveErr(clubUpdateError.message);
        return;
      }

      const { count } = await supabase
        .from("clubs")
        .select("id", { count: "exact", head: true })
        .eq("club_admin_id", member.user_id);

      if ((count ?? 0) === 0) {
        await supabase
          .from("profiles")
          .update({ is_club_admin: false })
          .eq("id", member.user_id);
      }

      setSelectedAdminUserId("");
      onUpdated({ ...club, club_admin_id: null });
      setSaveMsg("Club admin removed.");
      setTimeout(() => setSaveMsg(""), 3000);
      return;
    }

    setSelectedAdminUserId(member.user_id);
    const previousAdminUserId = club.club_admin_id;
    const { error: clubUpdateError } = await supabase
      .from("clubs")
      .update({ club_admin_id: member.user_id })
      .eq("id", club.id);

    if (clubUpdateError) {
      setSaveErr(clubUpdateError.message);
      return;
    }

    await supabase
      .from("profiles")
      .update({ is_club_admin: true })
      .eq("id", member.user_id);

    if (previousAdminUserId && previousAdminUserId !== member.user_id) {
      const { count } = await supabase
        .from("clubs")
        .select("id", { count: "exact", head: true })
        .eq("club_admin_id", previousAdminUserId);

      if ((count ?? 0) === 0) {
        await supabase
          .from("profiles")
          .update({ is_club_admin: false })
          .eq("id", previousAdminUserId);
      }
    }

    onUpdated({ ...club, club_admin_id: member.user_id });
    setSaveMsg("Club admin assigned.");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const handleDeleteClub = async () => {
    setDeleting(true);
    setSaveErr("");
    setSaveMsg("");

    const previousAdminUserId = club.club_admin_id;

    const { error: eventUpdateError } = await supabase
      .from("events")
      .update({ club_id: null, is_club_members_only: false })
      .eq("club_id", club.id);

    if (eventUpdateError) {
      setSaveErr(eventUpdateError.message);
      setDeleting(false);
      return;
    }

    const { error: memberDeleteError } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", club.id);

    if (memberDeleteError) {
      setSaveErr(memberDeleteError.message);
      setDeleting(false);
      return;
    }

    const { error: clubDeleteError } = await supabase
      .from("clubs")
      .delete()
      .eq("id", club.id);

    if (clubDeleteError) {
      setSaveErr(clubDeleteError.message);
      setDeleting(false);
      return;
    }

    if (previousAdminUserId) {
      const { count } = await supabase
        .from("clubs")
        .select("id", { count: "exact", head: true })
        .eq("club_admin_id", previousAdminUserId);

      if ((count ?? 0) === 0) {
        await supabase
          .from("profiles")
          .update({ is_club_admin: false })
          .eq("id", previousAdminUserId);
      }
    }

    onDeleted(club.id);
    setDeleting(false);
    onClose();
  };

  const assignedAdmin = members.find((member) => member.user_id === club.club_admin_id);
  const filteredAdminMembers = members.filter((member) => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return true;

    return [
      member.profiles?.student_id,
      member.profiles?.full_name,
      member.profiles?.email,
      member.user_id,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query));
  });

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
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned Club Admin</label>
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Search by ID, name, or email..."
                  className={`${inputCls} mb-3`}
                />
                {adminSearch.trim() && (
                  <div className="mb-3 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    {filteredAdminMembers.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">No matching members found.</p>
                    ) : (
                      filteredAdminMembers.map((member) => {
                        const label = `${member.profiles?.full_name || member.profiles?.email || member.user_id}${
                          member.profiles?.student_id ? ` (${member.profiles.student_id})` : ""
                        }`;
                        const active = selectedAdminUserId === member.user_id;

                        return (
                          <button
                            key={`search-${member.id}`}
                            type="button"
                            onClick={() => {
                              setSelectedAdminUserId(member.user_id);
                              setAdminSearch(label);
                            }}
                            className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                              active
                                ? "bg-[#eef3ff] text-[#1e3a8a]"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>{label}</span>
                            {active && <span className="text-xs font-semibold">Selected</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
                <select
                  value={selectedAdminUserId}
                  onChange={(e) => setSelectedAdminUserId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">No club admin assigned</option>
                  {filteredAdminMembers.map((member) => (
                    <option key={member.id} value={member.user_id}>
                      {member.profiles?.full_name || member.profiles?.email || member.user_id}
                      {member.profiles?.student_id ? ` (${member.profiles.student_id})` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  {assignedAdmin
                    ? `Current club admin: ${assignedAdmin.profiles?.full_name || assignedAdmin.profiles?.email || "Assigned user"}${assignedAdmin.profiles?.student_id ? ` (${assignedAdmin.profiles.student_id})` : ""}`
                    : "Search and choose one of the club members to manage this club."}
                </p>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-100 pt-2">
                <button onClick={handleSave} disabled={saving} className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60">
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={handleAssignClubAdmin}
                  disabled={adminSaving || membersLoading}
                  className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-60"
                >
                  {adminSaving ? "Assigningâ€¦" : "Save Club Admin"}
                </button>
                <p className="text-xs text-slate-400">Created {fmt(club.created_at)}</p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-700">Delete this club</p>
                    <p className="mt-1 text-xs leading-relaxed text-red-600">
                      This removes the club and its memberships. Events owned by this club will stay available as platform events.
                    </p>
                  </div>
                  {!deleteConfirm ? (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      Delete club
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        disabled={deleting}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteClub}
                        disabled={deleting}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {deleting ? "Deleting..." : "Delete permanently"}
                      </button>
                    </div>
                  )}
                </div>
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
                        const isAssignedClubAdmin = club.club_admin_id === m.user_id;
                        return (
                          <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{m.profiles?.full_name ?? "—"}</p>
                              <p className="text-xs text-slate-400">{m.profiles?.email ?? ""}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.profiles?.student_id ?? "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  isAssignedClubAdmin ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                                }`}>
                                  {isAssignedClubAdmin ? "Club Admin" : "Member"}
                                </span>
                                {isAssignedClubAdmin && (
                                  <span className="rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-xs font-semibold text-[#1e3a8a]">
                                    Assigned
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{fmt(m.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleAdmin(m)}
                                  title={isAssignedClubAdmin ? "Remove club admin" : "Make club admin"}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                    isAssignedClubAdmin
                                      ? "bg-purple-50 text-purple-700 hover:bg-purple-100"
                                      : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                                  }`}
                                >
                                  {isAssignedClubAdmin ? "Remove Admin" : "Make Admin"}
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
  const image = club.logo_url || club.image_url || "";
  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1e3a8a]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
    >
      <div className="h-1 w-full rounded-t-2xl bg-[#1e3a8a]" />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#c7d7fe] bg-[#eef3ff] bg-cover bg-center text-base font-bold text-[#1e3a8a]"
              style={image ? { backgroundImage: `url(${image})` } : undefined}
            >
              {!image && displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
            {club.category && (
              <span className="mb-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {club.category}
              </span>
            )}
            <h3 className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#1e3a8a]">
              {displayName}
            </h3>
            </div>
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
  const [showCreateClub, setShowCreateClub] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      // Fetch clubs
      const { data: clubRows, error: clubErr } = await supabase
        .from("clubs")
        .select("id, name, category, description, logo_url, image_url, created_at, club_admin_id")
        .order("created_at", { ascending: false });

      let clubsForPage: Club[] = (clubRows ?? []) as Club[];
      if (clubErr && /image_url|logo_url|column/i.test(clubErr.message)) {
        const { data: fallbackClubRows, error: fallbackClubErr } = await supabase
          .from("clubs")
          .select("id, name, category, description, created_at, club_admin_id")
          .order("created_at", { ascending: false });

        if (fallbackClubErr) { setError(fallbackClubErr.message); setLoading(false); return; }
        clubsForPage = (fallbackClubRows ?? []).map((club) => ({
          ...club,
          logo_url: null,
          image_url: null,
        })) as Club[];
      } else if (clubErr) {
        setError(clubErr.message);
        setLoading(false);
        return;
      }

      // Fetch member counts via a count query
      const { data: memberRows } = await supabase
        .from("club_members")
        .select("club_id, status")
        .eq("status", "approved");

      const countMap: Record<string, number> = {};
      (memberRows ?? []).forEach((r) => {
        countMap[r.club_id] = (countMap[r.club_id] ?? 0) + 1;
      });

      setClubs(
        clubsForPage.map((c) => ({ ...c, memberCount: countMap[c.id] ?? 0 }))
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
    <div className="min-h-screen px-6 py-8 lg:px-10 2xl:px-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Club Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          View and manage all clubs — edit details, manage members, and assign admin roles.
        </p>
      </div>

      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowCreateClub(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af]"
        >
          <span className="text-base leading-none">+</span>
          Add Club
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          {error.includes("permission") || error.includes("policy") ? (
            <span className="block mt-1 text-xs">Run <code className="font-mono bg-red-100 px-1 rounded">admin-clubs-management.sql</code> in Supabase SQL Editor to grant admin access.</span>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((club) => (
            <ClubCard key={club.id} club={club} onClick={() => setSelected(club)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showCreateClub && (
        <CreateClubModal
          onClose={() => setShowCreateClub(false)}
          onCreated={(created) => {
            setClubs((prev) => [created, ...prev]);
          }}
        />
      )}

      {selected && (
        <ClubModal
          club={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setClubs((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
            setSelected(updated);
          }}
          onDeleted={(deletedId) => {
            setClubs((prev) => prev.filter((club) => club.id !== deletedId));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
