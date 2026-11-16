// =====================================================================
//  /api/works  — Project management (web links, max 20)
//
//  GET    /api/works              -> project list in presentation order (admin & judge)
//  POST   /api/works              -> add a project (ADMIN)
//                                    body: { team_name, project_title, category, project_url }
//  PUT    /api/works              -> (ADMIN)
//                                    body { order: [id, id, ...] }  -> set presentation order 1..N
//                                    body { id, team_name, project_title, category, project_url } -> edit
//  DELETE /api/works?id=<uuid>    -> delete a project (ADMIN); remaining ones are renumbered
// =====================================================================
import { sql, setCors, parseBody, verifyToken, requireRole, nextWorkCode } from "./_lib.js";

const MAX_WORKS = 20;

// Accept only absolute http(s) links. Returns the normalised URL or null.
function cleanUrl(raw) {
  let s = (raw || "").toString().trim();
  if (!s || s.length > 2000) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // -------- GET --------
    if (req.method === "GET") {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: "Not signed in." });

      const rows = await sql`
        SELECT id, code, team_name, project_title, category, project_url, position, created_at
        FROM pjt_works
        ORDER BY position NULLS LAST, created_at, code
      `;
      return res.status(200).json({ works: rows, max: MAX_WORKS });
    }

    // -------- POST: add --------
    if (req.method === "POST") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const { team_name, project_title, category, project_url } = parseBody(req);
      const team = (team_name || "").trim();
      const title = (project_title || "").trim();
      const cat = (category || "").trim();
      const url = cleanUrl(project_url);

      if (!team || !title) return res.status(400).json({ error: "Team name and project title are required." });
      if (!url) return res.status(400).json({ error: "Please enter a valid project link (https://...)." });

      const count = (await sql`SELECT COUNT(*)::int AS c FROM pjt_works`)[0].c;
      if (count >= MAX_WORKS) {
        return res.status(400).json({ error: `Maximum ${MAX_WORKS} projects reached. Delete one first.` });
      }

      const code = await nextWorkCode();
      const rows = await sql`
        INSERT INTO pjt_works (code, team_name, project_title, category, project_url, position)
        VALUES (${code}, ${team}, ${title}, ${cat || null}, ${url},
                (SELECT COALESCE(MAX(position), 0) + 1 FROM pjt_works))
        RETURNING id, code, team_name, project_title, category, project_url, position, created_at
      `;
      return res.status(200).json({ success: true, work: rows[0] });
    }

    // -------- PUT: reorder or edit --------
    if (req.method === "PUT") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const body = parseBody(req);

      // Reorder: the full list of ids in the desired order
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

      // Edit one project
      if (!body.id) return res.status(400).json({ error: "Project ID is required." });
      const team = (body.team_name || "").trim();
      const title = (body.project_title || "").trim();
      const cat = (body.category || "").trim();
      const url = cleanUrl(body.project_url);
      if (!team || !title) return res.status(400).json({ error: "Team name and project title are required." });
      if (!url) return res.status(400).json({ error: "Please enter a valid project link (https://...)." });

      const rows = await sql`
        UPDATE pjt_works
        SET team_name = ${team}, project_title = ${title}, category = ${cat || null}, project_url = ${url}
        WHERE id = ${body.id}
        RETURNING id
      `;
      if (!rows[0]) return res.status(404).json({ error: "Project not found." });
      return res.status(200).json({ success: true });
    }

    // -------- DELETE --------
    if (req.method === "DELETE") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Project ID is required." });

      await sql`DELETE FROM pjt_works WHERE id = ${id}`;
      // Close the gap so positions stay 1..N
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
