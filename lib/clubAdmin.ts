import { supabase } from "./supabase";

export type ManagedClub = {
  id: string;
  name: string | null;
  title: string | null;
  category: string | null;
  description?: string | null;
};

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

  if (profileError || !profile?.is_club_admin) {
    return {
      userId: null,
      managedClub: null,
      error: "You do not have club admin access.",
    };
  }

  const membershipResult = await supabase
    .from("club_members")
    .select("club_id, clubs(id, name, title, category, description)")
    .eq("user_id", user.id)
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
    return {
      userId: null,
      managedClub: null,
      error: "No managed club was found for this club admin.",
    };
  }

  return {
    userId: user.id,
    managedClub: managedClubData as ManagedClub,
    error: null,
  };
}
