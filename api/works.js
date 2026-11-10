// =====================================================================
//  /api/works  — Manajemen karya HTML
//
//  GET    /api/works              -> daftar karya (admin & juri)
//  POST   /api/works              -> tambah karya baru (ADMIN)
//                                    body: { team_name, project_title, category, html_content }
//  DELETE /api/works?id=<uuid>    -> hapus karya (ADMIN)
//
//  Catatan: GET tidak mengirim html_content penuh (hemat payload),
//  gunakan /api/preview/:code untuk melihat isi karya.
// =====================================================================
import { sql, setCors, parseBody, verifyToken, requireRole, nextWorkCode } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // -------- GET: daftar karya (admin / juri boleh) --------
    if (req.method === "GET") {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: "Not signed in." });

      const rows = await sql`
        SELECT id, code, team_name, project_title, category, created_at,
               length(html_content) AS html_size
        FROM pj_works
        ORDER BY NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int NULLS LAST, code
      `;
      return res.status(200).json({ works: rows });
    }

    // -------- POST: tambah karya (admin) --------
    if (req.method === "POST") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const { team_name, project_title, category, html_content } = parseBody(req);
      const team = (team_name || "").trim();
      const title = (project_title || "").trim();
      const cat = (category || "").trim();
      const html = (html_content || "").trim();

      if (!team || !title || !html) {
        return res.status(400).json({ error: "Team name, title, and HTML content are required." });
      }

      // Validasi ringan: pastikan terlihat seperti HTML
      const low = html.toLowerCase();
      const looksHtml =
        low.includes("<!doctype html") || low.includes("<html") || low.includes("<body") ||
        /<(div|p|span|table|script|style|section|header|footer|h1|h2|ul|ol|img|a)\b/.test(low);
      if (!looksHtml) {
        return res.status(400).json({ error: "The content does not look like valid HTML." });
      }

      const code = await nextWorkCode();
      const rows = await sql`
        INSERT INTO pj_works (code, team_name, project_title, category, html_content)
        VALUES (${code}, ${team}, ${title}, ${cat || null}, ${html})
        RETURNING id, code, team_name, project_title, category, created_at
      `;
      return res.status(200).json({ success: true, work: rows[0] });
    }

    // -------- DELETE: hapus karya (admin) --------
    if (req.method === "DELETE") {
      const admin = requireRole(req, res, "admin");
      if (!admin) return;

      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Project ID is required." });

      await sql`DELETE FROM pj_works WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("works error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
