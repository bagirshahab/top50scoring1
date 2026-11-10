// =====================================================================
//  GET /api/my-scores  — Daftar work_id yang sudah dinilai juri yg login.
//  Dipakai panel juri untuk menandai karya "sudah dinilai".
// =====================================================================
import { sql, setCors, requireRole } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const judge = requireRole(req, res, "judge");
  if (!judge) return;

  try {
    const rows = await sql`
      SELECT work_id, weighted, total FROM pj_scores WHERE judge_id = ${judge.id}
    `;
    return res.status(200).json({ scored: rows });
  } catch (err) {
    console.error("my-scores error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
