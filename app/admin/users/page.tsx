"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  student_id: string | null;
  major: string | null;
  academic_year: string | null;
  bio: string | null;
  skills: string[] | null;
  interests: string[] | null;
  is_admin: boolean;
  is_club_admin: boolean;
  portal_verified: boolean;
};

type ClubMembershipDetail = {
  club_id: string;
  status: string | null;
  role?: string | null;
  created_at?: string | null;
  clubs?: { id: string; name?: string | null; title?: string | null; category?: string | null } | { id: string; name?: string | null; title?: string | null; category?: string | null }[] | null;
};

type EventRegistrationDetail = {
  event_id: string;
  status: string | null;
  created_at?: string | null;
  events?: {
    id: string;
    title?: string | null;
    category?: string | null;
    event_date?: string | null;
    end_date?: string | null;
    location?: string | null;
  } | {
    id: string;
    title?: string | null;
    category?: string | null;
    event_date?: string | null;
    end_date?: string | null;
    location?: string | null;
  }[] | null;
};

type TeamMembershipDetail = {
  team_id: string;
  status: string | null;
  created_at?: string | null;
  teams?: {
    id: string;
    name?: string | null;
    event?: string | null;
    owner_id?: string | null;
  } | {
    id: string;
    name?: string | null;
    event?: string | null;
    owner_id?: string | null;
  }[] | null;
};

type UserDetails = {
  clubs: ClubMembershipDetail[];
  events: EventRegistrationDetail[];
  teams: TeamMembershipDetail[];
};

type RoleKey = "is_admin" | "is_club_admin" | "portal_verified";

type EditForm = {
  full_name: string;
  email: string;
  student_id: string;
  major: string;
  academic_year: string;
  bio: string;
};

// ─── Small helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10";

// Standardizes field labels inside user management modals.
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </label>
  );
}

// Normalizes Supabase relation values that may come back as one object or an array.
const getOne = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Formats dates for user profiles, memberships, and event history.
const formatDate = (value?: string | null) => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Builds a readable start-to-end date range for event history rows.
const formatEventDateRange = (start?: string | null, end?: string | null) => {
  const startLabel = formatDate(start);
  if (!end || end === start) return startLabel;
  return `${startLabel} - ${formatDate(end)}`;
};

// Renders the correct colored pill for user-related statuses.
const StatusPill = ({ status }: { status?: string | null }) => {
  const value = status || "unknown";
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
      {value}
    </span>
  );
};

