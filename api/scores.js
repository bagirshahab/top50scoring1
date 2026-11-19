// =====================================================================
//  /api/scores  — Scoring by judges
//
//  GET  /api/scores?work_id=<uuid>   -> the signed-in judge's score for one project
//  POST /api/scores                  -> save / update a score (JUDGE)
//     body: { work_id, prototype, problem, solution, feasibility, pitch, comment }
//     Each criterion is 1..100. One judge = one row per project (upsert).
//
//  Demo Day criteria and weights (final score 0-100):
//     Working prototype 30 · Problem & Impact 20 · Solution Fit & Insight 20
//     Feasibility & Risk 15 · Pitch & Team 15
// =====================================================================
import { sql, setCors, parseBody, requireRole, verifyToken, withRetry, requireJudgingOpen } from "./_lib.js";

const WEIGHTS = {
  prototype: 30,
  problem: 20,
  solution: 20,
  feasibility: 15,
  pitch: 15,
};
const PARAMS = Object.keys(WEIGHTS);

function computeWeighted(vals) {
  let sum = 0;
  for (const p of PARAMS) sum += vals[p] * WEIGHTS[p];
  return Math.round((sum / 100) * 100) / 100;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const judge = verifyToken(req);
      if (!judge || judge.role !== "judge") {
        return res.status(401).json({ error: "You must be signed in as a judge." });
      }
      if (!requireJudgingOpen(res, judge)) return;
      const workId = req.query.work_id;
      if (!workId) return res.status(400).json({ error: "work_id is required." });

      const rows = await sql`
        SELECT prototype, problem, solution, feasibility, pitch, comment, weighted, total
        FROM pjt_scores
        WHERE work_id = ${workId} AND judge_id = ${judge.id}
        LIMIT 1
      `;
      return res.status(200).json({ score: rows[0] || null });
    }

    if (req.method === "POST") {
      const judge = requireRole(req, res, "judge");
      if (!judge) return;
      if (!requireJudgingOpen(res, judge)) return; // an existing session cannot score outside the window

      const body = parseBody(req);
      const workId = body.work_id;
      if (!workId) return res.status(400).json({ error: "work_id is required." });

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

      const w = await withRetry(() => sql`SELECT id FROM pjt_works WHERE id = ${workId} LIMIT 1`);
      if (!w[0]) return res.status(404).json({ error: "Project not found." });

      await withRetry(() => sql`
        INSERT INTO pjt_scores
          (work_id, judge_id, prototype, problem, solution, feasibility, pitch, comment, weighted, total, created_at, updated_at)
        VALUES
          (${workId}, ${judge.id}, ${vals.prototype}, ${vals.problem}, ${vals.solution},
           ${vals.feasibility}, ${vals.pitch}, ${comment}, ${weighted}, ${total}, NOW(), NOW())
        ON CONFLICT (work_id, judge_id) DO UPDATE SET
          prototype   = EXCLUDED.prototype,
          problem     = EXCLUDED.problem,
          solution    = EXCLUDED.solution,
          feasibility = EXCLUDED.feasibility,
          pitch       = EXCLUDED.pitch,
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
