export function formatTagLabel(value: string | null | undefined) {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return "";

  return cleaned
    .split(/([\s_-]+)/)
    .map((part) => {
      if (/^[\s_-]+$/.test(part)) return part.replace(/_/g, " ");
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("")
    .replace(/\s+/g, " ");
}
