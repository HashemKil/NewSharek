import { supabase } from "./supabase";
import { getCachedJoinedClubs } from "./clubMembership";

export type ManagedClub = {
  id: string;
  name: string | null;
  title: string | null;
  category: string | null;
  description?: string | null;
  president?: string | null;
  logo_url?: string | null;
};

async function getLegacyManagedClub(userId: string): Promise<ManagedClub | null> {
  const membershipResult = await supabase
    .from("club_members")
    .select("club_id, clubs(id, name, title, category, description)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const managedClubData =
    membershipResult.data &&
    typeof membershipResult.data === "object" &&
    "clubs" in membershipResult.data
      ? Array.isArray(membershipResult.data.clubs)
        ? membershipResult.data.clubs[0]
        : membershipResult.data.clubs
      : null;

  if (membershipResult.error || !managedClubData?.id) {
    const cachedClub = getCachedJoinedClubs(userId)[0];
    return cachedClub
      ? {
          id: cachedClub.id,
          name: cachedClub.name ?? null,
          title: cachedClub.title ?? null,
          category: cachedClub.category ?? null,
          description: null,
          president: null,
          logo_url: null,
        }
      : null;
  }

  return managedClubData as ManagedClub;
}

type ClubAdminContext =
  | {
      userId: string;
      managedClub: ManagedClub;
      error: null;
    }
  | {
      userId: null;
      managedClub: null;
      error: string;
    };

export async function getClubAdminContext(): Promise<ClubAdminContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      userId: null,
      managedClub: null,
      error: "You must be signed in to access club admin tools.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_club_admin")
    .eq("id", user.id)
    .maybeSingle();
  const hasClubAdminRole = !profileError && profile?.is_club_admin === true;

  const { data: managedClubData, error: managedClubError } = await supabase
    .from("clubs")
    .select("id, name, title, category, description, president, logo_url")
    .eq("club_admin_id", user.id)
    .limit(1)
    .maybeSingle();

  if (managedClubError || !managedClubData?.id) {
    const legacyManagedClub = await getLegacyManagedClub(user.id);
    if (legacyManagedClub?.id) {
      return {
        userId: user.id,
        managedClub: legacyManagedClub,
        error: null,
      };
    }

    if (!hasClubAdminRole) {
      return {
        userId: null,
        managedClub: null,
        error: "You do not have club admin access.",
      };
    }

    return {
      userId: null,
      managedClub: null,
      error: "No club is assigned to this club admin yet.",
    };
  }

  return {
    userId: user.id,
    managedClub: managedClubData as ManagedClub,
    error: null,
  };
}
