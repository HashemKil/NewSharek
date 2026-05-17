"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "../../components/AppNavbar";
import { mergeJoinedClubs } from "../../lib/clubMembership";
import { supabase } from "../../lib/supabase";
import { formatTagLabel } from "../../lib/tagLabels";

type Profile = {
  id: string;
  full_name: string;
  email?: string;
  phone_number?: string;
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

type Team = {
  id: string;
  name: string;
  event: string | null;
  description: string | null;
  needed_skills: string | null;
  max_members: number | null;
  owner_id: string | null;
  is_open_to_members?: boolean | null;
};

type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected" | "invited";
  profiles?: Profile | Profile[] | null;
};

type OwnedTeam = Team & {
  members: TeamMember[];
};

type TeamMembership = TeamMember & {
  teams?: Team | Team[] | null;
};

type MemberTeam = Team & {
  membershipId: string;
  membershipStatus: "pending" | "approved" | "rejected" | "invited";
};

type EventRef = {
  id: string;
  title?: string | null;
};

type EventRegistrationRow = {
  event_id: string;
};

type Club = {
  id: string;
  name?: string | null;
  title?: string | null;
  category?: string | null;
};

type ClubMembership = {
  club_id: string;
  clubs?: Club | Club[] | null;
};

type ManagedClub = {
  id: string;
  name?: string | null;
  title?: string | null;
};

// Keeps profile phone numbers numeric while allowing one leading plus sign.
const formatPhoneNumber = (value: string) => {
  const hasLeadingPlus = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);
  return hasLeadingPlus ? `+${digits}` : digits;
};

// Team capacity is capped here because profile-owned team management, invites,
// and pending applications all need to agree on the same limit.
const TEAM_MEMBER_LIMIT = 6;

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

// Picks the best readable club name for profile membership lists.
const getClubName = (club: Club) =>
  club.name?.trim() || club.title?.trim() || "Untitled club";

// Extracts the club object from a club membership relation.
const getClubFromMembership = (membership: ClubMembership) =>
  Array.isArray(membership.clubs) ? membership.clubs[0] : membership.clubs;

