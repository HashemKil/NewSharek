"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppNavbar from "../../../components/AppNavbar";
import { inferEventCategory } from "../../../lib/eventCategories";
import { supabase } from "../../../lib/supabase";
import { formatTagLabel } from "../../../lib/tagLabels";

type EventRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  prize?: string | null;
  event_date?: string | null;
  end_date?: string | null;
  registration_deadline?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_details?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  thumbnail_url?: string | null;
  club_id?: string | null;
  registered_count?: number | null;
  max_capacity?: number | null;
  approval_status?: string | null;
  is_team_based?: boolean | null;
  is_university_event?: boolean | null;
  is_club_members_only?: boolean | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  major: string | null;
  academic_year: string | null;
};

type ClubRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  email?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
};

type Team = {
  id: string;
  name: string;
  event: string | null;
  description: string | null;
  needed_skills: string | null;
  max_members: number | null;
  status?: string | null;
  owner_id: string | null;
  is_open_to_members?: boolean | null;
};

type TeamMember = {
  id?: string;
  team_id: string;
  user_id: string;
  status?: string | null;
  profiles?: Profile | Profile[] | null;
};

type TeamWithMembers = Team & {
  members: Profile[];
  memberCount: number;
  hasRequested: boolean;
  currentUserMemberId: string | null;
  currentUserMemberStatus: string | null;
};

type PendingExternalJoin = {
  eventId: string;
  title: string;
  url: string;
  openedAt: number;
};

const EXTERNAL_JOIN_STORAGE_KEY = "sharek:pendingExternalEventJoin";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10";

const TEAM_MEMBER_LIMIT = 6;
type EventStatus = "upcoming" | "ongoing" | "completed";

// Chooses the most useful image URL for the event details page.
const getEventImageUrl = (event: EventRow | null) =>
  event?.image_url?.trim() ||
  event?.poster_url?.trim() ||
  event?.banner_url?.trim() ||
  event?.thumbnail_url?.trim() ||
  null;

// Detects online events so the details page does not show a physical map.
const isOnlineLocation = (location?: string | null) =>
  !location || /\bonline\b|virtual|remote/i.test(location);

