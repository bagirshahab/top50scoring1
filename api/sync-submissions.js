// =====================================================================
//  POST /api/sync-submissions  (ADMIN)   body: { dry_run?: boolean }
//  Pull the latest form submissions into the project list right now.
//  See api/_sync.js for the rules. Reads submissions_top20_current only.
// =====================================================================
import { setCors, parseBody, requireRole } from "./_lib.js";
import { syncSubmissions } from "./_sync.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const admin = requireRole(req, res, "admin");
  if (!admin) return;

  const { dry_run } = parseBody(req);
  const result = await syncSubmissions({ force: true, dryRun: !!dry_run });
  return res.status(result.ok ? 200 : 500).json(result);
}