// Displays and edits the signed-in user's profile, activity, and memberships.
export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [studentIdState, setStudentIdState] = useState("");
  const [majorState, setMajorState] = useState("");

  const [year, setYear] = useState("");
  const [bio, setBio] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [ownedTeams, setOwnedTeams] = useState<OwnedTeam[]>([]);
  const [memberTeams, setMemberTeams] = useState<MemberTeam[]>([]);
  const [eventRefs, setEventRefs] = useState<EventRef[]>([]);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistrationRow[]>([]);
  const [registeredEventDetails, setRegisteredEventDetails] = useState<{ id: string; title: string | null; category: string | null; event_date: string | null; }[]>([]);
  const [joinedClubs, setJoinedClubs] = useState<Club[]>([]);
  const [managedClub, setManagedClub] = useState<ManagedClub | null>(null);
  const [teamActionId, setTeamActionId] = useState("");
  const [addMemberInputs, setAddMemberInputs] = useState<Record<string, string>>({});
  const [editingTeamId, setEditingTeamId] = useState("");
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

  // Loads owned teams data from Supabase for this screen.
  const loadOwnedTeams = async (userId: string) => {
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (teamsError) {
      console.warn("Could not load owned teams:", teamsError.message);
      setOwnedTeams([]);
      return;
    }

    const teams = (teamsData || []) as Team[];

    if (teams.length === 0) {
      setOwnedTeams([]);
      return;
    }

    const { data: membersData, error: membersError } = await supabase
      .from("team_members")
      .select(
        "id, team_id, user_id, status, profiles(id, full_name, email, student_id, major, academic_year)"
      )
      .in(
        "team_id",
        teams.map((team) => team.id)
      );

    if (membersError) {
      console.warn("Could not load team members:", membersError.message);
    }

    const members = (membersData || []) as TeamMember[];
    const nextOwnedTeams = teams.map((team) => ({
      ...team,
      members: members.filter((member) => member.team_id === team.id),
    }));

    const fullTeams = nextOwnedTeams.filter((team) => {
      const approvedCount = team.members.filter(
        (member) => member.status === "approved"
      ).length;
      const hasWaiting = team.members.some(
        (member) => member.status === "pending" || member.status === "invited"
      );
      return approvedCount >= TEAM_MEMBER_LIMIT && (team.is_open_to_members !== false || hasWaiting);
    });

    const fullTeamIds = new Set(fullTeams.map((team) => team.id));
    const displayedTeams = nextOwnedTeams.map((team) => {
      if (!fullTeamIds.has(team.id)) return team;

      return {
        ...team,
        is_open_to_members: false,
        members: team.members.map((member) =>
            member.status === "pending" || member.status === "invited"
              ? { ...member, status: "rejected" as const }
              : member
        ),
      };
    });

    setOwnedTeams(displayedTeams);

    if (fullTeams.length > 0) {
      Promise.all(
        fullTeams.map(async (team) => {
          await supabase
            .from("teams")
            .update({ is_open_to_members: false })
            .eq("id", team.id);

          await supabase
            .from("team_members")
            .update({ status: "rejected" })
            .eq("team_id", team.id)
            .in("status", ["pending", "invited"]);
        })
      ).catch((err) => {
        console.warn("Could not close full teams:", err);
      });
    }
  };

  // Owned teams and joined teams are loaded separately because the available
  // actions are different for owners, invited users, and members.
  const loadMemberTeams = async (userId: string) => {
    const { data, error: membershipsError } = await supabase
      .from("team_members")
      .select("id, team_id, user_id, status, teams(*)")
      .eq("user_id", userId)
      .neq("status", "rejected");

    if (membershipsError) {
      console.warn("Could not load team memberships:", membershipsError.message);
      setMemberTeams([]);
      return;
    }

    const memberships = (data || []) as TeamMembership[];
    const teams = memberships
      .map((membership) => {
        const team = Array.isArray(membership.teams)
          ? membership.teams[0]
          : membership.teams;

        if (!team || team.owner_id === userId) return null;

        return {
          ...team,
          membershipId: membership.id,
          membershipStatus: membership.status,
        };
      })
      .filter(Boolean) as MemberTeam[];

    setMemberTeams(teams);
  };

  // Loads profile activity data from Supabase for this screen.
  const loadProfileActivity = async (userId: string) => {
    const [
      eventRefsResult,
      eventRegistrationsResult,
      clubMembershipsResult,
      managedClubResult,
    ] =
      await Promise.all([
        supabase.from("events").select("id, title"),
        supabase
          .from("event_registrations")
          .select("event_id")
          .eq("user_id", userId),
        supabase
          .from("club_members")
          .select("club_id, clubs(id, name, title, category)")
          .eq("user_id", userId),
        supabase
          .from("clubs")
          .select("id, name, title")
          .eq("club_admin_id", userId)
          .limit(1)
          .maybeSingle(),
      ]);

    // Fetch enriched event details for history popup
    if (!eventRegistrationsResult.error && (eventRegistrationsResult.data ?? []).length > 0) {
      const eventIds = (eventRegistrationsResult.data ?? []).map((r) => r.event_id);
      const { data: eventDetailsData } = await supabase
        .from("events")
        .select("id, title, category, event_date")
        .in("id", eventIds)
        .order("event_date", { ascending: false });
      setRegisteredEventDetails((eventDetailsData ?? []) as { id: string; title: string | null; category: string | null; event_date: string | null; }[]);
    } else {
      setRegisteredEventDetails([]);
    }

    if (eventRefsResult.error) {
      console.warn("Could not load event references:", eventRefsResult.error.message);
      setEventRefs([]);
    } else {
      setEventRefs(((eventRefsResult.data || []) as EventRef[]).filter(Boolean));
    }

    if (eventRegistrationsResult.error) {
      console.warn(
        "Could not load event registrations:",
        eventRegistrationsResult.error.message
      );
      setEventRegistrations([]);
    } else {
      setEventRegistrations(
        ((eventRegistrationsResult.data || []) as EventRegistrationRow[]).filter(Boolean)
      );
    }

    if (clubMembershipsResult.error) {
      console.warn(
        "Could not load joined clubs:",
        clubMembershipsResult.error.message
      );
      setJoinedClubs(await mergeJoinedClubs(userId, []));
    } else {
      setJoinedClubs(
        await mergeJoinedClubs(
          userId,
          ((clubMembershipsResult.data || []) as ClubMembership[])
            .map(getClubFromMembership)
            .filter(Boolean) as Club[]
        )
      );
    }

    if (managedClubResult.error) {
      console.warn("Could not load managed club:", managedClubResult.error.message);
      setManagedClub(null);
    } else {
      setManagedClub((managedClubResult.data as ManagedClub | null) || null);
    }
  };

  useEffect(() => {
    // Loads profile data from Supabase for this screen.
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
        setPhoneNumber(data.phone_number || "");
        setStudentIdState(data.student_id || "");
        setMajorState(data.major || "");
        setYear(data.academic_year || "");
        setBio(data.bio || "");
        setSkillsInput(data.skills?.join(", ") || "");
        setInterests(data.interests || []);
        setAvatarUrl(data.avatar_url || "");

        void loadOwnedTeams(user.id);
        void loadMemberTeams(user.id);
        void loadProfileActivity(user.id);

        setLoading(false);

        // If avatar_url points to a Supabase public object but the bucket may be private or missing,
        // try to generate a short-lived signed URL so the image can be displayed.
        if (data.avatar_url && data.avatar_url.includes("/object/public/avatars/")) {
          try {
            const parts = data.avatar_url.split("/object/public/avatars/");
            const objectPath = parts[1];
            if (objectPath) {
              const { data: signedData, error: signedError } = await supabase.storage
                .from("avatars")
                .createSignedUrl(objectPath, 60);

              if (!signedError && signedData?.signedUrl) {
                setAvatarUrl(signedData.signedUrl);
              }
            }
          } catch (err) {
            console.warn("Could not create signed URL for avatar:", err);
          }
        }
      } catch (err) {
        console.error("LOAD PROFILE ERROR:", err);
        setError("Something went wrong while loading your profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  // Handles the logout action for this screen.
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Handles the interest toggle action for this screen.
  const handleInterestToggle = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest]
    );
  };

  // Handles the image upload action for this screen.
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in.");
        return;
      }

      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        setError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      let publicUrl = publicUrlData?.publicUrl;

      // If the bucket is private, create a short-lived signed URL for display
      if (!publicUrl) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("avatars")
          .createSignedUrl(filePath, 60);

        if (!signedError && signedData?.signedUrl) {
          publicUrl = signedData.signedUrl;
        }
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
        })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("PROFILE UPDATE ERROR:", updateError);
        setError(updateError.message);
        return;
      }

      setProfile(updatedProfile);
      setAvatarUrl(updatedProfile.avatar_url || publicUrl);
      setSuccess("Profile photo updated successfully.");
    } catch (err) {
      console.error("IMAGE FLOW ERROR:", err);
      setError("Something went wrong while updating the photo.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handles the save profile action for this screen.
  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const cleanedSkills = skillsInput
      .split(",")
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0);
    const cleanPhoneNumber = formatPhoneNumber(phoneNumber);

    if (cleanPhoneNumber && !/^\+?\d{7,15}$/.test(cleanPhoneNumber)) {
      setError("Phone number must be 7 to 15 digits. You may start it with +.");
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("User not authenticated.");
        return;
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          academic_year: year.trim() || null,
          phone_number: cleanPhoneNumber || null,
          bio: bio.trim() || null,
          skills: cleanedSkills,
          interests,
        })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setProfile(data);
      setFullName(data.full_name || "");
      setPhoneNumber(data.phone_number || "");
      setStudentIdState(data.student_id || "");
      setMajorState(data.major || "");
      setYear(data.academic_year || "");
      setBio(data.bio || "");
      setSkillsInput(data.skills?.join(", ") || "");
      setInterests(data.interests || []);
      setAvatarUrl(data.avatar_url || "");
      setSuccess("Profile updated successfully.");
      setEditing(false);
      // Force a full reload after successful save to ensure fresh data
      if (typeof window !== "undefined") {
        // small delay to allow state updates to settle
        setTimeout(() => window.location.reload(), 100);
      } else {
        try {
          router.refresh();
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("SAVE PROFILE ERROR:", err);
      setError("Something went wrong while saving your profile.");
    } finally {
      setSaving(false);
    }
  };

  // Closes team and reject pending and applies any required cleanup.
  const closeTeamAndRejectPending = async (teamId: string) => {
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

  // Handles the team application action for this screen.
  const handleTeamApplication = async (
    team: OwnedTeam,
    member: TeamMember,
    status: "approved" | "rejected"
  ) => {
    if (!profile) return;

    setTeamActionId(member.id);
    setError("");
    setSuccess("");

    try {
      const approvedCount = team.members.filter(
        (teamMember) => teamMember.status === "approved"
      ).length;

      if (status === "approved") {
        const { data: eventTeams } = await supabase
          .from("teams")
          .select("id, name")
          .ilike("event", team.event || "");

        const eventTeamRows = (eventTeams || []) as Pick<Team, "id" | "name">[];
        const otherTeamIds = eventTeamRows
          .map((eventTeam) => eventTeam.id)
          .filter((teamId) => teamId !== team.id);

        if (otherTeamIds.length > 0) {
          const { data: existingMemberships, error: membershipError } =
            await supabase
              .from("team_members")
              .select("team_id, user_id, status")
              .in("team_id", otherTeamIds)
              .eq("user_id", member.user_id)
              .neq("status", "rejected");

          if (membershipError) {
            setError(membershipError.message);
            return;
          }

          if ((existingMemberships || []).length > 0) {
            const memberProfile = Array.isArray(member.profiles)
              ? member.profiles[0]
              : member.profiles;
            setError(
              `The member with Student ID ${
                memberProfile?.student_id || "unknown"
              } is already in a team for this event.`
            );
            return;
          }
        }
      }

      if (status === "approved" && approvedCount >= TEAM_MEMBER_LIMIT) {
        const closed = await closeTeamAndRejectPending(team.id);
        if (!closed) return;
        setSuccess("Team is already full. Pending applications were rejected.");
        await loadOwnedTeams(profile.id);
        return;
      }

      const { error: updateError } = await supabase
        .from("team_members")
        .update({ status })
        .eq("id", member.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (status === "approved" && approvedCount + 1 >= TEAM_MEMBER_LIMIT) {
        const closed = await closeTeamAndRejectPending(team.id);
        if (!closed) return;
        setSuccess("Member approved. Team is now full, so remaining applications were rejected.");
      } else {
        setSuccess(status === "approved" ? "Member approved." : "Application rejected.");
      }

      await loadOwnedTeams(profile.id);
    } finally {
      setTeamActionId("");
    }
  };

  // Handles the add members by student id action for this screen.
  const handleAddMembersByStudentId = async (team: OwnedTeam) => {
    if (!profile) return;

    const requestedMemberIds = Array.from(
      new Set((addMemberInputs[team.id] || "").match(/\d{8}/g) ?? [])
    ).filter((studentId) => studentId !== profile.student_id);

    if (requestedMemberIds.length === 0) {
      setError("Enter at least one valid 8-digit Student ID.");
      return;
    }

    const activeCount = team.members.filter(
      (member) => member.status !== "rejected"
    ).length;
    const remainingSlots = TEAM_MEMBER_LIMIT - activeCount;

    if (remainingSlots <= 0) {
      const closed = await closeTeamAndRejectPending(team.id);
      if (closed) {
        setSuccess("Team is already full. Pending applications were rejected.");
        await loadOwnedTeams(profile.id);
      }
      return;
    }

    if (requestedMemberIds.length > remainingSlots) {
      setError(`You can add up to ${remainingSlots} member(s) to this team.`);
      return;
    }

    setTeamActionId(`add-${team.id}`);
    setError("");
    setSuccess("");

    try {
      const { data: matchedProfiles, error: profileLookupError } = await supabase
        .from("profiles")
        .select("id, full_name, email, student_id, major, academic_year")
        .in("student_id", requestedMemberIds);

      if (profileLookupError) {
        setError(profileLookupError.message);
        return;
      }

      const invitedProfiles = (matchedProfiles || []) as Profile[];
      const foundIds = new Set(
        invitedProfiles
          .map((member) => member.student_id)
          .filter(Boolean) as string[]
      );
      const missingIds = requestedMemberIds.filter(
        (studentId) => !foundIds.has(studentId)
      );

      if (missingIds.length > 0) {
        setError(`No profiles found for Student ID: ${missingIds.join(", ")}.`);
        return;
      }

      const { data: eventTeams } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("event", team.event || "");

      const eventTeamRows = (eventTeams || []) as Pick<Team, "id" | "name">[];

      if (eventTeamRows.length > 0) {
        const { data: existingMemberships, error: membershipError } =
          await supabase
            .from("team_members")
            .select("team_id, user_id, status")
            .in(
              "team_id",
              eventTeamRows.map((eventTeam) => eventTeam.id)
            )
            .in(
              "user_id",
              invitedProfiles.map((member) => member.id)
            )
            .neq("status", "rejected");

        if (membershipError) {
          setError(membershipError.message);
          return;
        }

        const takenMembership = (existingMemberships || [])[0] as
          | Pick<TeamMember, "team_id" | "user_id" | "status">
          | undefined;

        if (takenMembership) {
          const takenProfile = invitedProfiles.find(
            (member) => member.id === takenMembership.user_id
          );
          setError(
            `The member with Student ID ${
              takenProfile?.student_id || "unknown"
            } is already in a team for this event.`
          );
          return;
        }
      }

      const { error: memberError } = await supabase.from("team_members").upsert(
        invitedProfiles.map((member) => ({
          team_id: team.id,
          user_id: member.id,
          status: "invited",
        })),
        { onConflict: "team_id,user_id" }
      );

      if (memberError) {
        setError(memberError.message);
        return;
      }

      const nextActiveCount = activeCount + invitedProfiles.length;

      if (nextActiveCount >= TEAM_MEMBER_LIMIT) {
        const closed = await closeTeamAndRejectPending(team.id);
        if (!closed) return;
        setSuccess("Invites sent. Team is now full, so remaining applications were rejected.");
      } else {
        setSuccess("Invites sent to the selected students.");
      }

      setAddMemberInputs((current) => ({ ...current, [team.id]: "" }));
      await loadOwnedTeams(profile.id);
      await loadMemberTeams(profile.id);
    } finally {
      setTeamActionId("");
    }
  };

  // Starts editing team for the selected record.
  const startEditingTeam = (team: OwnedTeam) => {
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

  // Handles the save team settings action for this screen.
  const handleSaveTeamSettings = async (team: OwnedTeam) => {
    if (!profile) return;

    const values = teamEditValues[team.id];
    const cleanName = values?.name.trim() || "";
    const cleanDescription = values?.description.trim() || "";
    const cleanNeededSkills = values?.isOpenToMembers
      ? values.neededSkills.trim()
      : "";
    const nextMaxMembers = Math.min(
      Math.max(Number(values?.maxMembers) || TEAM_MEMBER_LIMIT, 2),
      TEAM_MEMBER_LIMIT
    );
    const approvedCount = team.members.filter(
      (member) => member.status === "approved"
    ).length;

    if (!cleanName) {
      setError("Team name is required.");
      return;
    }

    if (!cleanDescription) {
      setError("Team description is required.");
      return;
    }

    if (values?.isOpenToMembers && !cleanNeededSkills) {
      setError("Tell students what kind of member your team needs.");
      return;
    }

    if (nextMaxMembers < approvedCount) {
      setError(
        `Max members cannot be less than your current ${approvedCount} approved member(s).`
      );
      return;
    }

    setTeamActionId(`edit-${team.id}`);
    setError("");
    setSuccess("");

    try {
      const shouldClose = nextMaxMembers >= TEAM_MEMBER_LIMIT && approvedCount >= TEAM_MEMBER_LIMIT;
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          name: cleanName,
          description: cleanDescription,
          needed_skills: cleanNeededSkills || null,
          max_members: nextMaxMembers,
          is_open_to_members: shouldClose ? false : values?.isOpenToMembers ?? true,
        })
        .eq("id", team.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (shouldClose) {
        const closed = await closeTeamAndRejectPending(team.id);
        if (!closed) return;
      }

      setSuccess("Team settings updated.");
      setEditingTeamId("");
      await loadOwnedTeams(profile.id);
    } finally {
      setTeamActionId("");
    }
  };

  // Removing a member can reopen a team that was previously full, allowing new
  // applications without manually editing the team settings.
  const handleRemoveTeamMember = async (team: OwnedTeam, member: TeamMember) => {
    if (!profile) return;

    if (member.user_id === profile.id) {
      setError("You cannot remove yourself as the team owner.");
      return;
    }

    setTeamActionId(`remove-${member.id}`);
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

      const approvedCountAfterRemove =
        team.members.filter((teamMember) => teamMember.status === "approved")
          .length - (member.status === "approved" ? 1 : 0);

      if (approvedCountAfterRemove < TEAM_MEMBER_LIMIT) {
        await supabase
          .from("teams")
          .update({ is_open_to_members: true })
          .eq("id", team.id);
      }

      setSuccess("Member removed from the team.");
      await loadOwnedTeams(profile.id);
      await loadMemberTeams(profile.id);
    } finally {
      setTeamActionId("");
    }
  };

  // Handles the cancel membership request action for this screen.
  const handleCancelMembershipRequest = async (team: MemberTeam) => {
    if (!profile) return;

    setTeamActionId(`cancel-${team.membershipId}`);
    setError("");
    setSuccess("");

    try {
      const { error: cancelError } = await supabase
        .from("team_members")
        .delete()
        .eq("id", team.membershipId);

      if (cancelError) {
        setError(cancelError.message);
        return;
      }

      setSuccess(`Request to join ${team.name} was cancelled.`);
      await loadMemberTeams(profile.id);
      await loadOwnedTeams(profile.id);
    } finally {
      setTeamActionId("");
    }
  };

  // Handles the team invite response action for this screen.
  const handleTeamInviteResponse = async (
    team: MemberTeam,
    status: "approved" | "rejected"
  ) => {
    if (!profile) return;

    setTeamActionId(`invite-${team.membershipId}`);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("team_members")
        .update({ status })
        .eq("id", team.membershipId);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(
        status === "approved"
          ? `You joined ${team.name}.`
          : `Invite from ${team.name} was rejected.`
      );
      await loadMemberTeams(profile.id);
      await loadOwnedTeams(profile.id);
    } finally {
      setTeamActionId("");
    }
  };

  const initials =
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    email?.trim()?.charAt(0)?.toUpperCase() ||
    "S";

  const myTeamsCount = useMemo(() => {
    const teamIds = new Set<string>();
    ownedTeams.forEach((team) => teamIds.add(team.id));
    memberTeams.forEach((team) => teamIds.add(team.id));
    return teamIds.size;
  }, [memberTeams, ownedTeams]);

  const joinedEventsCount = useMemo(() => {
    const joined = new Set(eventRegistrations.map((registration) => registration.event_id));
    const eventIdByTitle = new Map(
      eventRefs
        .filter((event) => event.title)
        .map((event) => [event.title!.toLowerCase(), event.id])
    );

    [...ownedTeams, ...memberTeams].forEach((team) => {
      const eventTitle = team.event?.toLowerCase();
      const eventId = eventTitle ? eventIdByTitle.get(eventTitle) : undefined;

      if (eventId) {
        joined.add(eventId);
      }
    });

    return joined.size;
  }, [eventRefs, eventRegistrations, memberTeams, ownedTeams]);

  const joinedClubNames = useMemo(() => {
    if (joinedClubs.length === 0) return "No joined clubs yet";

    const names = joinedClubs.map(getClubName);
    if (names.length <= 2) return names.join(", ");

    return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  }, [joinedClubs]);

  const effectiveManagedClub = managedClub;
  const managedClubName = effectiveManagedClub ? getClubName(effectiveManagedClub) : "";

  const inputClass =
    "mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10";

  if (loading) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f3f5f9]">
        <AppNavbar />
        <section className="mx-auto w-full max-w-[calc(100vw-1.5rem)] px-0 py-5 sm:max-w-[1800px] sm:px-6 sm:py-8 lg:px-8 xl:px-10 2xl:px-12">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm sm:p-6">
            Loading profile...
          </div>
        </section>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f3f5f9]">
        <AppNavbar />
        <section className="mx-auto w-full max-w-[calc(100vw-1.5rem)] px-0 py-5 sm:max-w-[1800px] sm:px-6 sm:py-8 lg:px-8 xl:px-10 2xl:px-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm sm:p-6">
            {error}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3f5f9]">
      <AppNavbar />

      <section className="mx-auto w-full max-w-[calc(100vw-1.5rem)] px-0 py-5 sm:max-w-[1800px] sm:px-6 sm:py-8 lg:px-8 xl:px-10 2xl:px-12">
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

        <div className="grid w-full min-w-0 max-w-full gap-6 overflow-hidden">
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start lg:items-center">
              <div className="flex w-full shrink-0 flex-col items-start gap-3 sm:w-auto sm:items-center">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8eefc] text-2xl font-bold text-[#1e3a8a] sm:h-28 sm:w-28 sm:text-3xl">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profile avatar"
                      width={112}
                      height={112}
                      className="h-full w-full object-cover"
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

              <div className="min-w-0 flex-1">
                <h2 className="break-words text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                  {fullName || profile?.full_name || "Student User"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  {managedClubName && (
                    <span className="rounded-full bg-[#ede9fe] px-2 py-1 text-xs font-medium text-[#6d28d9]">
                      Admin of {managedClubName}
                    </span>
                  )}
                </div>
                {managedClubName && (
                  <p className="mt-3 text-sm font-medium text-[#1e3a8a]">
                    Club Admin of {managedClubName}
                  </p>
                )}
                <p className="mt-1 text-base text-gray-700">
                  {majorState || profile?.major || "Major not specified"}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Princess Sumaya University for Technology
                </p>
              </div>

              {!editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setSuccess("");
                    setError("");
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/20 sm:w-auto lg:self-start"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                  Edit Profile
                </button>
              ) : (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setYear(profile?.academic_year || "");
                      setBio(profile?.bio || "");
                      setSkillsInput(profile?.skills?.join(", ") || "");
                      setInterests(profile?.interests || []);
                      setAvatarUrl(profile?.avatar_url || "");
                      setFullName(profile?.full_name || "");
                      setPhoneNumber(profile?.phone_number || "");
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
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="rounded-xl bg-[#1e3a8a] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {!editing && (
              <div className="mt-8 grid min-w-0 gap-3 sm:grid-cols-3">
                <Link
                  href="/teams"
                  className="rounded-xl bg-[#eef3ff] p-4 transition hover:bg-[#dfe8ff]"
                >
                  <p className="text-sm font-medium text-[#1e3a8a]">My teams</p>
                  <p className="mt-2 text-2xl font-bold text-[#1e3a8a]">
                    {myTeamsCount}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="rounded-xl bg-sky-50 p-4 text-left transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-sky-700">Event history</p>
                    <svg width="14" height="14" fill="none" stroke="#0369a1" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-sky-700">
                    {joinedEventsCount}
                  </p>
                  <p className="mt-1 text-xs text-sky-500">Tap to view history</p>
                </button>
                <Link
                  href="/clubs"
                  className="rounded-xl bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="text-sm font-medium text-slate-700">Joined clubs</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {joinedClubs.length}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {joinedClubNames}
                  </p>
                </Link>
              </div>
            )}

            {!editing && effectiveManagedClub && (
              <div className="mt-8 rounded-2xl border border-[#d9e3ff] bg-[#f8fbff] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1e3a8a]">
                      Leadership
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">
                      Club Admin of {managedClubName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Your profile shows that you manage this club.
                    </p>
                  </div>

                  <Link
                    href={`/clubs/${effectiveManagedClub.id}`}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#1e3a8a] px-4 py-2 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eef3ff]"
                  >
                    View club
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-500">Email</h3>
                <p className="mt-2 text-base text-gray-900">
                  {email || "No email"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">
                  Phone Number
                </h3>
                {!editing ? (
                  <p className="mt-2 text-base text-gray-900">
                    {phoneNumber || profile?.phone_number || "Not specified"}
                  </p>
                ) : (
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) =>
                      setPhoneNumber(formatPhoneNumber(e.target.value))
                    }
                    placeholder="e.g. +962790000000"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={16}
                    className={inputClass}
                  />
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">
                  Student ID
                </h3>
                <p className="mt-2 text-base text-gray-900">
                  {studentIdState || profile?.student_id || "Not specified"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">Major</h3>
                <p className="mt-2 text-base text-gray-900">
                  {profile?.major || "Not specified"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500">
                  Academic Year
                </h3>
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
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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

            {!editing && (
              <div className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500">
                      Joined Clubs
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Clubs you are currently a member of.
                    </p>
                  </div>
                  <Link
                    href="/clubs"
                    className="text-sm font-semibold text-[#1e3a8a] hover:underline"
                  >
                    View all clubs
                  </Link>
                </div>

                {joinedClubs.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {joinedClubs.map((club) => (
                      <Link
                        key={club.id}
                        href={`/clubs/${club.id}`}
                        className="rounded-xl border border-gray-200 bg-slate-50 p-4 transition hover:border-[#1e3a8a]/30 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {getClubName(club)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatTagLabel(club.category) || "Club"}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Joined
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-slate-50 p-4 text-sm text-slate-500">
                    No joined clubs yet.
                  </div>
                )}
              </div>
            )}

            {editing && (
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            )}

          </div>

          {false && !editing && memberTeams.length > 0 && (
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Teams I&apos;m In</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Teams you joined as a member.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {memberTeams.map((team) => {
                  const isPending = team.membershipStatus === "pending";
                  const isInvited = team.membershipStatus === "invited";
                  const isClosed = team.is_open_to_members === false;

                  return (
                    <article
                      key={team.id}
                      className="rounded-xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-bold text-[#1e3a8a]">
                              {team.name}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                isInvited
                                  ? "bg-blue-50 text-blue-700"
                                  : isPending
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-green-50 text-green-700"
                              }`}
                            >
                              {isInvited
                                ? "Invited"
                                : isPending
                                ? "Pending"
                                : "Member"}
                            </span>
                            {isClosed && (
                              <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                                Closed
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            {team.event || "Event not set"}
                          </p>
                        </div>

                        <p className="rounded-full bg-[#e8eefc] px-3 py-1 text-sm font-semibold text-[#1e3a8a]">
                          Max {team.max_members ?? TEAM_MEMBER_LIMIT} members
                        </p>
                      </div>

                      {isInvited && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleTeamInviteResponse(team, "approved")
                            }
                            disabled={teamActionId === `invite-${team.membershipId}`}
                            className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {teamActionId === `invite-${team.membershipId}`
                              ? "Saving..."
                              : "Accept invite"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleTeamInviteResponse(team, "rejected")
                            }
                            disabled={teamActionId === `invite-${team.membershipId}`}
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            Reject invite
                          </button>
                        </div>
                      )}

                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleCancelMembershipRequest(team)}
                          disabled={teamActionId === `cancel-${team.membershipId}`}
                          className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          {teamActionId === `cancel-${team.membershipId}`
                            ? "Cancelling..."
                            : "Cancel request"}
                        </button>
                      )}

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
                    </article>
                  );
                })}
              </div>
            </div>
          )}

            {false && !editing && ownedTeams.length > 0 && (
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">My Teams</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Review applicants and manage teams you own.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  {ownedTeams.map((team) => {
                    const approvedMembers = team.members.filter(
                      (member) => member.status === "approved"
                    );
                    const pendingMembers = team.members.filter(
                      (member) => member.status === "pending"
                    );
                    const invitedMembers = team.members.filter(
                      (member) => member.status === "invited"
                    );
                    const isFull = approvedMembers.length >= TEAM_MEMBER_LIMIT;
                    const isClosed = team.is_open_to_members === false || isFull;
                    const isEditingTeam = editingTeamId === team.id;
                    const editValues = teamEditValues[team.id] || {
                      name: team.name,
                      description: team.description || "",
                      neededSkills: team.needed_skills || "",
                      maxMembers: String(team.max_members ?? TEAM_MEMBER_LIMIT),
                      isOpenToMembers: team.is_open_to_members !== false,
                    };

                    return (
                      <article
                        key={team.id}
                        className="rounded-xl border border-gray-200 bg-white p-5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {isEditingTeam ? (
                                <input
                                  value={editValues.name}
                                  onChange={(e) =>
                                    setTeamEditValues((current) => ({
                                      ...current,
                                      [team.id]: {
                                        ...editValues,
                                        name: e.target.value,
                                      },
                                    }))
                                  }
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                                />
                              ) : (
                                <h4 className="text-lg font-bold text-[#1e3a8a]">
                                  {team.name}
                                </h4>
                              )}
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                  isClosed
                                    ? "bg-red-50 text-red-600"
                                    : "bg-green-50 text-green-700"
                                }`}
                              >
                                {isClosed ? "Closed" : "Open"}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {team.event || "Event not set"}
                            </p>
                          </div>

                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            {isEditingTeam ? (
                              <label className="text-xs font-semibold text-gray-500">
                                Max members
                                <input
                                  type="number"
                                  min={Math.max(approvedMembers.length, 2)}
                                  max={TEAM_MEMBER_LIMIT}
                                  value={editValues.maxMembers}
                                  onChange={(e) =>
                                    setTeamEditValues((current) => ({
                                      ...current,
                                      [team.id]: {
                                        ...editValues,
                                        maxMembers: e.target.value,
                                      },
                                    }))
                                  }
                                  className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                                />
                              </label>
                            ) : (
                              <p className="rounded-full bg-[#e8eefc] px-3 py-1 text-sm font-semibold text-[#1e3a8a]">
                                {approvedMembers.length} /{" "}
                                {team.max_members ?? TEAM_MEMBER_LIMIT} members
                              </p>
                            )}

                            <div className="flex gap-2">
                              {isEditingTeam ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTeamSettings(team)}
                                    disabled={teamActionId === `edit-${team.id}`}
                                    className="rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                  >
                                    {teamActionId === `edit-${team.id}`
                                      ? "Saving..."
                                      : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTeamId("")}
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingTeam(team)}
                                  className="rounded-lg border border-[#1e3a8a] px-3 py-2 text-xs font-semibold text-[#1e3a8a] hover:bg-[#eef3ff]"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {isEditingTeam ? (
                          <div className="mt-4">
                            <label className="text-xs font-semibold uppercase text-gray-400">
                              Description
                              <textarea
                                value={editValues.description}
                                onChange={(e) =>
                                  setTeamEditValues((current) => ({
                                    ...current,
                                    [team.id]: {
                                      ...editValues,
                                      description: e.target.value,
                                    },
                                  }))
                                }
                                rows={3}
                                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm normal-case text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                              />
                            </label>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm leading-6 text-gray-700">
                            {team.description || "No description added."}
                          </p>
                        )}

                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            What you need
                          </p>
                          {isEditingTeam ? (
                            <div className="mt-2 space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <label
                                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                                    editValues.isOpenToMembers
                                      ? "border-[#1e3a8a] bg-[#eef3ff] text-[#1e3a8a]"
                                      : "border-gray-200 text-gray-600"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`open-${team.id}`}
                                    checked={editValues.isOpenToMembers}
                                    onChange={() =>
                                      setTeamEditValues((current) => ({
                                        ...current,
                                        [team.id]: {
                                          ...editValues,
                                          isOpenToMembers: true,
                                        },
                                      }))
                                    }
                                    className="sr-only"
                                  />
                                  Need members
                                </label>
                                <label
                                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                                    !editValues.isOpenToMembers
                                      ? "border-[#1e3a8a] bg-[#eef3ff] text-[#1e3a8a]"
                                      : "border-gray-200 text-gray-600"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`open-${team.id}`}
                                    checked={!editValues.isOpenToMembers}
                                    onChange={() =>
                                      setTeamEditValues((current) => ({
                                        ...current,
                                        [team.id]: {
                                          ...editValues,
                                          isOpenToMembers: false,
                                          neededSkills: "",
                                        },
                                      }))
                                    }
                                    className="sr-only"
                                  />
                                  No more members
                                </label>
                              </div>
                              {editValues.isOpenToMembers && (
                                <textarea
                                  value={editValues.neededSkills}
                                  onChange={(e) =>
                                    setTeamEditValues((current) => ({
                                      ...current,
                                      [team.id]: {
                                        ...editValues,
                                        neededSkills: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="What do you need in new members?"
                                  rows={3}
                                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm normal-case text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                                />
                              )}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm font-medium text-gray-800">
                              {team.needed_skills || "No more members needed."}
                            </p>
                          )}
                        </div>

                        {invitedMembers.length > 0 && (
                          <div className="mt-5">
                            <p className="text-sm font-semibold text-gray-900">
                              Invited members
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {invitedMembers.map((member) => {
                                const memberProfile = Array.isArray(member.profiles)
                                  ? member.profiles[0]
                                  : member.profiles;

                                return (
                                  <div
                                    key={member.id}
                                    className="rounded-lg border border-blue-100 bg-blue-50 p-3"
                                  >
                                    <p className="text-sm font-semibold text-gray-900">
                                      {memberProfile?.full_name || "Student"}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-600">
                                      {memberProfile?.student_id || "No Student ID"} -{" "}
                                      {memberProfile?.major || "Major not added"}
                                    </p>
                                    <p className="mt-2 text-xs font-semibold text-blue-700">
                                      Waiting for approval
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mt-5">
                          <p className="text-sm font-semibold text-gray-900">
                            Current members
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {approvedMembers.map((member) => {
                              const memberProfile = Array.isArray(member.profiles)
                                ? member.profiles[0]
                                : member.profiles;

                              return (
                                <div
                                  key={member.id}
                                  className="rounded-lg border border-gray-200 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {memberProfile?.full_name || "Student"}
                                      </p>
                                      <p className="mt-1 text-xs text-gray-500">
                                        {memberProfile?.student_id || "No Student ID"} -{" "}
                                        {memberProfile?.major || "Major not added"}
                                      </p>
                                    </div>
                                    {memberProfile?.id !== profile?.id && (
                                      <div className="flex shrink-0 flex-col gap-2">
                                        <Link
                                          href={`/profile/${memberProfile?.id}`}
                                          className="rounded-lg border border-[#1e3a8a] px-3 py-1.5 text-center text-xs font-semibold text-[#1e3a8a] hover:bg-[#eef3ff]"
                                        >
                                          View profile
                                        </Link>
                                        {isEditingTeam && (
                                          <button
                                            type="button"
                                              onClick={() =>
                                                handleRemoveTeamMember(team, member)
                                              }
                                              disabled={
                                                teamActionId === `remove-${member.id}`
                                              }
                                              className="rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                                            >
                                            {teamActionId === `remove-${member.id}`
                                              ? "Removing..."
                                              : "Remove"}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {isEditingTeam && !isClosed && (
                          <div className="mt-5 rounded-xl border border-gray-200 p-4">
                            <p className="text-sm font-semibold text-gray-900">
                              Add members by Student ID
                            </p>
                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              The system will check that each student is not already
                              in another team for this event.
                            </p>
                            <textarea
                              value={addMemberInputs[team.id] || ""}
                              onChange={(e) =>
                                setAddMemberInputs((current) => ({
                                  ...current,
                                  [team.id]: e.target.value,
                                }))
                              }
                              placeholder="e.g. 20210083, 20210049"
                              rows={3}
                              className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddMembersByStudentId(team)}
                              disabled={teamActionId === `add-${team.id}`}
                              className="mt-3 rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {teamActionId === `add-${team.id}`
                                ? "Adding..."
                                : "Add members"}
                            </button>
                          </div>
                        )}

                        <div className="mt-5">
                          <p className="text-sm font-semibold text-gray-900">
                            Applied members
                          </p>

                          {pendingMembers.length > 0 && !isClosed ? (
                            <div className="mt-3 space-y-3">
                              {pendingMembers.map((member) => {
                                const memberProfile = Array.isArray(member.profiles)
                                  ? member.profiles[0]
                                  : member.profiles;

                                return (
                                  <div
                                    key={member.id}
                                    className="rounded-lg border border-gray-200 p-4"
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                          {memberProfile?.full_name || "Student"}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                          {memberProfile?.student_id || "No Student ID"} -{" "}
                                          {memberProfile?.major || "Major not added"}
                                        </p>
                                      </div>

                                      <div className="flex gap-2">
                                        {memberProfile?.id !== profile?.id && (
                                          <Link
                                            href={`/profile/${memberProfile?.id}`}
                                            className="rounded-lg border border-[#1e3a8a] px-3 py-2 text-xs font-semibold text-[#1e3a8a] hover:bg-[#eef3ff]"
                                          >
                                            View profile
                                          </Link>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleTeamApplication(
                                              team,
                                              member,
                                              "approved"
                                            )
                                          }
                                          disabled={teamActionId === member.id}
                                          className="rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleTeamApplication(
                                              team,
                                              member,
                                              "rejected"
                                            )
                                          }
                                          disabled={teamActionId === member.id}
                                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500">
                              {isClosed
                                ? "This team is closed. Remaining applications were rejected."
                                : "No pending applications."}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      </section>

      {/* ── Event History Drawer ─────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowHistory(false)}
          />

          {/* Drawer panel */}
          <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">My Event History</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Events you have registered for
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close history"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Count badge */}
            <div className="border-b border-slate-100 px-6 py-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {registeredEventDetails.length} event{registeredEventDetails.length !== 1 ? "s" : ""} in total
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {registeredEventDetails.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <svg width="40" height="40" fill="none" stroke="#cbd5e1" strokeWidth="1.5" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                  <p className="text-sm font-medium text-slate-500">No events registered yet</p>
                  <p className="text-xs text-slate-400">Events you join will appear here.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {registeredEventDetails.map((ev) => {
                    const catColors: Record<string, string> = {
                      Hackathon: "bg-purple-50 text-purple-700",
                      Workshop: "bg-blue-50 text-blue-700",
                      Competition: "bg-orange-50 text-orange-700",
                      Seminar: "bg-teal-50 text-teal-700",
                      Conference: "bg-indigo-50 text-indigo-700",
                    };
                    const catColor = catColors[ev.category ?? ""] ?? "bg-slate-100 text-slate-600";
                    const formattedDate = ev.event_date
                      ? new Date(ev.event_date).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        })
                      : "Date TBD";
                    return (
                      <li
                        key={ev.id}
                        className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-200 hover:bg-sky-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-900 leading-snug">{ev.title ?? "Untitled event"}</p>
                          {ev.category && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${catColor}`}>
                              {formatTagLabel(ev.category)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                          {formattedDate}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