// Builds a Google Maps embed URL from the event location fields.
const getMapEmbedUrl = (location?: string | null) => {
  if (isOnlineLocation(location)) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(
    `${location}, Jordan`
  )}&output=embed`;
};

// Builds an external Google Maps link for the event location.
const getMapLink = (location?: string | null) => {
  if (isOnlineLocation(location)) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${location}, Jordan`
  )}`;
};

// Shows full event details and the correct join flow for solo or team events.
export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [currentEventTeamName, setCurrentEventTeamName] = useState("");
  const [statusClock, setStatusClock] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);
  const [isResponsibleClubMember, setIsResponsibleClubMember] = useState(false);
  const [responsibleClub, setResponsibleClub] = useState<ClubRow | null>(null);
  const [pendingExternalJoin, setPendingExternalJoin] =
    useState<PendingExternalJoin | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [neededSkills, setNeededSkills] = useState("");
  const [needsMoreMembers, setNeedsMoreMembers] = useState("yes");
  const [memberStudentIds, setMemberStudentIds] = useState("");
  const [maxMembers, setMaxMembers] = useState(String(TEAM_MEMBER_LIMIT));

  const eventDate = event?.event_date ?? event?.date ?? null;
  const eventEndDate = event?.end_date ?? eventDate;
  const registrationDeadline = event?.registration_deadline ?? null;
  const eventImageUrl = getEventImageUrl(event);
  const mapEmbedUrl = getMapEmbedUrl(event?.location);
  const mapLink = getMapLink(event?.location);
  const isTeamBased = Boolean(event?.is_team_based);
  const usesExternalRegistration = Boolean(event?.source_url) && !event?.is_university_event;
  const isClubMembersOnly = Boolean(event?.is_club_members_only);
  const isLockedClubEvent =
    isClubMembersOnly && Boolean(event?.club_id) && !isResponsibleClubMember;
  const eventTypeLabel = isTeamBased ? "Team based" : "Solo based";
  const eventCategoryLabel = inferEventCategory(
    event?.category,
    event?.title,
    event?.description
  );
  const responsibleClubName =
    responsibleClub?.name?.trim() ||
    responsibleClub?.title?.trim() ||
    "University club";

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null,
    [selectedTeamId, teams]
  );

  const parseEventDateTime = useCallback((
    date: string | null,
    time: string | null,
    fallback: "start" | "end"
  ) => {
    if (!date) return null;

    const datePart = date.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) return null;

    let hours = fallback === "end" ? 23 : 0;
    let minutes = fallback === "end" ? 59 : 0;
    let seconds = fallback === "end" ? 59 : 0;

    if (time) {
      const [rawHours, rawMinutes, rawSeconds] = time.split(":");
      hours = Number(rawHours);
      minutes = Number(rawMinutes ?? 0);
      seconds = Number(rawSeconds ?? 0);
    }

    if (![hours, minutes, seconds].every(Number.isFinite)) return null;

    const parsed = new Date(
      year,
      month - 1,
      day,
      hours,
      minutes,
      seconds,
      fallback === "end" ? 999 : 0
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const computeStatus = useCallback((
    date: string | null,
    endDate: string | null,
    start: string | null,
    end: string | null
  ): EventStatus => {
    const now = new Date();
    const startsAt = parseEventDateTime(date, start, "start");
    const endsAt = parseEventDateTime(endDate || date, end, "end");

    if (!startsAt || !endsAt) return "upcoming";

    const effectiveEndsAt = new Date(endsAt);
    if (effectiveEndsAt < startsAt) {
      effectiveEndsAt.setDate(effectiveEndsAt.getDate() + 1);
    }

    if (now < startsAt) return "upcoming";
    if (now > effectiveEndsAt) return "completed";

    return "ongoing";
  }, [parseEventDateTime]);

  const eventStatus = useMemo(() => {
    void statusClock;
    return computeStatus(
      eventDate,
      eventEndDate,
      event?.start_time ?? null,
      event?.end_time ?? null
    );
  }, [computeStatus, eventDate, eventEndDate, event?.end_time, event?.start_time, statusClock]);
  const isCompleted = eventStatus === "completed";
  const isRegistrationClosed = registrationDeadline
    ? new Date(registrationDeadline) < new Date()
    : false;

  // Formats date for display.
  const formatDate = (value: string | null) => {
    if (!value) return "Date not set";
    const parsed = parseEventDateTime(value, null, "start");
    if (!parsed) return value;

    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Formats date range for display.
  const formatDateRange = (start: string | null, end: string | null) => {
    if (!end || end === start) return formatDate(start);
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Formats date time for display.
  const formatDateTime = (value: string | null) => {
    if (!value) return "No deadline";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Formats time for display.
  const formatTime = (value?: string | null) => {
    if (!value) return "";
    const [hours, minutes] = value.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes || 0), 0, 0);

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const timeLabel =
    event?.start_time && event?.end_time
      ? `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`
      : formatTime(event?.start_time) || "Time not set";

  // Gets status badge for this workflow.
  const getStatusBadge = (status: EventStatus) => {
    void status;
    return "border-sky-200 bg-sky-50 text-sky-700";
  };

  const eventTypeBadgeClass =
    "rounded-full border border-[#c7d5fb] bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#1e3a8a]";

  // Loads details data from Supabase for this screen.
  const loadDetails = async () => {
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

      const [profileResult, eventResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, student_id, major, academic_year")
          .eq("id", user.id)
          .single(),
        supabase.from("events").select("*").eq("id", id).single(),
      ]);

      if (profileResult.error) {
        setError(profileResult.error.message);
        return;
      }

      setProfile(profileResult.data as Profile);

      if (eventResult.error || !eventResult.data) {
        setError(eventResult.error?.message || "Event not found.");
        return;
      }

      const loadedEvent = eventResult.data as EventRow;
      if ((loadedEvent.approval_status ?? "approved") !== "approved") {
        setError("This event is still pending review.");
        return;
      }

      setEvent(loadedEvent);

      if (loadedEvent.is_university_event && loadedEvent.club_id) {
        const { data: clubData } = await supabase
          .from("clubs")
          .select("*")
          .eq("id", loadedEvent.club_id)
          .maybeSingle();

        setResponsibleClub((clubData as ClubRow | null) ?? null);
      } else {
        setResponsibleClub(null);
      }

      if (loadedEvent.is_club_members_only && loadedEvent.club_id) {
        const { data: clubMembership } = await supabase
          .from("club_members")
          .select("club_id")
          .eq("club_id", loadedEvent.club_id)
          .eq("user_id", user.id)
          .eq("status", "approved")
          .maybeSingle();

        setIsResponsibleClubMember(Boolean(clubMembership));
      } else {
        setIsResponsibleClubMember(false);
      }

      const { data: registrationData, error: registrationStatusError } = await supabase
        .from("event_registrations")
        .select("id, status")
        .eq("event_id", loadedEvent.id)
        .eq("user_id", user.id)
        .maybeSingle();
      const legacyRegistrationResult = registrationStatusError
        ? await supabase
            .from("event_registrations")
            .select("id")
            .eq("event_id", loadedEvent.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : null;
      const rawRegistration = registrationData ?? legacyRegistrationResult?.data;
      const status =
        rawRegistration && "status" in rawRegistration
          ? (rawRegistration.status as "pending" | "approved" | "rejected" | null)
          : rawRegistration
          ? "approved"
          : null;
      setRegistrationStatus(status);
      setIsRegistered(status === "approved");

      const title = loadedEvent.title ?? "";
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .ilike("event", title);

      if (teamError) {
        setTeams([]);
        return;
      }

      const eventTeams = (teamData || []) as Team[];
      const rawTeams = eventTeams.filter(
        (team) =>
          team.is_open_to_members !== false &&
          ((team.status ?? "approved") === "approved" ||
            team.owner_id === user.id)
      );
      let memberRows: TeamMember[] = [];

      if (eventTeams.length > 0) {
        const { data: membersData } = await supabase
          .from("team_members")
          .select(
            "id, team_id, user_id, status, profiles(id, full_name, email, student_id, major, academic_year)"
          )
          .in(
            "team_id",
            eventTeams.map((team) => team.id)
          );

        memberRows = (membersData || []) as TeamMember[];
      }

      const currentUserMembership = memberRows.find(
        (member) => member.user_id === user.id && member.status !== "rejected"
      );
      const currentUserTeam = eventTeams.find(
        (team) => team.id === currentUserMembership?.team_id
      );
      setCurrentEventTeamName(currentUserTeam?.name ?? "");

      const teamsWithMembers = rawTeams.map((team) => {
        const members = memberRows
          .filter(
            (member) =>
              member.team_id === team.id &&
              (!member.status || member.status === "approved")
          )
          .map((member) =>
            Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
          )
          .filter(Boolean) as Profile[];

        const requests = ((memberRows || []) as TeamMember[]).filter(
          (member) => member.team_id === team.id && member.user_id === user.id
        );
        const currentUserRequest = requests[0];

        return {
          ...team,
          max_members: Math.min(team.max_members ?? TEAM_MEMBER_LIMIT, TEAM_MEMBER_LIMIT),
          members,
          memberCount: members.length,
          hasRequested: requests.length > 0,
          currentUserMemberId: currentUserRequest?.id ?? null,
          currentUserMemberStatus: currentUserRequest?.status ?? null,
        };
      });

      setTeams(teamsWithMembers);
      setSelectedTeamId(teamsWithMembers[0]?.id ?? null);
    } catch (err) {
      console.error("EVENT DETAILS ERROR:", err);
      setError("Something went wrong while loading this event.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStatusClock((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // Defines the register for event helper used by this screen.
  const registerForEvent = async () => {
    if (!event || !profile) return false;

    if (isCompleted) {
      setError("This event is completed. Registration is closed.");
      return false;
    }

    if (isRegistrationClosed) {
      setError("The registration deadline has passed.");
      return false;
    }

    if (isLockedClubEvent) {
      setError("Only members of this club can join this event.");
      return false;
    }

    const needsClubAdminApproval = Boolean(event.club_id);
    const registrationPayload = {
      event_id: event.id,
      user_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      student_id: profile.student_id,
      major: profile.major,
      academic_year: profile.academic_year,
      status: needsClubAdminApproval ? "pending" : "approved",
    };

    let { error: registrationError } = await supabase
      .from("event_registrations")
      .upsert(
        registrationPayload,
        { onConflict: "event_id,user_id" }
    );

    if (registrationError?.code === "PGRST204") {
      const legacyPayload = {
        event_id: registrationPayload.event_id,
        user_id: registrationPayload.user_id,
        full_name: registrationPayload.full_name,
        email: registrationPayload.email,
        student_id: registrationPayload.student_id,
        major: registrationPayload.major,
        academic_year: registrationPayload.academic_year,
      };
      const retry = await supabase
        .from("event_registrations")
        .upsert(legacyPayload, { onConflict: "event_id,user_id" });
      registrationError = retry.error;
    }

    if (registrationError) {
      setError(
        `${registrationError.message}. Add the event_registrations table from the SQL I provided.`
      );
      return false;
    }

    return true;
  };

  // Handles the join event action for this screen.
  const handleJoinEvent = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const registered = await registerForEvent();
      if (!registered) return;

      const needsApproval = Boolean(event?.club_id);
      setSuccess(
        needsApproval
          ? "Request sent. The club admin can approve or reject it."
          : "You are registered for this event."
      );
      setRegistrationStatus(needsApproval ? "pending" : "approved");
      setIsRegistered(!needsApproval);
      await loadDetails();
    } finally {
      setSaving(false);
    }
  };

  const markExternalEventJoined = useCallback(async () => {
    if (!event || !profile) return false;

    const { error: registrationError } = await supabase
      .from("event_registrations")
      .upsert(
        {
          event_id: event.id,
          user_id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          student_id: profile.student_id,
          major: profile.major,
          academic_year: profile.academic_year,
          status: "approved",
        },
        { onConflict: "event_id,user_id" }
      );

    if (registrationError) {
      setError(registrationError.message);
      return false;
    }

    setRegistrationStatus("approved");
    setIsRegistered(true);
    setSuccess(isTeamBased ? "Marked as joined as group." : "Marked as joined.");
    return true;
  }, [event, isTeamBased, profile]);

  const askAboutExternalRegistration = useCallback(async () => {
    if (!event) return;

    const raw = window.localStorage.getItem(EXTERNAL_JOIN_STORAGE_KEY);
    if (!raw) return;

    let pending: PendingExternalJoin | null = null;
    try {
      pending = JSON.parse(raw) as PendingExternalJoin;
    } catch {
      window.localStorage.removeItem(EXTERNAL_JOIN_STORAGE_KEY);
      return;
    }

    if (pending?.eventId !== event.id) return;
    if (Date.now() - (pending.openedAt ?? 0) < 1500) return;

    setPendingExternalJoin(pending);
  }, [event]);

  // Confirms external registration and updates the registration state.
  const confirmExternalRegistration = async (completed: boolean) => {
    window.localStorage.removeItem(EXTERNAL_JOIN_STORAGE_KEY);
    setPendingExternalJoin(null);

    if (completed) {
      await markExternalEventJoined();
    } else {
      setSuccess("No problem. The event was not marked as joined.");
    }
  };

  useEffect(() => {
    // Handles the return action for this screen.
    const handleReturn = () => {
      if (document.visibilityState === "visible") {
        void askAboutExternalRegistration();
      }
    };

    window.addEventListener("focus", handleReturn);
    document.addEventListener("visibilitychange", handleReturn);

    return () => {
      window.removeEventListener("focus", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };
  }, [askAboutExternalRegistration]);

  // Handles the external join event action for this screen.
  const handleExternalJoinEvent = () => {
    if (!event?.source_url) {
      setError("This event does not have an external registration link yet.");
      return;
    }

    setError("");
    setSuccess("Register on the external site, then come back to Sharek.");
    window.localStorage.setItem(
      EXTERNAL_JOIN_STORAGE_KEY,
      JSON.stringify({
        eventId: event.id,
        title: event.title || "this event",
        url: event.source_url,
        openedAt: Date.now(),
      } satisfies PendingExternalJoin)
    );
    window.open(event.source_url, "_blank", "noopener,noreferrer");
  };

  // Handles the leave event action for this screen.
  const handleLeaveEvent = async () => {
    if (!event || !profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data: deletedRows, error: leaveError } = await supabase
        .from("event_registrations")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", profile.id)
        .select("id");

      if (leaveError) {
        setError(leaveError.message);
        return;
      }

      if (!deletedRows || deletedRows.length === 0) {
        setError(
          "Could not leave this event yet. The database needs the event registration delete policy."
        );
        return;
      }

      setIsRegistered(false);
      setRegistrationStatus(null);
      setSuccess("You left this event.");
      await loadDetails();
    } finally {
      setSaving(false);
    }
  };

  // Handles the request join team action for this screen.
  const handleRequestJoinTeam = async (team: TeamWithMembers) => {
    if (!profile || !event) return;

    if (team.memberCount >= TEAM_MEMBER_LIMIT) {
      setError("This team is already full.");
      return;
    }

    if (currentEventTeamName) {
      setError(`You are already in ${currentEventTeamName} for this event.`);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const registered = await registerForEvent();
      if (!registered) return;

      const { error: requestError } = await supabase.from("team_members").upsert(
        {
          team_id: team.id,
          user_id: profile.id,
          status: "pending",
        },
        { onConflict: "team_id,user_id" }
      );

      if (requestError) {
        setError(
          `${requestError.message}. Add the team_members table from the SQL I provided.`
        );
        return;
      }

      setSuccess(`Request sent to ${team.name}.`);
      await loadDetails();
    } finally {
      setSaving(false);
    }
  };

  // Handles the cancel join request action for this screen.
  const handleCancelJoinRequest = async (team: TeamWithMembers) => {
    if (!team.currentUserMemberId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: cancelError } = await supabase
        .from("team_members")
        .delete()
        .eq("id", team.currentUserMemberId);

      if (cancelError) {
        setError(cancelError.message);
        return;
      }

      setSuccess(`Request to join ${team.name} was cancelled.`);
      await loadDetails();
    } finally {
      setSaving(false);
    }
  };

  // Handles the create team action for this screen.
  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!event || !profile) return;

    const cleanName = teamName.trim();
    const cleanDescription = teamDescription.trim();
    const isOpenToMembers = needsMoreMembers === "yes";
    const cleanNeededSkills = isOpenToMembers ? neededSkills.trim() : "";
    const requestedMemberIds = Array.from(
      new Set(memberStudentIds.match(/\d{8}/g) ?? [])
    ).filter((studentId) => studentId !== profile.student_id);
    const selectedMaxMembers = Math.min(
      Math.max(Number(maxMembers) || TEAM_MEMBER_LIMIT, 2),
      TEAM_MEMBER_LIMIT
    );
    const memberSlots = selectedMaxMembers - 1;

    if (!cleanName || !cleanDescription) {
      setError("Team name and description are required.");
      return;
    }

    if (currentEventTeamName) {
      setError(`You are already in ${currentEventTeamName} for this event.`);
      return;
    }

    if (isOpenToMembers && !cleanNeededSkills) {
      setError("Tell students what kind of member your team needs.");
      return;
    }

    if (requestedMemberIds.length > memberSlots) {
      setError(`You can add up to ${memberSlots} other members for this team.`);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const registered = await registerForEvent();
      if (!registered) return;

      let invitedProfiles: Profile[] = [];

      if (requestedMemberIds.length > 0) {
        const { data: matchedProfiles, error: profileLookupError } = await supabase
          .from("profiles")
          .select("id, full_name, email, student_id, major, academic_year")
          .in("student_id", requestedMemberIds);

        if (profileLookupError) {
          setError(profileLookupError.message);
          return;
        }

        invitedProfiles = (matchedProfiles || []) as Profile[];

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
          .ilike("event", event.title ?? "");

        const eventTeamRows = (eventTeams || []) as Pick<Team, "id" | "name">[];

        if (eventTeamRows.length > 0) {
          const { data: existingMemberships, error: membershipError } =
            await supabase
              .from("team_members")
              .select("team_id, user_id, status")
              .in(
                "team_id",
                eventTeamRows.map((team) => team.id)
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
      }

      const { data: createdTeam, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: cleanName,
          event: event.title,
          description: cleanDescription,
          needed_skills: cleanNeededSkills || null,
          is_open_to_members: isOpenToMembers,
          max_members: selectedMaxMembers,
          status: "pending",
          owner_id: profile.id,
        })
        .select()
        .single();

      if (teamError || !createdTeam) {
        setError(teamError?.message || "Could not create team.");
        return;
      }

      const memberRows = [
        {
          team_id: createdTeam.id,
          user_id: profile.id,
          status: "approved",
        },
        ...invitedProfiles.map((member) => ({
          team_id: createdTeam.id,
          user_id: member.id,
          status: "invited",
        })),
      ];

      const { error: memberError } = await supabase
        .from("team_members")
        .upsert(memberRows, { onConflict: "team_id,user_id" });

      if (memberError) {
        setError(
          `Team created, but adding members failed: ${memberError.message}.`
        );
        return;
      }

      const addedCount = memberRows.length;
      setSuccess(
        addedCount === 1
          ? "Team created and sent for admin approval."
          : `Team created and sent for admin approval. Invites were sent to ${addedCount - 1} student(s).`
      );
      setTeamName("");
      setTeamDescription("");
      setNeededSkills("");
      setNeedsMoreMembers("yes");
      setMemberStudentIds("");
      setMaxMembers(String(TEAM_MEMBER_LIMIT));
      await loadDetails();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <AppNavbar />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/events"
          className="text-sm font-medium text-[#1e3a8a] hover:underline"
        >
          Back to events
        </Link>

        {loading && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading event details...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {!loading && event && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                {eventImageUrl && (
                  <img
                    src={eventImageUrl}
                    alt={event.title || "Event image"}
                    className="mb-6 h-auto max-h-[720px] w-full rounded-lg object-contain"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {eventCategoryLabel}
                  </span>
                  <span className={eventTypeBadgeClass}>
                    {eventTypeLabel}
                  </span>
                  {event.is_university_event && responsibleClub && (
                    <span className={eventTypeBadgeClass}>
                      {responsibleClubName}
                    </span>
                  )}
                  {isClubMembersOnly && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Club members only
                    </span>
                  )}
                  {event.prize && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Prize: {event.prize}
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(
                      eventStatus
                    )}`}
                  >
                    {formatTagLabel(eventStatus)}
                  </span>
                </div>

                <h1 className="mt-4 text-3xl font-bold text-slate-950">
                  {event.title || "Untitled Event"}
                </h1>

                <p className="mt-4 leading-7 text-slate-600">
                  {event.description || "No description available."}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Date
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {formatDateRange(eventDate, eventEndDate)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Time
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{timeLabel}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Register By
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {formatDateTime(registrationDeadline)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Location
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {event.location || "TBA"}
                    </p>
                  </div>
                  {event.location_details && (
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Location Details
                      </p>
                      <p className="mt-1 whitespace-pre-wrap font-medium text-slate-800">
                        {event.location_details}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Registration
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {event.registered_count ?? 0}
                      {event.max_capacity ? ` / ${event.max_capacity}` : ""}
                    </p>
                  </div>
                  {event.prize && (
                    <div className="rounded-lg bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase text-emerald-500">
                        Prize
                      </p>
                      <p className="mt-1 font-medium text-emerald-800">
                        {event.prize}
                      </p>
                    </div>
                  )}
                  {event.is_university_event && responsibleClub && (
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Responsible club
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {responsibleClubName}
                      </p>
                    </div>
                  )}
                </div>

                {(event.location || event.location_details) && (
                  <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Event Location
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {event.location || "TBA"}
                        </p>
                        {event.location_details && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {event.location_details}
                          </p>
                        )}
                      </div>

                      {mapLink && (
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[#1e3a8a] transition hover:bg-slate-50"
                        >
                          Open in Maps
                        </a>
                      )}
                    </div>

                    {mapEmbedUrl && (
                      <iframe
                        title="Event location map"
                        src={mapEmbedUrl}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="mt-4 h-72 w-full rounded-lg border border-slate-200"
                      />
                    )}
                  </div>
                )}

                {event.source_url && (
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open source link
                  </a>
                )}
              </article>

              {isTeamBased && !usesExternalRegistration ? (
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-950">
                    Available teams
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    View members and request to join the team that fits you.
                  </p>
                  {isCompleted && (
                    <p className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                      This event is completed. Team requests are closed.
                    </p>
                  )}
                  {isRegistrationClosed && !isCompleted && (
                    <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                      Registration closed on {formatDateTime(registrationDeadline)}.
                    </p>
                  )}
                  {isLockedClubEvent && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                      Only members of the responsible club can join or create
                      teams for this event.
                    </p>
                  )}
                  {currentEventTeamName && (
                    <p className="mt-3 rounded-lg bg-[#eef3ff] px-4 py-3 text-sm font-medium text-[#1e3a8a]">
                      You are already in {currentEventTeamName} for this event.
                    </p>
                  )}

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelectedTeamId(team.id)}
                        className={`rounded-lg border p-4 text-left transition ${
                          selectedTeam?.id === team.id
                            ? "border-[#1e3a8a] bg-[#eef3ff]"
                            : "border-slate-200 bg-white hover:border-[#1e3a8a]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">{team.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {team.memberCount} / {TEAM_MEMBER_LIMIT} members
                            </p>
                          </div>
                          {team.status === "pending" && team.owner_id === profile?.id && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                              Pending approval
                            </span>
                          )}
                          {team.hasRequested && (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                              Requested
                            </span>
                          )}
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                          {team.description || "No description added."}
                        </p>
                        {team.memberCount >= TEAM_MEMBER_LIMIT && (
                          <span className="mt-3 inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                            Full
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-950">
                    {registrationStatus === "pending"
                      ? "Request pending"
                      : isRegistered
                      ? isTeamBased
                        ? "You joined as a group"
                        : "You are registered"
                      : "Join this event"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {isLockedClubEvent
                      ? "You need to join the responsible club before registering for this event."
                      : usesExternalRegistration && !isRegistered
                      ? "This event uses an external registration site. Sharek will ask you to confirm after you come back."
                      : registrationStatus === "pending"
                      ? "Your request is waiting for the club admin to approve it."
                      : registrationStatus === "rejected"
                      ? "Your previous request was rejected. You can send another request if registration is still open."
                      : isRegistered
                      ? "You can leave this event if you no longer want to participate."
                      : "Your name, email, student ID, major, and academic year will be copied from your profile into the event registration."}
                  </p>
                  <button
                    type="button"
                    onClick={
                      isRegistered || registrationStatus === "pending"
                        ? handleLeaveEvent
                        : usesExternalRegistration
                        ? handleExternalJoinEvent
                        : handleJoinEvent
                    }
                    disabled={saving || isCompleted || isRegistrationClosed || isLockedClubEvent}
                    className={`mt-5 rounded-lg px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isRegistered || registrationStatus === "pending"
                        ? "bg-red-600"
                        : "bg-[#1e3a8a]"
                    }`}
                  >
                    {isCompleted
                      ? "Completed"
                      : isRegistrationClosed
                      ? "Registration closed"
                      : isLockedClubEvent
                      ? "Club members only"
                      : saving
                      ? isRegistered
                        ? "Leaving..."
                        : registrationStatus === "pending"
                        ? "Cancelling..."
                        : "Joining..."
                      : registrationStatus === "pending"
                      ? "Cancel request"
                      : isRegistered
                      ? isTeamBased
                        ? "Leave group event"
                        : "Leave event"
                      : usesExternalRegistration
                      ? "Open registration link"
                      : event.club_id
                      ? "Request to join"
                      : "Join event"}
                  </button>
                </section>
              )}
            </div>

            <aside className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">Your profile</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-950">
                  <p>
                    <span className="font-semibold text-slate-700">Name: </span>
                    {profile?.full_name || "Not added"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Student ID: </span>
                    {profile?.student_id || "Not added"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Major: </span>
                    {profile?.major || "Not added"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Year: </span>
                    {profile?.academic_year || "Not added"}
                  </p>
                </div>
              </div>

              {isTeamBased && selectedTeam && (
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-950">
                    {selectedTeam.name}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedTeam.description || "No description added."}
                  </p>
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Needed skills
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {selectedTeam.needed_skills || "Not specified"}
                    </p>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Members
                    </p>
                    <div className="mt-3 space-y-2">
                      {selectedTeam.members.length > 0 ? (
                        selectedTeam.members.map((member) => (
                          <div
                            key={member.id}
                            className="rounded-lg border border-slate-200 px-3 py-2"
                          >
                            <p className="text-sm font-semibold text-slate-800">
                              {member.full_name || "Student"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {member.major || "Major not added"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          Members will appear after the team membership table is added.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      selectedTeam.currentUserMemberStatus === "pending"
                        ? handleCancelJoinRequest(selectedTeam)
                        : handleRequestJoinTeam(selectedTeam)
                    }
                    disabled={
                      saving ||
                      (selectedTeam.hasRequested &&
                        selectedTeam.currentUserMemberStatus !== "pending") ||
                      (Boolean(currentEventTeamName) &&
                        selectedTeam.currentUserMemberStatus !== "pending") ||
                      selectedTeam.memberCount >= TEAM_MEMBER_LIMIT ||
                      isCompleted ||
                      isRegistrationClosed ||
                      isLockedClubEvent
                    }
                    className="mt-5 w-full rounded-lg bg-[#1e3a8a] px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCompleted
                      ? "Completed"
                      : isRegistrationClosed
                      ? "Registration closed"
                      : isLockedClubEvent
                      ? "Club members only"
                      : selectedTeam.currentUserMemberStatus === "pending"
                      ? saving
                        ? "Cancelling..."
                        : "Cancel request"
                      : currentEventTeamName
                      ? "Already in a team"
                      : selectedTeam.memberCount >= TEAM_MEMBER_LIMIT
                      ? "Team full"
                      : selectedTeam.hasRequested
                      ? "Request sent"
                      : saving
                      ? "Sending..."
                      : "Request to join"}
                  </button>
                </div>
              )}

              {isTeamBased && (
                <form
                  onSubmit={handleCreateTeam}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-slate-950">
                    Create your own team
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {isLockedClubEvent
                      ? "Join the responsible club before creating a team."
                      : "You will be the team owner and first member."}
                  </p>
                  <div className="mt-4 space-y-3">
                    <input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Team name"
                      className={inputClass}
                    />
                    <textarea
                      value={teamDescription}
                      onChange={(e) => setTeamDescription(e.target.value)}
                      placeholder="Team description"
                      rows={4}
                      className={inputClass}
                    />
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-700">
                        Do you need more members?
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label
                          className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                            needsMoreMembers === "yes"
                              ? "border-[#1e3a8a] bg-[#eef3ff] text-[#1e3a8a]"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          <input
                            type="radio"
                            name="needsMoreMembers"
                            value="yes"
                            checked={needsMoreMembers === "yes"}
                            onChange={(e) => setNeedsMoreMembers(e.target.value)}
                            className="sr-only"
                          />
                          Yes
                        </label>
                        <label
                          className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                            needsMoreMembers === "no"
                              ? "border-[#1e3a8a] bg-[#eef3ff] text-[#1e3a8a]"
                              : "border-slate-200 text-slate-600"
                          }`}
                        >
                          <input
                            type="radio"
                            name="needsMoreMembers"
                            value="no"
                            checked={needsMoreMembers === "no"}
                            onChange={(e) => {
                              setNeedsMoreMembers(e.target.value);
                              setNeededSkills("");
                            }}
                            className="sr-only"
                          />
                          No
                        </label>
                      </div>
                    </div>
                    {needsMoreMembers === "yes" && (
                      <textarea
                        value={neededSkills}
                        onChange={(e) => setNeededSkills(e.target.value)}
                        placeholder="What do you need in this member? e.g. frontend, backend, presentation"
                        rows={3}
                        className={inputClass}
                      />
                    )}
                    <textarea
                      value={memberStudentIds}
                      onChange={(e) => setMemberStudentIds(e.target.value)}
                      placeholder="Member Student IDs, e.g. 20210083, 20210049"
                      rows={3}
                      className={inputClass}
                    />
                    <p className="text-xs leading-5 text-slate-500">
                      Add up to 5 other students. The system will match them by
                      Student ID and add them to your team.
                    </p>
                    <input
                      type="number"
                      min="2"
                      max={TEAM_MEMBER_LIMIT}
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(e.target.value)}
                      placeholder="Max members"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      Boolean(currentEventTeamName) ||
                      isCompleted ||
                      isRegistrationClosed ||
                      isLockedClubEvent
                    }
                    className="mt-4 w-full rounded-lg bg-[#1e3a8a] px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCompleted
                      ? "Completed"
                      : isRegistrationClosed
                      ? "Registration closed"
                      : isLockedClubEvent
                      ? "Club members only"
                      : currentEventTeamName
                      ? "Already in a team"
                      : saving
                      ? "Creating..."
                      : "Create team"}
                  </button>
                </form>
              )}
            </aside>
          </div>
        )}
      </section>
      {pendingExternalJoin && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">
              External registration
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Did you register?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Did you finish registering for{" "}
              <span className="font-semibold text-slate-700">
                {pendingExternalJoin.title}
              </span>{" "}
              on the external event website?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => confirmExternalRegistration(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => confirmExternalRegistration(true)}
                className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af]"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
