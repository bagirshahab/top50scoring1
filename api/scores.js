// =====================================================================
//  /api/scores  — Scoring by judges
//
//  GET  /api/scores?work_id=<uuid>   -> get the signed-in judge's score
//                                        for one project (so it can be edited)
//  POST /api/scores                  -> save / update a score (JUDGE)
//     body: { work_id, problem, solution, evidence, feasibility, ux, comment }
//     Each parameter is on a 1..100 scale. One judge = one row per project
//     (UNIQUE work_id+judge_id -> upsert).
//
//  Weighted scoring (final score on a 0-100 scale):
//     weighted = (problem*25 + solution*25 + evidence*15 + feasibility*15 + ux*20) / 100
// =====================================================================
import { sql, setCors, parseBody, requireRole, verifyToken, withRetry } from "./_lib.js";

// Parameter keys and their weights (must sum to 100)
const WEIGHTS = {
  problem: 25,
  solution: 25,
  evidence: 15,
  feasibility: 15,
  ux: 20,
};
const PARAMS = Object.keys(WEIGHTS);

function computeWeighted(vals) {
  let sum = 0;
  for (const p of PARAMS) sum += vals[p] * WEIGHTS[p];
  return Math.round((sum / 100) * 100) / 100; // 0-100, 2 decimals
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // -------- GET: this judge's score for one project --------
    if (req.method === "GET") {
      const judge = verifyToken(req);
      if (!judge || judge.role !== "judge") {
        return res.status(401).json({ error: "You must be signed in as a judge." });
      }
      const workId = req.query.work_id;
      if (!workId) return res.status(400).json({ error: "work_id is required." });

      const rows = await sql`
        SELECT problem, solution, evidence, feasibility, ux, comment, weighted, total
        FROM pj_scores
        WHERE work_id = ${workId} AND judge_id = ${judge.id}
        LIMIT 1
      `;
      return res.status(200).json({ score: rows[0] || null });
    }

    // -------- POST: save / update a score --------
    if (req.method === "POST") {
      const judge = requireRole(req, res, "judge");
      if (!judge) return;

      const body = parseBody(req);
      const workId = body.work_id;
      if (!workId) return res.status(400).json({ error: "work_id is required." });

      // Validate each parameter 1..100
      const vals = {};
      for (const p of PARAMS) {
        const n = parseInt(body[p], 10);
        if (isNaN(n) || n < 1 || n > 100) {
          return res.status(400).json({ error: `The "${p}" value must be a number from 1 to 100.` });
        }
        vals[p] = n;
      }
      const total = PARAMS.reduce((a, p) => a + vals[p], 0);
      const weighted = computeWeighted(vals);
      const comment = (body.comment || "").toString().trim().slice(0, 2000) || null;

      // Make sure the project exists (retry on transient DB errors; read-only)
      const w = await withRetry(() => sql`SELECT id FROM pj_works WHERE id = ${workId} LIMIT 1`);
      if (!w[0]) return res.status(404).json({ error: "Project not found." });

      // Upsert based on UNIQUE(work_id, judge_id).
      // Idempotent, so it is safe to retry on transient DB errors.
      await withRetry(() => sql`
        INSERT INTO pj_scores
          (work_id, judge_id, problem, solution, evidence, feasibility, ux, comment, weighted, total, created_at, updated_at)
        VALUES
          (${workId}, ${judge.id}, ${vals.problem}, ${vals.solution}, ${vals.evidence},
           ${vals.feasibility}, ${vals.ux}, ${comment}, ${weighted}, ${total}, NOW(), NOW())
        ON CONFLICT (work_id, judge_id) DO UPDATE SET
          problem     = EXCLUDED.problem,
          solution    = EXCLUDED.solution,
          evidence    = EXCLUDED.evidence,
          feasibility = EXCLUDED.feasibility,
          ux          = EXCLUDED.ux,
          comment     = EXCLUDED.comment,
          weighted    = EXCLUDED.weighted,
          total       = EXCLUDED.total,
          updated_at  = NOW()
      `);

      return res.status(200).json({ success: true, weighted, total });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("scores error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
