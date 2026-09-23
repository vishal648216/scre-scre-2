/** Build-time cutover: set `VITE_USE_EXAM_V2=true` in `.env` / deployment. */
export const USE_EXAM_V2 = import.meta.env.VITE_USE_EXAM_V2 === "true";
