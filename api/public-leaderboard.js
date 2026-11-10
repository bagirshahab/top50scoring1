// =====================================================================
//  GET /api/public-leaderboard  — PUBLIC ranking (no login required)
//
//  For transparency. Returns only non-sensitive data:
//    rank, project code, team name, project title, category,
//    averaged weighted score (0-100), and how many judges have scored.
//
//  It does NOT expose judge names, per-judge scores, comments, HTML, or
//  any account data.
//
//  Publishing toggle: set the env var LEADERBOARD_PUBLIC to "false" to
//  hide the public leaderboard (e.g. before judging ends). Defaults to
//  published ("true") if the variable is not set.
//
//  Judging gate: the leaderboard is also hidden BEFORE judging opens
//  (same JUDGING_OPENS_AT as the login gate), so no data is served during
//  the countdown regardless of how the page is reached.
// =====================================================================
import { sql, setCors } from "./_lib.js";

const JUDGING_OPENS_AT = new Date(
  process.env.JUDGING_OPENS_AT || "2026-11-06T00:00:00+07:00"
).getTime();

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  // Hidden while judging has not opened yet (during the countdown)
  if (!isNaN(JUDGING_OPENS_AT) && Date.now() < JUDGING_OPENS_AT) {
    return res.status(200).json({ published: false, ranking: [], stats: { totalWorks: 0, totalScored: 0 } });
  }

  // Publishing toggle
  const published = (process.env.LEADERBOARD_PUBLIC ?? "true").toString().toLowerCase() !== "false";
  if (!published) {
    return res.status(200).json({ published: false, ranking: [], stats: { totalWorks: 0, totalScored: 0 } });
  }

  try {
    const ranking = await sql`
      SELECT
        w.code, w.team_name, w.project_title, w.category,
        COUNT(s.id)                                     AS judge_count,
        COALESCE(ROUND(AVG(s.weighted)::numeric, 2), 0) AS avg_weighted
      FROM pj_works w
      LEFT JOIN pj_scores s ON s.work_id = w.id
      GROUP BY w.id
      ORDER BY avg_weighted DESC, judge_count DESC,
               NULLIF(regexp_replace(w.code, '\\D', '', 'g'), '')::int NULLS LAST, w.code
    `;

    const totalWorks = ranking.length;
    const totalScored = ranking.filter((r) => Number(r.judge_count) > 0).length;

    // Short cache so the public page is snappy but still near real-time
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");

    return res.status(200).json({
      published: true,
      ranking,
      stats: { totalWorks, totalScored },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("public-leaderboard error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
