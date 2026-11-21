// =====================================================================
//  Shared validation helpers for project (work) fields.
//  Files starting with "_" are not exposed as API routes by Vercel.
// =====================================================================

export const MAX_WORKS = 20;

// Public hostnames only: no IP literals, localhost, or internal suffixes.
export function isPublicHost(host) {
  const h = String(host || "").toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (h.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(h);
}

// Absolute http(s) link with a public host. https:// is added when missing. Returns string or null.
export function cleanUrl(raw) {
  let s = (raw == null ? "" : String(raw)).trim();
  if (!s || s.length > 2000 || /\s/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    if (!isPublicHost(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Optional link: empty -> {ok:true, value:null}; filled but invalid -> {ok:false}
export function cleanOptionalUrl(raw) {
  if (raw == null || String(raw).trim() === "") return { ok: true, value: null };
  const v = cleanUrl(raw);
  return v ? { ok: true, value: v } : { ok: false, value: null };
}

// yes/no style values -> true / false / null (unknown)
export function parseBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "ya", "1", "ใช่", "used"].includes(s)) return true;
  if (["false", "no", "n", "tidak", "0", "ไม่", "not used"].includes(s)) return false;
  return null;
}

// 1..99 integer or null
export function parseTeamNumber(v) {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim().replace(/^#/, "");
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 99 ? n : null;
}

// Read + validate the editable fields of a project from a request body.
// Returns { error } or { value }.
export function readWorkFields(body) {
  const team = (body.team_name || "").toString().trim();
  const title = (body.project_title || "").toString().trim();
  const cat = (body.category || "").toString().trim();
  if (!team || !title) return { error: "Team name and project title are required." };
  if (team.length > 200 || title.length > 300 || cat.length > 200) return { error: "Team name, title, or theme is too long." };

  const url = cleanUrl(body.project_url);
  if (!url) return { error: "Please enter a valid project link (https://...)." };

  let teamNumber = null;
  if (body.team_number != null && String(body.team_number).trim() !== "") {
    teamNumber = parseTeamNumber(body.team_number);
    if (teamNumber === null) return { error: "Team number must be a number from 1 to 99." };
  }

  const repo = cleanOptionalUrl(body.repo_url);
  const video = cleanOptionalUrl(body.video_url);
  const shot = cleanOptionalUrl(body.screenshot_url);
  if (!repo.ok) return { error: "The repository link is not a valid link." };
  if (!video.ok) return { error: "The video link is not a valid link." };
  if (!shot.ok) return { error: "The screenshot link is not a valid link." };

  return {
    value: {
      team_name: team,
      project_title: title,
      category: cat || null,
      project_url: url,
      team_number: teamNumber,
      repo_url: repo.value,
      video_url: video.value,
      screenshot_url: shot.value,
      fallback: body.fallback === true || body.fallback === "true",
    },
  };
}
