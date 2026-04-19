"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type AdminUser = {
  id: string;
  full_name: string;
  email: string | null;
  student_id: string | null;
  major: string | null;
  academic_year: string | null;
  is_admin: boolean;
  is_club_admin: boolean;
  portal_verified: boolean;
};

type RoleKey = "is_admin" | "is_club_admin" | "portal_verified";

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, student_id, major, academic_year, is_admin, is_club_admin, portal_verified"
      )
      .order("full_name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setUsers(
        (data ?? []).map((u) => ({
          ...u,
          full_name: u.full_name ?? "Unknown",
          is_admin: u.is_admin ?? false,
          is_club_admin: u.is_club_admin ?? false,
          portal_verified: u.portal_verified ?? false,
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Toggle a boolean role field on a user's profile
  const handleRoleToggle = async (userId: string, role: RoleKey, currentValue: boolean) => {
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
      // Optimistic update — flip the value locally without re-fetching
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, [role]: !currentValue } : u
        )
      );
      setSuccess(`Role updated successfully.`);
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

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage user roles and permissions across the platform.
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
          — Click any badge to toggle the role on/off
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
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    {/* User info with avatar initials */}
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
                          disabled={
                            actionLoading === `${user.id}-is_club_admin`
                          }
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