// Renders one admin role toggle with a label and helper text.
const RoleToggle = ({
  active,
  label,
  activeClass,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  activeClass: string;
  onClick: () => void;
  disabled: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
      active
        ? `${activeClass} ring-1 ring-inset`
        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
    }`}
  >
    {active ? `✓ ${label}` : label}
  </button>
);

// ─── Edit Modal ───────────────────────────────────────────────────────────────

// Lets admins edit a user's profile fields and platform roles.
function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    full_name: user.full_name ?? "",
    email: user.email ?? "",
    student_id: user.student_id ?? "",
    major: user.major ?? "",
    academic_year: user.academic_year ?? "",
    bio: user.bio ?? "",
  });
  const [roles, setRoles] = useState({
    is_admin: user.is_admin,
    is_club_admin: user.is_club_admin,
    portal_verified: user.portal_verified,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Handles the save action for this screen.
  const handleSave = async () => {
    setSaving(true);
    setError("");
    const payload = {
      full_name: form.full_name || null,
      email: form.email || null,
      student_id: form.student_id || null,
      major: form.major || null,
      academic_year: form.academic_year || null,
      bio: form.bio || null,
      is_admin: roles.is_admin,
      is_club_admin: roles.is_club_admin,
      portal_verified: roles.portal_verified,
    };
    const { error: err } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (err) {
      setError(err.message);
    } else {
      onSaved({
        ...user,
        ...payload,
        full_name: payload.full_name ?? "Unknown",
        email: payload.email,
        student_id: payload.student_id,
        major: payload.major,
        academic_year: payload.academic_year,
        bio: payload.bio,
      });
      onClose();
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit User</h2>
            <p className="text-xs text-slate-400">{user.email ?? user.id}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Full name</Label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Full name"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Email</Label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Student ID</Label>
              <input
                type="text"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                placeholder="e.g. 1234567"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Major</Label>
              <input
                type="text"
                value={form.major}
                onChange={(e) => setForm({ ...form, major: e.target.value })}
                placeholder="e.g. Computer Science"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Academic year</Label>
              <input
                type="text"
                value={form.academic_year}
                onChange={(e) =>
                  setForm({ ...form, academic_year: e.target.value })
                }
                placeholder="e.g. 3rd Year"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Bio</Label>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Short bio…"
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Roles */}
          <div className="mt-5">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              <RoleToggle
                active={roles.is_admin}
                label="Admin"
                activeClass="bg-amber-100 text-amber-800 ring-amber-200"
                onClick={() => setRoles((r) => ({ ...r, is_admin: !r.is_admin }))}
                disabled={false}
              />
              <RoleToggle
                active={roles.is_club_admin}
                label="Club Admin"
                activeClass="bg-purple-100 text-purple-800 ring-purple-200"
                onClick={() =>
                  setRoles((r) => ({ ...r, is_club_admin: !r.is_club_admin }))
                }
                disabled={false}
              />
              <RoleToggle
                active={roles.portal_verified}
                label="Verified"
                activeClass="bg-green-100 text-green-700 ring-green-200"
                onClick={() =>
                  setRoles((r) => ({ ...r, portal_verified: !r.portal_verified }))
                }
                disabled={false}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shows all useful data about a user, including clubs and event history.
function ViewUserModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<UserDetails>({
    clubs: [],
    events: [],
    teams: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Loads details data from Supabase for this screen.
    const loadDetails = async () => {
      setLoading(true);
      setError("");

      // Load related records together so the admin can inspect a user's full
      // participation history without jumping between separate admin pages.
      const [clubResult, eventResult, teamResult] = await Promise.all([
        supabase
          .from("club_members")
          .select("club_id, status, role, created_at, clubs(id, name, title, category)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("event_registrations")
          .select(
            "event_id, status, created_at, events(id, title, category, event_date, end_date, location)"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("team_members")
          .select("team_id, status, created_at, teams(id, name, event, owner_id)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const messages = [
        clubResult.error?.message,
        eventResult.error?.message,
        teamResult.error?.message,
      ].filter(Boolean);

      setDetails({
        clubs: (clubResult.data ?? []) as ClubMembershipDetail[],
        events: (eventResult.data ?? []) as EventRegistrationDetail[],
        teams: (teamResult.data ?? []) as TeamMembershipDetail[],
      });

      if (messages.length > 0) setError(messages.join(" "));
      setLoading(false);
    };

    void loadDetails();
  }, [user.id]);

  const profileFields = [
    ["Email", user.email ?? "Not added"],
    ["Phone", user.phone_number ?? "Not added"],
    ["Student ID", user.student_id ?? "Not added"],
    ["Major", user.major ?? "Not added"],
    ["Academic year", user.academic_year ?? "Not added"],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">
              User details
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {user.full_name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.is_admin && <StatusPill status="admin" />}
              {user.is_club_admin && <StatusPill status="club admin" />}
              {user.portal_verified && <StatusPill status="verified" />}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Some related records could not be loaded: {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900">Profile</h3>
              <div className="mt-4 grid gap-3">
                {profileFields.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Bio
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {user.bio || "No bio added."}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Skills
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {user.skills?.length ? (
                      user.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Not added</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Interests
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {user.interests?.length ? (
                      user.interests.map((interest) => (
                        <span key={interest} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {interest}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Not added</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:col-span-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clubs</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{details.clubs.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Events</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{details.events.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teams</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{details.teams.length}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">Joined clubs</h3>
                </div>
                <div className="max-h-56 overflow-y-auto p-5">
                  {loading ? (
                    <p className="text-sm text-slate-400">Loading clubs...</p>
                  ) : details.clubs.length ? (
                    <div className="space-y-3">
                      {details.clubs.map((membership) => {
                        const club = getOne(membership.clubs);
                        return (
                          <div key={`${membership.club_id}-${membership.created_at ?? ""}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {club?.name || club?.title || membership.club_id}
                              </p>
                              <p className="text-xs text-slate-500">
                                {club?.category || "No category"} - Joined {formatDate(membership.created_at)}
                              </p>
                            </div>
                            <StatusPill status={membership.status} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No club memberships.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">Event history</h3>
                </div>
                <div className="max-h-64 overflow-y-auto p-5">
                  {loading ? (
                    <p className="text-sm text-slate-400">Loading events...</p>
                  ) : details.events.length ? (
                    <div className="space-y-3">
                      {details.events.map((registration) => {
                        const event = getOne(registration.events);
                        return (
                          <div key={`${registration.event_id}-${registration.created_at ?? ""}`} className="rounded-xl bg-slate-50 px-4 py-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {event?.title || registration.event_id}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {event?.category || "No category"} - {formatEventDateRange(event?.event_date, event?.end_date)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {event?.location || "No location"} - Registered {formatDate(registration.created_at)}
                                </p>
                              </div>
                              <StatusPill status={registration.status} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No event registrations.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-900">Teams</h3>
                </div>
                <div className="max-h-56 overflow-y-auto p-5">
                  {loading ? (
                    <p className="text-sm text-slate-400">Loading teams...</p>
                  ) : details.teams.length ? (
                    <div className="space-y-3">
                      {details.teams.map((membership) => {
                        const team = getOne(membership.teams);
                        return (
                          <div key={`${membership.team_id}-${membership.created_at ?? ""}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {team?.name || membership.team_id}
                              </p>
                              <p className="text-xs text-slate-500">
                                {team?.event || "No event"} - {team?.owner_id === user.id ? "Owner" : "Member"}
                              </p>
                            </div>
                            <StatusPill status={membership.status} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No team history.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Main user management page for searching, viewing, editing, and deleting users.
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);

  // Loads users data from Supabase for this screen.
  const loadUsers = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone_number, student_id, major, academic_year, bio, skills, interests, is_admin, is_club_admin, portal_verified"
      )
      .order("full_name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setUsers(
        (data ?? []).map((u) => ({
          ...u,
          full_name: u.full_name ?? "Unknown",
          phone_number: u.phone_number ?? null,
          bio: u.bio ?? null,
          skills: u.skills ?? null,
          interests: u.interests ?? null,
          is_admin: u.is_admin ?? false,
          is_club_admin: u.is_club_admin ?? false,
          portal_verified: u.portal_verified ?? false,
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(loadUsers);
  }, []);

  // Handles the role toggle action for this screen.
  const handleRoleToggle = async (
    userId: string,
    role: RoleKey,
    currentValue: boolean
  ) => {
    const key = `${userId}-${role}`;
    setActionLoading(key);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ [role]: !currentValue })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, [role]: !currentValue } : u
        )
      );
      setSuccess("Role updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    }

    setActionLoading(null);
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(term) ||
        u.student_id?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.major?.toLowerCase().includes(term)
    );
  }, [users, search]);

  // Defines the initials helper used by this screen.
  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="px-6 py-8 lg:px-10 2xl:px-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage user roles, permissions, and profile information.
        </p>
      </div>

      {/* Alerts */}
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

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 shadow-sm">
        <span className="font-semibold text-slate-700">Role badges:</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
          ✓ Admin
        </span>
        <span className="rounded-full bg-purple-100 px-2.5 py-1 font-semibold text-purple-800 ring-1 ring-inset ring-purple-200">
          ✓ Club Admin
        </span>
        <span className="rounded-full bg-green-100 px-2.5 py-1 font-semibold text-green-700 ring-1 ring-inset ring-green-200">
          ✓ Verified
        </span>
        <span className="text-slate-400">
          — Click any badge to toggle · Click ✏️ to edit full profile
        </span>
      </div>

      {/* Search & count */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by name, student ID, email, or major..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10 sm:w-80"
        />
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* User Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            No users match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Student ID</th>
                  <th className="px-6 py-3">Major</th>
                  <th className="px-6 py-3">Year</th>
                  <th className="px-6 py-3">Roles</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    {/* User info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-xs font-bold text-[#1e3a8a]">
                          {initials(user.full_name)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {user.full_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {user.email ?? "No email"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {user.student_id ?? "—"}
                    </td>

                    <td className="max-w-[160px] px-6 py-4 text-slate-500">
                      <span className="block truncate">
                        {user.major ?? "—"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {user.academic_year ?? "—"}
                    </td>

                    {/* Role toggles */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <RoleToggle
                          active={user.is_admin}
                          label="Admin"
                          activeClass="bg-amber-100 text-amber-800 ring-amber-200"
                          onClick={() =>
                            handleRoleToggle(user.id, "is_admin", user.is_admin)
                          }
                          disabled={actionLoading === `${user.id}-is_admin`}
                        />
                        <RoleToggle
                          active={user.is_club_admin}
                          label="Club Admin"
                          activeClass="bg-purple-100 text-purple-800 ring-purple-200"
                          onClick={() =>
                            handleRoleToggle(
                              user.id,
                              "is_club_admin",
                              user.is_club_admin
                            )
                          }
                          disabled={actionLoading === `${user.id}-is_club_admin`}
                        />
                        <RoleToggle
                          active={user.portal_verified}
                          label="Verified"
                          activeClass="bg-green-100 text-green-700 ring-green-200"
                          onClick={() =>
                            handleRoleToggle(
                              user.id,
                              "portal_verified",
                              user.portal_verified
                            )
                          }
                          disabled={
                            actionLoading === `${user.id}-portal_verified`
                          }
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewUser(user)}
                          title="View user details"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditUser(user)}
                          title="Edit user profile"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-[#1e3a8a]"
                        >
                          <svg
                            width="15"
                            height="15"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(updated) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === updated.id ? updated : u))
            );
            setSuccess("User profile updated.");
            setTimeout(() => setSuccess(""), 3000);
          }}
        />
      )}

      {viewUser && (
        <ViewUserModal user={viewUser} onClose={() => setViewUser(null)} />
      )}
    </div>
  );
}
