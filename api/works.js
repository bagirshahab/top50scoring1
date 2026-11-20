// =====================================================================
//  /api/works  — Project management (web links, max 20)
//
//  GET    /api/works              -> project list in presentation order (admin & judge)
//  POST   /api/works              -> add a project (ADMIN)
//  PUT    /api/works              -> (ADMIN)
//                                    body { order: [id, ...] }   -> set presentation order 1..N
//                                    body { id, ...fields }      -> edit one project
//  DELETE /api/works?id=<uuid>    -> delete a project (ADMIN); remaining ones are renumbered
//
//  Fields: team_name, project_title, category, project_url (required),
//          team_number, bedrock_used, agentcore_used, repo_url, video_url,
//          screenshot_url, fallback (flag: link unavailable, show backup material).
//  Judges never see the internal link-check note.
// =====================================================================
import { sql, setCors, parseBody, verifyToken, requireRole, nextWorkCode, requireJudgingOpen } from "./_lib.js";
import { MAX_WORKS, readWorkFields } from "./_works-util.js";
import { syncSubmissions } from "./_sync.js";

function dupMessage(err) {
  return err && err.code === "23505" ? "That team number is already used by another project." : null;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // -------- GET --------
    if (req.method === "GET") {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: "Not signed in." });
      if (!requireJudgingOpen(res, user)) return; // judges see the project list only while judging is open

      // New form submissions appear automatically (throttled; a failure never blocks the list).
      const sync = await syncSubmissions().catch(() => null);

      const rows = await sql`
        SELECT id, code, team_name, project_title, category, project_url, position, created_at,
               team_number, bedrock_used, agentcore_used, repo_url, video_url, screenshot_url, fallback,
               link_ok, link_status, link_note, link_checked_at,
               source_submitted_at, source_conflict, source_count
        FROM pjt_works
        ORDER BY position NULLS LAST, created_at, code
      `;
      if (user.role !== "admin") {
        for (const r of rows) {
          delete r.link_note; delete r.link_status; delete r.link_ok; delete r.link_checked_at;
          delete r.source_submitted_at; delete r.source_conflict; delete r.source_count;
        }
      }
      return res.status(200).json({ works: rows, max: MAX_WORKS, sync: user.role === "admin" && sync && !sync.throttled ? { added: sync.added, updated: sync.updated, skipped: sync.skipped, warnings: sync.warnings, at: sync.at } : undefined });
    }

    // -------- POST: add --------
    if (req.method === "POST") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const parsed = readWorkFields(parseBody(req));
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const v = parsed.value;

      const count = (await sql`SELECT COUNT(*)::int AS c FROM pjt_works`)[0].c;
      if (count >= MAX_WORKS) {
        return res.status(400).json({ error: `Maximum ${MAX_WORKS} projects reached. Delete one first.` });
      }

      const code = await nextWorkCode();
      try {
        const rows = await sql`
          INSERT INTO pjt_works
            (code, team_name, project_title, category, project_url, position,
             team_number, bedrock_used, agentcore_used, repo_url, video_url, screenshot_url, fallback)
          VALUES (${code}, ${v.team_name}, ${v.project_title}, ${v.category}, ${v.project_url},
                  (SELECT COALESCE(MAX(position), 0) + 1 FROM pjt_works),
                  ${v.team_number}, ${v.bedrock_used}, ${v.agentcore_used}, ${v.repo_url}, ${v.video_url}, ${v.screenshot_url}, ${v.fallback})
          RETURNING id, code, position
        `;
        return res.status(200).json({ success: true, work: rows[0] });
      } catch (err) {
        const m = dupMessage(err);
        if (m) return res.status(409).json({ error: m });
        throw err;
      }
    }

    // -------- PUT: reorder or edit --------
    if (req.method === "PUT") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const body = parseBody(req);

      if (Array.isArray(body.order)) {
        const ids = body.order.map(String);
        const existing = await sql`SELECT id FROM pjt_works`;
        const have = new Set(existing.map((r) => r.id));
        if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((i) => have.has(i))) {
          return res.status(400).json({ error: "The order must list every project exactly once. Reload and try again." });
        }
        await sql`
          UPDATE pjt_works w SET position = t.pos
          FROM unnest(${ids}::uuid[]) WITH ORDINALITY AS t(id, pos)
          WHERE w.id = t.id
        `;
        return res.status(200).json({ success: true });
      }

      if (!body.id) return res.status(400).json({ error: "Project ID is required." });
      const parsed = readWorkFields(body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const v = parsed.value;

      try {
        // When the project link changes, the old link-check result no longer applies.
        const rows = await sql`
          UPDATE pjt_works SET
            team_name = ${v.team_name}, project_title = ${v.project_title}, category = ${v.category},
            link_ok         = CASE WHEN project_url IS DISTINCT FROM ${v.project_url} THEN NULL ELSE link_ok END,
            link_status     = CASE WHEN project_url IS DISTINCT FROM ${v.project_url} THEN NULL ELSE link_status END,
            link_note       = CASE WHEN project_url IS DISTINCT FROM ${v.project_url} THEN NULL ELSE link_note END,
            link_checked_at = CASE WHEN project_url IS DISTINCT FROM ${v.project_url} THEN NULL ELSE link_checked_at END,
            project_url = ${v.project_url},
            team_number = ${v.team_number}, bedrock_used = ${v.bedrock_used}, agentcore_used = ${v.agentcore_used},
            repo_url = ${v.repo_url}, video_url = ${v.video_url}, screenshot_url = ${v.screenshot_url}, fallback = ${v.fallback}
          WHERE id = ${body.id}
          RETURNING id
        `;
        if (!rows[0]) return res.status(404).json({ error: "Project not found." });
        return res.status(200).json({ success: true });
      } catch (err) {
        const m = dupMessage(err);
        if (m) return res.status(409).json({ error: m });
        throw err;
      }
    }

    // -------- DELETE --------
    if (req.method === "DELETE") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Project ID is required." });

      // A project that came from the form is remembered as dismissed, so the next sync does not
      // bring it back. It returns only if that team submits the form again.
      await sql`
        INSERT INTO pjt_sync_ignore (source_key, submitted_at)
        SELECT source_key, source_submitted_at FROM pjt_works
        WHERE id = ${id} AND source_key IS NOT NULL AND source_submitted_at IS NOT NULL
        ON CONFLICT (source_key) DO UPDATE SET submitted_at = EXCLUDED.submitted_at, created_at = NOW()
      `;
      await sql`DELETE FROM pjt_works WHERE id = ${id}`;
      await sql`
        UPDATE pjt_works w SET position = t.pos
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY position NULLS LAST, created_at, code) AS pos FROM pjt_works) t
        WHERE w.id = t.id
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("works error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
