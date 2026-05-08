import { supabase } from "./supabase";

type ClubMemberProfile = {
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  major: string | null;
  academic_year: string | null;
};

type ClubSummary = {
  id: string;
  name?: string | null;
  title?: string | null;
  category?: string | null;
};

export type ClubMembershipStatus = "pending" | "approved" | "rejected";

function getStorageKey(userId: string) {
  return `sharek.joinedClubs.${userId}`;
}

function getSummaryStorageKey(userId: string) {
  return `sharek.joinedClubSummaries.${userId}`;
}

function dedupeClubIds(clubIds: string[]) {
  return Array.from(new Set(clubIds.filter(Boolean)));
}

async function loadMemberProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email, student_id, major, academic_year")
    .eq("id", userId)
    .single<ClubMemberProfile>();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Profile not found for this account.");
    }

    throw new Error(error.message);
  }

  return data;
}

function isMissingRpc(error: { message?: string | null; code?: string | null }) {
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

function isMissingStatusColumn(error: { message?: string | null; code?: string | null }) {
  const message = (error.message || "").toLowerCase();
  return (
    (error.code === "PGRST204" || error.code === "42703") &&
    message.includes("status") &&
    message.includes("club_members")
  );
}

export function getCachedJoinedClubIds(userId: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? dedupeClubIds(parsed.filter((value): value is string => typeof value === "string"))
      : [];
  } catch {
    return [];
  }
}

function setCachedJoinedClubIds(userId: string, clubIds: string[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify(dedupeClubIds(clubIds))
  );
}

export function getCachedJoinedClubs(userId: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getSummaryStorageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (club): club is ClubSummary =>
        Boolean(club) &&
        typeof club === "object" &&
        typeof club.id === "string"
    );
  } catch {
    return [];
  }
}

function setCachedJoinedClubs(userId: string, clubs: ClubSummary[]) {
  if (typeof window === "undefined") return;

  const uniqueClubs = Array.from(
    new Map(
      clubs
        .filter((club) => club?.id)
        .map((club) => [club.id, club])
    ).values()
  );

  window.localStorage.setItem(
    getSummaryStorageKey(userId),
    JSON.stringify(uniqueClubs)
  );
}

export function cacheJoinedClub(userId: string, clubId: string) {
  setCachedJoinedClubIds(userId, [...getCachedJoinedClubIds(userId), clubId]);
}

export function cacheJoinedClubSummary(userId: string, club: ClubSummary) {
  if (!club?.id) return;

  setCachedJoinedClubs(userId, [...getCachedJoinedClubs(userId), club]);
  cacheJoinedClub(userId, club.id);
}

export function uncacheJoinedClub(userId: string, clubId: string) {
  setCachedJoinedClubIds(
    userId,
    getCachedJoinedClubIds(userId).filter((id) => id !== clubId)
  );
}

export function uncacheJoinedClubSummary(userId: string, clubId: string) {
  setCachedJoinedClubs(
    userId,
    getCachedJoinedClubs(userId).filter((club) => club.id !== clubId)
  );
  uncacheJoinedClub(userId, clubId);
}

export function mergeJoinedClubIds(userId: string, serverClubIds: string[]) {
  const merged = dedupeClubIds([
    ...serverClubIds,
    ...getCachedJoinedClubIds(userId),
  ]);

  setCachedJoinedClubIds(userId, merged);
  return merged;
}

export async function mergeJoinedClubs(
  userId: string,
  serverClubs: ClubSummary[]
) {
  const cachedClubs = getCachedJoinedClubs(userId);
  const mergedIds = mergeJoinedClubIds(
    userId,
    serverClubs.map((club) => club.id)
  );

  const clubMap = new Map(
    [...cachedClubs, ...serverClubs].map((club) => [club.id, club])
  );
  const missingIds = mergedIds.filter((clubId) => !clubMap.has(clubId));

  if (missingIds.length > 0) {
    const { data, error } = await supabase
      .from("clubs")
      .select("id, name, title, category")
      .in("id", missingIds);

    if (!error) {
      ((data || []) as ClubSummary[]).forEach((club) => {
        clubMap.set(club.id, club);
      });
    }
  }

  const mergedClubs = mergedIds
    .map((clubId) => clubMap.get(clubId))
    .filter(Boolean) as ClubSummary[];

  setCachedJoinedClubs(userId, mergedClubs);
  return mergedClubs;
}

export async function joinClubMembership(clubId: string, userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("club_members")
    .select("status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle<{ status: ClubMembershipStatus | null }>();

  const hasApprovalStatus = !existingError;

  if (existingError && !isMissingStatusColumn(existingError) && !isMissingRpc(existingError)) {
    throw new Error(existingError.message);
  }

  if (!hasApprovalStatus) {
    const rpcResult = await supabase.rpc("join_club", {
      target_club_id: clubId,
    });

    if (!rpcResult.error) {
      cacheJoinedClub(userId, clubId);
      return "approved" as const;
    }
  }

  if (existing?.status === "approved") {
    cacheJoinedClub(userId, clubId);
    return "approved" as const;
  }

  if (existing?.status === "pending") {
    return "pending" as const;
  }

  const profile = await loadMemberProfile(userId);

  const membershipPayload = {
      club_id: clubId,
      user_id: userId,
      full_name: profile.full_name,
      email: profile.email,
      student_id: profile.student_id,
      major: profile.major,
      academic_year: profile.academic_year,
      ...(hasApprovalStatus ? { status: "pending" } : {}),
    };

  const { error } = await supabase.from("club_members").upsert(
    membershipPayload,
    { onConflict: "club_id,user_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("club_members")
    .select(hasApprovalStatus ? "club_id, status" : "club_id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle<{ club_id: string; status?: ClubMembershipStatus | null }>();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    throw new Error("Club join was not saved. Please try again.");
  }

  if (!hasApprovalStatus || membership.status === "approved") {
    cacheJoinedClub(userId, clubId);
    return "approved" as const;
  }

  return "pending" as const;
}

export async function leaveClubMembership(clubId: string, userId: string) {
  const rpcResult = await supabase.rpc("leave_club", {
    target_club_id: clubId,
  });

  if (!rpcResult.error) {
    uncacheJoinedClub(userId, clubId);
    return;
  }

  if (!isMissingRpc(rpcResult.error)) {
    throw new Error(rpcResult.error.message);
  }

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (membership) {
    throw new Error("Club leave was not saved. Please try again.");
  }

  uncacheJoinedClub(userId, clubId);
}
