// =====================================================================
//  GET /api/health  — Cek koneksi database & tabel.
//  Berguna untuk memastikan DATABASE_URL benar setelah deploy.
//  Tidak membocorkan data sensitif.
// =====================================================================
import { sql, setCors, judgingState, JUDGING_OPENS_AT, JUDGING_CLOSES_AT } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  try {
    const works = (await sql`SELECT COUNT(*)::int AS c FROM pjt_works`)[0].c;
    const judges = (await sql`SELECT COUNT(*)::int AS c FROM pjt_judges`)[0].c;
    const scores = (await sql`SELECT COUNT(*)::int AS c FROM pjt_scores`)[0].c;

    return res.status(200).json({
      ok: true,
      db: "connected",
      counts: { works, judges, scores },
      // the window judges are held to (env JUDGING_OPENS_AT / JUDGING_CLOSES_AT win over the defaults)
      judging: {
        state: judgingState(),
        opensAt: new Date(JUDGING_OPENS_AT).toISOString(),
        closesAt: new Date(JUDGING_CLOSES_AT).toISOString(),
        fromEnv: { opens: !!process.env.JUDGING_OPENS_AT, closes: !!process.env.JUDGING_CLOSES_AT },
      },
      env: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        ADMIN_USERNAME: !!process.env.ADMIN_USERNAME,
        ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
      },
    });
  } catch (err) {
    console.error("health error:", err);
    return res.status(500).json({
      ok: false,
      db: "error",
      message: "Failed to connect to the database. Check DATABASE_URL and whether schema.sql has been run.",
    });
  }
}
