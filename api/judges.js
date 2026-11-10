// =====================================================================
//  /api/judges  — Manajemen akun juri (ADMIN)
//
//  GET    /api/judges            -> daftar juri + jumlah karya yang sudah dinilai
//  POST   /api/judges            -> buat akun juri baru
//                                   body: { name, username, password }
//  DELETE /api/judges?id=<uuid>  -> hapus akun juri
// =====================================================================
import bcrypt from "bcryptjs";
import { sql, setCors, parseBody, requireRole } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // Semua operasi juri hanya untuk admin
  const admin = requireRole(req, res, "admin");
  if (!admin) return;

  try {
    // -------- GET: daftar juri --------
    if (req.method === "GET") {
      const rows = await sql`
        SELECT j.id, j.name, j.username, j.created_at,
               COUNT(s.id) AS scored_count
        FROM pjt_judges j
        LEFT JOIN pjt_scores s ON s.judge_id = j.id
        GROUP BY j.id
        ORDER BY j.created_at ASC
      `;
      return res.status(200).json({ judges: rows });
    }

    // -------- POST: buat juri baru --------
    if (req.method === "POST") {
      const { name, username, password } = parseBody(req);
      const nm = (name || "").trim();
      const uname = (username || "").trim().toLowerCase();
      const pass = (password || "").trim();

      if (!nm || !uname || !pass) {
        return res.status(400).json({ error: "Name, username, and password are required." });
      }
      if (pass.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }
      if (!/^[a-z0-9._-]+$/.test(uname)) {
        return res.status(400).json({ error: "Username may only contain lowercase letters, numbers, dots, hyphens, and underscores." });
      }

      // Check for duplicates
      const exist = await sql`SELECT id FROM pjt_judges WHERE username = ${uname} LIMIT 1`;
      if (exist[0]) {
        return res.status(409).json({ error: "That judge username is already taken." });
      }

      const hash = await bcrypt.hash(pass, 10);
      const rows = await sql`
        INSERT INTO pjt_judges (name, username, password_hash)
        VALUES (${nm}, ${uname}, ${hash})
        RETURNING id, name, username, created_at
      `;
      return res.status(200).json({ success: true, judge: rows[0] });
    }

    // -------- DELETE: hapus juri --------
    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Judge ID is required." });
      await sql`DELETE FROM pjt_judges WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("judges error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
