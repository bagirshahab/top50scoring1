// =====================================================================
//  POST /api/import-works  (ADMIN)
//  Import project submissions exported from the Top 20 submission form.
//
//  body: { rows: [ {team_number, team_name, project_title, website_url, repo_url,
//                   video_url, submitted_at?}, ... ],
//          dry_run: true|false }
//
//  Rules
//   - Resubmissions: rows are grouped by team_number and the LATEST one wins
//     (by submitted_at when present, otherwise the later row in the file).
//   - A project that already exists with the same team_number is UPDATED
//     (keeps its code, presentation position, scores, fallback flag and screenshot).
//     New team numbers are ADDED at the end of the order.
//   - dry_run=true only returns the plan, nothing is written.
// =====================================================================
import { sql, setCors, parseBody, requireRole, nextWorkCode } from "./_lib.js";
import { cleanUrl, cleanOptionalUrl, parseBool, parseTeamNumber } from "./_works-util.js";

const ALIASES = {
  team_number: ["team_number", "team_no", "team_num", "team_id", "number", "no"],
  team_name: ["team_name", "name", "team"],
  project_title: ["project_title", "title", "project_name", "project"],
  category: ["category", "theme"],
  website_url: ["website_url", "website", "project_url", "url", "link", "web_link"],
  repo_url: ["repo_url", "repo", "repository", "repository_url", "github"],
  video_url: ["video_url", "video"],
  submitted_at: ["submitted_at", "updated_at", "created_at", "timestamp", "submitted", "date", "time"],
};

function normKeys(row) {
  const o = {};
  for (const k of Object.keys(row || {})) {
    o[k.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")] = row[k];
  }
  return o;
}
function pick(o, field) {
  for (const n of ALIASES[field]) {
    if (o[n] !== undefined && o[n] !== null && String(o[n]).trim() !== "") return o[n];
  }
  return undefined;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const admin = requireRole(req, res, "admin");
  if (!admin) return;

  try {
    const body = parseBody(req);
    const dryRun = body.dry_run !== false;
    const rawRows = Array.isArray(body.rows) ? body.rows : [];
    if (!rawRows.length) return res.status(400).json({ error: "No rows to import." });
    if (rawRows.length > 500) return res.status(400).json({ error: "Too many rows (max 500)." });

    const errors = [];
    const warnings = [];

    // 1) Normalise + validate each row
    const valid = [];
    rawRows.forEach((raw, i) => {
      const line = i + 1;
      const o = normKeys(raw);
      const tn = parseTeamNumber(pick(o, "team_number"));
      if (tn === null) { errors.push(`Row ${line}: team number is missing or not 1-99.`); return; }
      const url = cleanUrl(pick(o, "website_url"));
      if (!url) { errors.push(`Row ${line} (team ${tn}): website link is missing or invalid.`); return; }
      const team = String(pick(o, "team_name") || "").trim();
      const title = String(pick(o, "project_title") || "").trim();
      if (!team || !title) { errors.push(`Row ${line} (team ${tn}): team name or project title is missing.`); return; }
      const repo = cleanOptionalUrl(pick(o, "repo_url"));
      const video = cleanOptionalUrl(pick(o, "video_url"));
      if (!repo.ok) warnings.push(`Row ${line} (team ${tn}): repository link ignored (invalid).`);
      if (!video.ok) warnings.push(`Row ${line} (team ${tn}): video link ignored (invalid).`);
      const tsRaw = pick(o, "submitted_at");
      const ts = tsRaw ? new Date(tsRaw).getTime() : NaN;
      valid.push({
        line, ts,
        team_number: tn, team_name: team.slice(0, 200), project_title: title.slice(0, 300),
        category: pick(o, "category") ? String(pick(o, "category")).trim().slice(0, 200) : null,
        project_url: url,
        repo_url: repo.ok ? repo.value : null,
        video_url: video.ok ? video.value : null,
      });
    });

    // 2) Resubmissions: latest row per team number wins
    const byTeam = new Map();
    const resubmitted = new Map();
    for (const r of valid) {
      const prev = byTeam.get(r.team_number);
      if (!prev) { byTeam.set(r.team_number, r); continue; }
      resubmitted.set(r.team_number, (resubmitted.get(r.team_number) || 1) + 1);
      const newer = !isNaN(r.ts) && !isNaN(prev.ts) ? r.ts >= prev.ts : r.line > prev.line;
      if (newer) byTeam.set(r.team_number, r);
      if (prev.team_name.toLowerCase() !== r.team_name.toLowerCase()) {
        warnings.push(`Team number ${r.team_number} is used by different team names ("${prev.team_name}" and "${r.team_name}"). The latest submission was kept. Please verify.`);
      }
    }
    for (const [tn, n] of resubmitted) warnings.push(`Team ${tn}: ${n} submissions found, the latest one is used.`);

    const incoming = [...byTeam.values()].sort((a, b) => a.team_number - b.team_number);

    // 3) Compare with what is already in the database
    const existing = await sql`SELECT id, team_number, project_url FROM pjt_works`;
    const existingByTeam = new Map(existing.filter((e) => e.team_number != null).map((e) => [e.team_number, e]));
    const toAdd = incoming.filter((r) => !existingByTeam.has(r.team_number));
    const toUpdate = incoming.filter((r) => existingByTeam.has(r.team_number));

    const plan = incoming.map((r) => ({
      action: existingByTeam.has(r.team_number) ? "update" : "add",
      team_number: r.team_number, team_name: r.team_name, project_title: r.project_title, project_url: r.project_url,
      has_video: !!r.video_url, has_repo: !!r.repo_url,
      url_changed: existingByTeam.has(r.team_number) && existingByTeam.get(r.team_number).project_url !== r.project_url,
    }));
    const summary = { add: toAdd.length, update: toUpdate.length, skipped: errors.filter((e) => e.startsWith("Row")).length };

    if (dryRun || errors.some((e) => !e.startsWith("Row"))) {
      return res.status(200).json({ dry_run: true, applied: false, plan, summary, errors, warnings });
    }

    // 4) Apply
    for (const r of toUpdate) {
      const e = existingByTeam.get(r.team_number);
      await sql`
        UPDATE pjt_works SET
          team_name = ${r.team_name}, project_title = ${r.project_title},
          category = COALESCE(${r.category}, category),
          link_ok         = CASE WHEN project_url IS DISTINCT FROM ${r.project_url} THEN NULL ELSE link_ok END,
          link_status     = CASE WHEN project_url IS DISTINCT FROM ${r.project_url} THEN NULL ELSE link_status END,
          link_note       = CASE WHEN project_url IS DISTINCT FROM ${r.project_url} THEN NULL ELSE link_note END,
          link_checked_at = CASE WHEN project_url IS DISTINCT FROM ${r.project_url} THEN NULL ELSE link_checked_at END,
          project_url = ${r.project_url},
          repo_url = ${r.repo_url}, video_url = ${r.video_url}
        WHERE id = ${e.id}
      `;
    }
    for (const r of toAdd) {
      const code = await nextWorkCode();
      await sql`
        INSERT INTO pjt_works
          (code, team_name, project_title, category, project_url, position,
           team_number, repo_url, video_url)
        VALUES (${code}, ${r.team_name}, ${r.project_title}, ${r.category}, ${r.project_url},
                (SELECT COALESCE(MAX(position), 0) + 1 FROM pjt_works),
                ${r.team_number}, ${r.repo_url}, ${r.video_url})
      `;
    }
    return res.status(200).json({ dry_run: false, applied: true, plan, summary, errors, warnings });
  } catch (err) {
    console.error("import-works error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
