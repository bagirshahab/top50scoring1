// =====================================================================
//  GET /api/ranking  — Ranking dashboard (ADMIN)
//
//  Returns each project + how many judges scored it, the averaged
//  weighted score (0-100, the ranking metric), and the average of each
//  parameter. Sorted from highest weighted average (automatic ranking).
//
//  Also returns a per-judge breakdown so the admin can see who scored what.
// =====================================================================
import { sql, setCors, requireRole } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const admin = requireRole(req, res, "admin");
  if (!admin) return;

  try {
    // Per-project aggregate
    const ranking = await sql`
      SELECT
        w.id, w.code, w.team_name, w.project_title, w.category,
        COUNT(s.id)                                       AS judge_count,
        COALESCE(ROUND(AVG(s.weighted)::numeric, 2), 0)   AS avg_weighted,
        COALESCE(ROUND(AVG(s.problem)::numeric, 1), 0)    AS avg_problem,
        COALESCE(ROUND(AVG(s.solution)::numeric, 1), 0)   AS avg_solution,
        COALESCE(ROUND(AVG(s.evidence)::numeric, 1), 0)   AS avg_evidence,
        COALESCE(ROUND(AVG(s.feasibility)::numeric, 1), 0) AS avg_feasibility,
        COALESCE(ROUND(AVG(s.ux)::numeric, 1), 0)         AS avg_ux
      FROM pjt_works w
      LEFT JOIN pjt_scores s ON s.work_id = w.id
      GROUP BY w.id
      ORDER BY avg_weighted DESC, judge_count DESC,
               NULLIF(regexp_replace(w.code, '\\D', '', 'g'), '')::int NULLS LAST, w.code
    `;

    // Per-judge score breakdown (shown when the admin expands a project)
    const details = await sql`
      SELECT s.work_id, j.name AS judge_name, s.problem, s.solution,
             s.evidence, s.feasibility, s.ux, s.weighted, s.total, s.comment, s.updated_at
      FROM pjt_scores s
      JOIN pjt_judges j ON j.id = s.judge_id
      ORDER BY s.weighted DESC
    `;

    // Quick stats
    const totalJudges = (await sql`SELECT COUNT(*)::int AS c FROM pjt_judges`)[0].c;
    const totalWorks = ranking.length;

    return res.status(200).json({ ranking, details, stats: { totalJudges, totalWorks } });
  } catch (err) {
    console.error("ranking error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
