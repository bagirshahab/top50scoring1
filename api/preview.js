// =====================================================================
//  GET /api/preview?code=KARYA-01   (or /preview/KARYA-01 via rewrite)
//  Serves a participant's HTML so it can be previewed inside the
//  judge / admin iframe.
//
//  Security: this is UNTRUSTED code. See api/_sandbox.js. The response is
//  sent with  Content-Security-Policy: sandbox allow-scripts  (opaque origin),
//  and the embedding pages use  <iframe sandbox="allow-scripts">.
//  No token is required so the iframe can load easily; project codes are
//  curated by the admin.
// =====================================================================
import { sql } from "./_lib.js";
import { PREVIEW_CSP, ERROR_CSP, escHtml, prepareForPreview } from "./_sandbox.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

  const code = (req.query.code || "").toString().trim();
  if (!code) return res.status(400).send("Project code is required.");

  try {
    const rows = await sql`
      SELECT html_content, project_title FROM pjt_works WHERE code = ${code} LIMIT 1
    `;
    const work = rows[0];

    if (!work) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", ERROR_CSP);
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head>
        <body style="font-family:Inter,sans-serif;text-align:center;padding-top:60px;background:#0F1522;color:#EEF2F9;">
          <h1 style="color:#F43F5E;">404 — Project not found</h1>
          <p>Code "${escHtml(code)}" does not exist in the database.</p>
        </body></html>
      `);
    }

    if (!work.html_content || work.html_content.trim() === "") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", ERROR_CSP);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Empty</title></head>
        <body style="font-family:Inter,sans-serif;text-align:center;padding-top:60px;background:#0F1522;color:#EEF2F9;">
          <h1 style="color:#FBBF24;">Project "${escHtml(work.project_title)}" has no HTML content yet.</h1>
        </body></html>
      `);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", PREVIEW_CSP);
    // Project HTML only changes when an admin re-imports it, so cache it hard:
    // the browser keeps it 5 min, the Vercel edge keeps it 1 h (and serves stale for a day
    // while refreshing). This keeps repeat views off the database.
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(prepareForPreview(work.html_content));
  } catch (err) {
    console.error("preview error:", err);
    return res.status(500).send("Server error.");
  }
}
