// =====================================================================
//  Submission-form sync
//
//  Pulls the Top 20 form submissions into the judging list automatically.
//  Source (READ ONLY, never written): the view  submissions_top20_current,
//  which holds ONE row per email address, the latest submission winning.
//
//  A team is identified by a hash of its email, so a resubmission updates the same
//  project even if the team changes its name. (Only the hash is stored.)
//  The form has no team number any more, so none is read or shown.
//
//  Rules
//   - New email                  -> project added at the end of the order (no limit on how many).
//   - Known email                -> updated ONLY when the form row is newer than the one applied
//                                   last time, so an admin's manual fix (link, fallback,
//                                   screenshot, order) survives until the team resubmits.
//   - Admin deleted the project  -> not re-added until that team submits again (pjt_sync_ignore).
//   - Never deletes anything, never touches position, fallback, screenshot or scores.
//
//  Runs when the project list is loaded (throttled), and on demand (Sync now).
//  A failure here is logged and reported but never breaks the page that called it.
// =====================================================================
import { createHash } from "node:crypto";
import { sql, nextWorkCode } from "./_lib.js";
import { cleanUrl, cleanOptionalUrl } from "./_works-util.js";

const THROTTLE_MS = 15000;
let lastRun = 0;
let lastResult = null;

const cleanNotes = (v) => { const s = String(v ?? "").trim().slice(0, 4000); return s || null; };
const ts = (v) => (v ? new Date(v).getTime() : 0);
export const sourceKey = (email) => createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex");

export async function syncSubmissions({ force = false, dryRun = false } = {}) {
  const now = Date.now();
  if (!force && !dryRun && now - lastRun < THROTTLE_MS && lastResult) return { ...lastResult, throttled: true };

  const result = { ok: true, added: 0, updated: 0, unchanged: 0, skipped: [], warnings: [], plan: [], at: new Date().toISOString() };
  try {
    const rows = await sql`SELECT * FROM submissions_top20_current ORDER BY submitted_at`;
    const existing = await sql`SELECT id, source_key, source_submitted_at FROM pjt_works`;
    const byKey = new Map(existing.filter((e) => e.source_key).map((e) => [e.source_key, e]));
    // Team notes (login hints, how to try the app). Only the table has them; the view does not. Latest row per email wins.
    const noteRows = await sql`SELECT DISTINCT ON (lower(email)) lower(email) AS email, notes FROM submissions_top20 ORDER BY lower(email), created_at DESC, id DESC`;
    const notesByKey = new Map(noteRows.map((n) => [sourceKey(n.email), cleanNotes(n.notes)]));
    const ignored = new Map((await sql`SELECT source_key, submitted_at FROM pjt_sync_ignore`).map((r) => [r.source_key, r.submitted_at]));

    for (const r of rows) {
      const key = sourceKey(r.email);
      const team = String(r.team_name || "").trim().slice(0, 200);
      const title = String(r.project_title || "").trim().slice(0, 300);
      const label = `"${(team || title || "Unnamed").slice(0, 40)}"`;

      if (ignored.has(key) && ts(ignored.get(key)) >= ts(r.submitted_at)) { result.unchanged++; continue; } // dismissed, nothing newer
      const url = cleanUrl(r.website_url);
      if (!url) { result.skipped.push(`${label}: the website link is not a valid public link.`); continue; }
      if (!team || !title) { result.skipped.push(`${label}: team name or project title is empty.`); continue; }
      const repo = cleanOptionalUrl(r.repo_url), video = cleanOptionalUrl(r.video_url);
      if (!repo.ok) result.warnings.push(`${label}: repository link ignored (not a valid link).`);
      if (!video.ok) result.warnings.push(`${label}: video link ignored (not a valid link).`);
      const count = Number(r.submission_count) || 1;

      const ex = byKey.get(key);
      if (ex) {
        if (ex.source_submitted_at && ts(ex.source_submitted_at) >= ts(r.submitted_at)) { result.unchanged++; continue; }
        result.plan.push({ action: "update", team_name: team, project_title: title });
        if (!dryRun) {
          await sql`
            UPDATE pjt_works SET
              team_name = ${team}, project_title = ${title},
              link_ok         = CASE WHEN project_url IS DISTINCT FROM ${url} THEN NULL ELSE link_ok END,
              link_status     = CASE WHEN project_url IS DISTINCT FROM ${url} THEN NULL ELSE link_status END,
              link_note       = CASE WHEN project_url IS DISTINCT FROM ${url} THEN NULL ELSE link_note END,
              link_checked_at = CASE WHEN project_url IS DISTINCT FROM ${url} THEN NULL ELSE link_checked_at END,
              project_url = ${url}, repo_url = ${repo.ok ? repo.value : null}, video_url = ${video.ok ? video.value : null},
              source_submitted_at = ${r.submitted_at}, source_conflict = FALSE, source_count = ${count}
            WHERE id = ${ex.id}
          `;
        }
        result.updated++;
        continue;
      }

      result.plan.push({ action: "add", team_name: team, project_title: title });
      if (!dryRun) {
        try {
          const code = await nextWorkCode();
          await sql`
            INSERT INTO pjt_works
              (code, team_name, project_title, project_url, position,
               repo_url, video_url, source_key, source_submitted_at, source_conflict, source_count, notes)
            VALUES (${code}, ${team}, ${title}, ${url}, (SELECT COALESCE(MAX(position), 0) + 1 FROM pjt_works),
                    ${repo.ok ? repo.value : null}, ${video.ok ? video.value : null},
                    ${key}, ${r.submitted_at}, FALSE, ${count}, ${notesByKey.get(key) ?? null})
          `;
        } catch (err) {
          if (err && err.code === "23505") { result.warnings.push(`${label}: added by another request at the same time.`); continue; }
          throw err;
        }
      }
      result.added++;
    }
    // Notes are display-only and admins cannot edit them, so keep them equal to the latest form row.
    if (!dryRun) {
      for (const [key, notes] of notesByKey) {
        if (!byKey.has(key)) continue;
        await sql`UPDATE pjt_works SET notes = ${notes} WHERE source_key = ${key} AND notes IS DISTINCT FROM ${notes}`;
      }
    }
  } catch (err) {
    console.error("sync-submissions error:", err);
    result.ok = false;
    result.error = "Could not read the submission form data.";
  }

  if (!dryRun) { lastRun = Date.now(); lastResult = result; }
  return result;
}
