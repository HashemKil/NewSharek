import { supabase } from "./supabase";

export type ManagedClub = {
  id: string;
  name: string | null;
  title?: string | null;
  category: string | null;
  description?: string | null;
  logo_url?: string | null;
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
  const hasClubAdminRole = !profileError && profile?.is_club_admin === true;

  const { data: managedClubData, error: managedClubError } = await supabase
    .from("clubs")
    .select("id, name, category, description, logo_url")
    .eq("club_admin_id", user.id)
    .limit(1)
    .maybeSingle();

  if (managedClubError || !managedClubData?.id) {
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
