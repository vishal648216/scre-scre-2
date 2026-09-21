/** Labels for admin + public course type values (API uses snake_case). */
export const COURSE_TYPE_OPTIONS = [
  { value: "degree", label: "Degree" },
  { value: "diploma", label: "Diploma" },
  { value: "crash_course", label: "Crash Course" },
  { value: "certification", label: "Certification" },
] as const;

export function courseTypeLabel(type?: string): string {
  if (!type) return "Program";
  return COURSE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type.replace(/_/g, " ");
}

/** Plain text for cards / previews when description is HTML. */
export function stripHtml(html?: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function formatCourseDuration(course: {
  duration_months?: number;
  duration_value?: number;
  duration_unit?: string;
}): string {
  const hasExplicit =
    typeof course.duration_value === "number" && course.duration_value > 0 && course.duration_unit;
  const value = hasExplicit ? course.duration_value! : (course.duration_months ?? 0);
  const unit = hasExplicit ? String(course.duration_unit) : "months";
  if (value <= 0) return "—";
  const u =
    unit === "years"
      ? "Year"
      : unit === "weeks"
      ? "Week"
      : unit === "days"
      ? "Day"
      : unit === "hours"
      ? "Hour"
      : "Month";
  return `${value} ${u}${value === 1 ? "" : "s"}`;
}
