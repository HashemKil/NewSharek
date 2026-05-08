export const EVENT_CATEGORIES = [
  "Academic",
  "Technology",
  "Career",
  "Competition",
  "Social",
  "Other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

const LEGACY_CATEGORY_MAP: Record<string, EventCategory> = {
  workshop: "Academic",
  seminar: "Academic",
  conference: "Academic",
  training: "Academic",
  hackathon: "Competition",
  competition: "Competition",
  career: "Career",
  social: "Social",
};

export function normalizeEventCategory(category: string | null | undefined) {
  if (!category) return "";

  const cleaned = category.trim();
  return EVENT_CATEGORIES.find(
    (option) => option.toLowerCase() === cleaned.toLowerCase()
  ) ?? LEGACY_CATEGORY_MAP[cleaned.toLowerCase()] ?? "Other";
}

export function inferEventCategory(
  category: string | null | undefined,
  title?: string | null,
  description?: string | null
) {
  const normalized = normalizeEventCategory(category);
  const text = `${title ?? ""} ${description ?? ""}`.toLowerCase();

  if (text.includes("hackathon")) return "Competition";
  if (
    text.includes("competition") ||
    text.includes("contest") ||
    text.includes("challenge") ||
    text.includes("tournament")
  ) {
    return "Competition";
  }
  if (
    text.includes("workshop") ||
    text.includes("seminar") ||
    text.includes("training") ||
    text.includes("conference") ||
    text.includes("lecture")
  ) {
    return "Academic";
  }
  if (
    text.includes("career") ||
    text.includes("internship") ||
    text.includes("job") ||
    text.includes("cv") ||
    text.includes("interview")
  ) {
    return "Career";
  }
  if (
    text.includes("social") ||
    text.includes("gathering") ||
    text.includes("meetup") ||
    text.includes("trip") ||
    text.includes("night")
  ) {
    return "Social";
  }
  if (
    text.includes("technology") ||
    text.includes("software") ||
    text.includes("coding") ||
    text.includes("programming") ||
    text.includes("cyber") ||
    text.includes("robotics") ||
    text.includes("ai ")
  ) {
    return "Technology";
  }

  return normalized || "Other";
}
