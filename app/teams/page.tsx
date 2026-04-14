"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email?: string | null;
  student_id?: string | null;
  major?: string | null;
  academic_year?: string | null;
};

type Team = {
  id: string;
  name: string;
  event: string | null;
  description: string | null;
  needed_skills: string | null;
  max_members: number | null;
  owner_id: string | null;
  is_open_to_members?: boolean | null;
  created_at?: string | null;
};

type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected" | "invited";
  profiles?: Profile | Profile[] | null;
};

type TeamWithMembers = Team & {
  members: TeamMember[];
};

const TEAM_MEMBER_LIMIT = 6;

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10";

const getMemberProfile = (member: TeamMember) =>
  Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;

export default function TeamsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingTeamId, setEditingTeamId] = useState("");
  const [addMemberInputs, setAddMemberInputs] = useState<Record<string, string>>({});
  const [teamEditValues, setTeamEditValues] = useState<
    Record<
      string,
      {
        name: string;
        description: string;
        neededSkills: string;
        maxMembers: string;
        isOpenToMembers: boolean;
      }
    >
  >({});

  const loadTeams = async () => {
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

      const [{ data: profileData, error: profileError }, { data: teamData, error: teamError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, student_id, major, academic_year")
            .eq("id", user.id)
            .single(),
          supabase.from("teams").select("*").order("created_at", { ascending: false }),
        ]);

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (teamError) {
        setError(teamError.message);
        return;
      }

      const loadedTeams = (teamData || []) as Team[];
      setProfile(profileData as Profile);

      if (loadedTeams.length === 0) {
        setTeams([]);
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from("team_members")
        .select(
          "id, team_id, user_id, status, profiles(id, full_name, email, student_id, major, academic_year)"
        )
        .in(
          "team_id",
          loadedTeams.map((team) => team.id)
        );

      if (memberError) {
        setError(memberError.message);
        return;
      }

      const members = (memberData || []) as TeamMember[];
      const teamsWithMembers = loadedTeams.map((team) => ({
        ...team,
        members: members.filter((member) => member.team_id === team.id),
      }));

      setTeams(teamsWithMembers);
    } catch (err) {
      console.error("TEAMS LOAD ERROR:", err);
      setError("Something went wrong while loading teams.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const ownedTeams = useMemo(
    () => teams.filter((team) => team.owner_id === profile?.id),
    [teams, profile?.id]
  );

  const memberTeams = useMemo(
    () =>
      teams.filter(
        (team) =>
          team.owner_id !== profile?.id &&
          team.members.some(
            (member) => member.user_id === profile?.id && member.status !== "rejected"
          )
      ),
    [teams, profile?.id]
  );

  const availableTeams = useMemo(() => {
    if (!profile) return [];

    const activeEventTitles = new Set(
      teams
        .filter((team) =>
          team.members.some(
            (member) => member.user_id === profile.id && member.status !== "rejected"
          )
        )
        .map((team) => (team.event || "").toLowerCase())
    );

    return teams.filter((team) => {
      const approvedCount = team.members.filter(
        (member) => member.status === "approved"
      ).length;
      const eventKey = (team.event || "").toLowerCase();

      return (
        team.owner_id !== profile.id &&
        team.is_open_to_members !== false &&
        approvedCount < TEAM_MEMBER_LIMIT &&
        !activeEventTitles.has(eventKey)
      );
    });
  }, [teams, profile]);

  const closeTeamAndRejectWaiting = async (teamId: string) => {
    const { error: closeError } = await supabase
      .from("teams")
      .update({ is_open_to_members: false })
      .eq("id", teamId);

    if (closeError) {
      setError(closeError.message);
      return false;
    }

    const { error: rejectError } = await supabase
      .from("team_members")
      .update({ status: "rejected" })
      .eq("team_id", teamId)
      .in("status", ["pending", "invited"]);

    if (rejectError) {
      setError(rejectError.message);
      return false;
    }

    return true;
  };

  const startEditingTeam = (team: TeamWithMembers) => {
    setEditingTeamId(team.id);
    setTeamEditValues((current) => ({
      ...current,
      [team.id]: {
        name: team.name,
        description: team.description || "",
        neededSkills: team.needed_skills || "",
        maxMembers: String(team.max_members ?? TEAM_MEMBER_LIMIT),
        isOpenToMembers: team.is_open_to_members !== false,
      },
    }));
    setError("");
    setSuccess("");
  };

  const handleSaveTeam = async (team: TeamWithMembers) => {
    const values = teamEditValues[team.id];
    const approvedCount = team.members.filter(
      (member) => member.status === "approved"
    ).length;
    const maxMembers = Math.min(
      Math.max(Number(values?.maxMembers) || TEAM_MEMBER_LIMIT, 2),
      TEAM_MEMBER_LIMIT
    );
    const name = values?.name.trim() || "";
    const description = values?.description.trim() || "";
    const neededSkills = values?.isOpenToMembers ? values.neededSkills.trim() : "";

    if (!name || !description) {
      setError("Team name and description are required.");
      return;
    }

    if (maxMembers < approvedCount) {
      setError(`Max members cannot be less than ${approvedCount}.`);
      return;
    }

    if (values?.isOpenToMembers && !neededSkills) {
      setError("Tell students what kind of member your team needs.");
      return;
    }

    setSavingId(`edit-${team.id}`);
    setError("");
    setSuccess("");

    try {
      const shouldClose = approvedCount >= TEAM_MEMBER_LIMIT;
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          name,
          description,
          needed_skills: neededSkills || null,
          max_members: maxMembers,
          is_open_to_members: shouldClose ? false : values?.isOpenToMembers ?? true,
        })
        .eq("id", team.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (shouldClose) {
        await closeTeamAndRejectWaiting(team.id);
      }

      setSuccess("Team updated.");
      setEditingTeamId("");
      await loadTeams();
    } finally {
      setSavingId("");
    }
  };

  const ensureStudentsCanJoinEvent = async (
    team: TeamWithMembers,
    students: Profile[]
  ) => {
    const eventTeams = teams.filter(
      (item) => (item.event || "").toLowerCase() === (team.event || "").toLowerCase()
    );

    const takenMembership = eventTeams
      .flatMap((item) => item.members)
      .find(
        (member) =>
          member.status !== "rejected" &&
          students.some((student) => student.id === member.user_id)
      );

    if (!takenMembership) return true;

    const takenProfile = students.find((student) => student.id === takenMembership.user_id);
    setError(
      `The member with Student ID ${
        takenProfile?.student_id || "unknown"
      } is already in a team for this event.`
    );
    return false;
  };

  const handleAddMembersById = async (team: TeamWithMembers) => {
    if (!profile) return;

    const studentIds = Array.from(
      new Set((addMemberInputs[team.id] || "").match(/\d{8}/g) ?? [])
    ).filter((studentId) => studentId !== profile.student_id);

    if (studentIds.length === 0) {
      setError("Enter at least one valid 8-digit Student ID.");
      return;
    }

    const activeCount = team.members.filter((member) => member.status !== "rejected").length;
    const slots = TEAM_MEMBER_LIMIT - activeCount;

    if (studentIds.length > slots) {
      setError(`You can invite up to ${slots} member(s).`);
      return;
    }

    setSavingId(`add-${team.id}`);
    setError("");
    setSuccess("");

    try {
      const { data: matchedProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, student_id, major, academic_year")
        .in("student_id", studentIds);

      if (profileError) {
        setError(profileError.message);
        return;
      }

      const invitedProfiles = (matchedProfiles || []) as Profile[];
      const foundIds = new Set(invitedProfiles.map((item) => item.student_id));
      const missingIds = studentIds.filter((studentId) => !foundIds.has(studentId));

      if (missingIds.length > 0) {
        setError(`No profiles found for Student ID: ${missingIds.join(", ")}.`);
        return;
      }

      const canJoin = await ensureStudentsCanJoinEvent(team, invitedProfiles);
      if (!canJoin) return;

      const { error: insertError } = await supabase.from("team_members").upsert(
        invitedProfiles.map((member) => ({
          team_id: team.id,
          user_id: member.id,
          status: "invited",
        })),
        { onConflict: "team_id,user_id" }
      );

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setAddMemberInputs((current) => ({ ...current, [team.id]: "" }));
      setSuccess("Invites sent.");
      await loadTeams();
    } finally {
      setSavingId("");
    }
  };

  const handleMemberStatus = async (
    team: TeamWithMembers,
    member: TeamMember,
    status: "approved" | "rejected"
  ) => {
    setSavingId(member.id);
    setError("");
    setSuccess("");

    try {
      if (status === "approved") {
        const approvedCount = team.members.filter(
          (teamMember) => teamMember.status === "approved"
        ).length;

        if (approvedCount >= TEAM_MEMBER_LIMIT) {
          await closeTeamAndRejectWaiting(team.id);
          setSuccess("Team is already full. Waiting requests were rejected.");
          await loadTeams();
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("team_members")
        .update({ status })
        .eq("id", member.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (status === "approved") {
        const approvedAfter = team.members.filter(
          (teamMember) => teamMember.status === "approved"
        ).length + 1;

        if (approvedAfter >= TEAM_MEMBER_LIMIT) {
          await closeTeamAndRejectWaiting(team.id);
        }
      }

      setSuccess(status === "approved" ? "Member approved." : "Member rejected.");
      await loadTeams();
    } finally {
      setSavingId("");
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (member.user_id === profile?.id) {
      setError("You cannot remove yourself as the team owner.");
      return;
    }

    setSavingId(`remove-${member.id}`);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("team_members")
        .delete()
        .eq("id", member.id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setSuccess("Member removed.");
      await loadTeams();
    } finally {
      setSavingId("");
    }
  };

  const handleRequestJoin = async (team: TeamWithMembers) => {
    if (!profile) return;

    setSavingId(`request-${team.id}`);
    setError("");
    setSuccess("");

    try {
      const canJoin = await ensureStudentsCanJoinEvent(team, [profile]);
      if (!canJoin) return;

      const { error: requestError } = await supabase.from("team_members").upsert(
        {
          team_id: team.id,
          user_id: profile.id,
          status: "pending",
        },
        { onConflict: "team_id,user_id" }
      );

      if (requestError) {
        setError(requestError.message);
        return;
      }

      setSuccess(`Request sent to ${team.name}.`);
      await loadTeams();
    } finally {
      setSavingId("");
    }
  };

  const handleRespondToInvite = async (
    team: TeamWithMembers,
    status: "approved" | "rejected"
  ) => {
    const membership = team.members.find((member) => member.user_id === profile?.id);
    if (!membership) return;

    await handleMemberStatus(team, membership, status);
  };

  const handleCancelRequest = async (team: TeamWithMembers) => {
    const membership = team.members.find((member) => member.user_id === profile?.id);
    if (!membership) return;

    setSavingId(`cancel-${membership.id}`);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("team_members")
        .delete()
        .eq("id", membership.id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setSuccess("Request cancelled.");
      await loadTeams();
    } finally {
      setSavingId("");
    }
  };

  const renderMemberCard = (
    team: TeamWithMembers,
    member: TeamMember,
    options: { ownerControls?: boolean; applicantControls?: boolean } = {}
  ) => {
    const memberProfile = getMemberProfile(member);

    return (
      <div key={member.id} className="rounded-lg border border-gray-200 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {memberProfile?.full_name || "Student"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {memberProfile?.student_id || "No Student ID"} -{" "}
              {memberProfile?.major || "Major not added"}
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {member.status}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {memberProfile?.id !== profile?.id && (
              <Link
                href={`/profile/${memberProfile?.id}`}
                className="rounded-lg border border-[#1e3a8a] px-3 py-2 text-xs font-semibold text-[#1e3a8a] hover:bg-[#eef3ff]"
              >
                View profile
              </Link>
            )}

            {options.applicantControls && (
              <>
                <button
                  type="button"
                  onClick={() => handleMemberStatus(team, member, "approved")}
                  disabled={savingId === member.id}
                  className="rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleMemberStatus(team, member, "rejected")}
                  disabled={savingId === member.id}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </>
            )}

            {options.ownerControls && member.user_id !== profile?.id && (
              <button
                type="button"
                onClick={() => handleRemoveMember(member)}
                disabled={savingId === `remove-${member.id}`}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTeamCard = (
    team: TeamWithMembers,
    mode: "owner" | "member" | "available"
  ) => {
    const approvedMembers = team.members.filter((member) => member.status === "approved");
    const pendingMembers = team.members.filter((member) => member.status === "pending");
    const invitedMembers = team.members.filter((member) => member.status === "invited");
    const currentMembership = team.members.find((member) => member.user_id === profile?.id);
    const isEditing = editingTeamId === team.id;
    const isOwner = mode === "owner";
    const editValues = teamEditValues[team.id] || {
      name: team.name,
      description: team.description || "",
      neededSkills: team.needed_skills || "",
      maxMembers: String(team.max_members ?? TEAM_MEMBER_LIMIT),
      isOpenToMembers: team.is_open_to_members !== false,
    };

    return (
      <article key={team.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            {isEditing ? (
              <input
                value={editValues.name}
                onChange={(e) =>
                  setTeamEditValues((current) => ({
                    ...current,
                    [team.id]: { ...editValues, name: e.target.value },
                  }))
                }
                className={inputClass}
              />
            ) : (
              <h2 className="text-xl font-bold text-[#1e3a8a]">{team.name}</h2>
            )}
            <p className="mt-1 text-sm text-gray-500">{team.event || "Event not set"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e8eefc] px-3 py-1 text-xs font-semibold text-[#1e3a8a]">
              {approvedMembers.length} / {team.max_members ?? TEAM_MEMBER_LIMIT} members
            </span>
            {currentMembership?.status === "pending" && (
              <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                Pending
              </span>
            )}
            {currentMembership?.status === "invited" && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Invited
              </span>
            )}
            {team.is_open_to_members === false && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                Closed
              </span>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="mt-4 space-y-3">
            <textarea
              value={editValues.description}
              onChange={(e) =>
                setTeamEditValues((current) => ({
                  ...current,
                  [team.id]: { ...editValues, description: e.target.value },
                }))
              }
              rows={3}
              placeholder="Team description"
              className={inputClass}
            />
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <textarea
                value={editValues.neededSkills}
                onChange={(e) =>
                  setTeamEditValues((current) => ({
                    ...current,
                    [team.id]: { ...editValues, neededSkills: e.target.value },
                  }))
                }
                rows={3}
                placeholder="What do you need in new members?"
                disabled={!editValues.isOpenToMembers}
                className={inputClass}
              />
              <input
                type="number"
                min={Math.max(approvedMembers.length, 2)}
                max={TEAM_MEMBER_LIMIT}
                value={editValues.maxMembers}
                onChange={(e) =>
                  setTeamEditValues((current) => ({
                    ...current,
                    [team.id]: { ...editValues, maxMembers: e.target.value },
                  }))
                }
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={editValues.isOpenToMembers}
                onChange={(e) =>
                  setTeamEditValues((current) => ({
                    ...current,
                    [team.id]: {
                      ...editValues,
                      isOpenToMembers: e.target.checked,
                    },
                  }))
                }
                className="h-4 w-4 accent-[#1e3a8a]"
              />
              Show this team to students looking for teams
            </label>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-gray-700">
              {team.description || "No description added."}
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-gray-400">
                What the team needs
              </p>
              <p className="mt-1 text-sm font-medium text-gray-800">
                {team.needed_skills || "No more members needed."}
              </p>
            </div>
          </>
        )}

        {isOwner && (
          <div className="mt-5 flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveTeam(team)}
                  disabled={savingId === `edit-${team.id}`}
                  className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTeamId("")}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => startEditingTeam(team)}
                className="rounded-lg border border-[#1e3a8a] px-4 py-2 text-sm font-semibold text-[#1e3a8a] hover:bg-[#eef3ff]"
              >
                Edit team
              </button>
            )}
          </div>
        )}

        {mode === "available" && (
          <button
            type="button"
            onClick={() => handleRequestJoin(team)}
            disabled={savingId === `request-${team.id}`}
            className="mt-5 rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Request to join
          </button>
        )}

        {mode === "member" && currentMembership?.status === "pending" && (
          <button
            type="button"
            onClick={() => handleCancelRequest(team)}
            disabled={savingId === `cancel-${currentMembership.id}`}
            className="mt-5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Cancel request
          </button>
        )}

        {mode === "member" && currentMembership?.status === "invited" && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleRespondToInvite(team, "approved")}
              disabled={savingId === currentMembership.id}
              className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Accept invite
            </button>
            <button
              type="button"
              onClick={() => handleRespondToInvite(team, "rejected")}
              disabled={savingId === currentMembership.id}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Reject invite
            </button>
          </div>
        )}

        {(isOwner || approvedMembers.length > 0) && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-900">Members</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {approvedMembers.map((member) =>
                renderMemberCard(team, member, {
                  ownerControls: isOwner && isEditing,
                })
              )}
            </div>
          </div>
        )}

        {isOwner && invitedMembers.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-900">Invited members</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {invitedMembers.map((member) => renderMemberCard(team, member))}
            </div>
          </div>
        )}

        {isOwner && pendingMembers.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-900">Join requests</p>
            <div className="mt-3 space-y-3">
              {pendingMembers.map((member) =>
                renderMemberCard(team, member, { applicantControls: true })
              )}
            </div>
          </div>
        )}

        {isOwner && isEditing && team.is_open_to_members !== false && (
          <div className="mt-6 rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">Invite by Student ID</p>
            <textarea
              value={addMemberInputs[team.id] || ""}
              onChange={(e) =>
                setAddMemberInputs((current) => ({
                  ...current,
                  [team.id]: e.target.value,
                }))
              }
              rows={3}
              placeholder="e.g. 20210083, 20210049"
              className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
            />
            <button
              type="button"
              onClick={() => handleAddMembersById(team)}
              disabled={savingId === `add-${team.id}`}
              className="mt-3 rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Send invites
            </button>
          </div>
        )}
      </article>
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f3f5f9]">
        <AppNavbar />
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            Loading teams...
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f9]">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-[#1e3a8a]">Collaboration</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Teams</h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage your teams, respond to invites, and find open teams for events.
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">My Teams</h2>
            <div className="mt-4 space-y-5">
              {ownedTeams.length > 0 ? (
                ownedTeams.map((team) => renderTeamCard(team, "owner"))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
                  You do not own any teams yet.
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">Teams I&apos;m In</h2>
            <div className="mt-4 space-y-5">
              {memberTeams.length > 0 ? (
                memberTeams.map((team) => renderTeamCard(team, "member"))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
                  You are not in any teams yet.
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">Available Teams</h2>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {availableTeams.length > 0 ? (
                availableTeams.map((team) => renderTeamCard(team, "available"))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 lg:col-span-2">
                  No available teams right now.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
