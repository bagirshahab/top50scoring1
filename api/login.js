// =====================================================================
//  POST /api/login
//  Body: { role: "admin" | "judge", username, password }
//  - admin: checked against ENV (ADMIN_USERNAME / ADMIN_PASSWORD),
//           or the pjt_admins table (bcrypt hash) if present.
//  - judge: checked against the pjt_judges table (bcrypt hash).
//  Returns { token, user }.
//
//  JUDGING GATE: judges can only sign in while judging is OPEN, i.e. between
//  the open time and the close time.
//  Default open  = 6 November 2026, 00:00 WIB (UTC+7).
//  Default close = 8 November 2026, 15:00 WIB (UTC+7).
//  Override with env JUDGING_OPENS_AT / JUDGING_CLOSES_AT (ISO 8601).
//  Admins are always allowed so they can set up / review any time.
// =====================================================================
import bcrypt from "bcryptjs";
import { sql, setCors, parseBody, signToken } from "./_lib.js";

const JUDGING_OPENS_AT = new Date(
  process.env.JUDGING_OPENS_AT || "2026-11-06T00:00:00+07:00"
).getTime();
const JUDGING_CLOSES_AT = new Date(
  process.env.JUDGING_CLOSES_AT || "2026-12-31T23:59:00+07:00"
).getTime();

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const { role, username, password } = parseBody(req);

    if (!role || !username || !password) {
      return res.status(400).json({ error: "Please provide both username and password." });
    }

    const uname = String(username).trim().toLowerCase();

    // ---------------- ADMIN ----------------
    if (role === "admin") {
      // 1) Coba cocokkan dengan ENV
      const envUser = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
      const envPass = process.env.ADMIN_PASSWORD || "";
      if (envPass && uname === envUser && password === envPass) {
        const token = signToken({ role: "admin", username: envUser, name: "Administrator" });
        return res.status(200).json({ token, user: { role: "admin", name: "Administrator", username: envUser } });
      }

      // 2) Coba cocokkan dengan tabel pjt_admins (bila dipakai)
      const rows = await sql`SELECT id, username, password_hash FROM pjt_admins WHERE username = ${uname} LIMIT 1`;
      if (rows[0] && (await bcrypt.compare(password, rows[0].password_hash))) {
        const token = signToken({ role: "admin", id: rows[0].id, username: rows[0].username, name: "Administrator" });
        return res.status(200).json({ token, user: { role: "admin", name: "Administrator", username: rows[0].username } });
      }

      return res.status(401).json({ error: "Incorrect admin username or password." });
    }

    // ---------------- JUDGE ----------------
    if (role === "judge") {
      // Gate: judges can only sign in while judging is open.
      // Format as e.g. "November 8, 2026, 3 PM" (hour only, no minutes, no "WIB").
      const fmt = (t) => {
        const d = new Date(t);
        const date = d.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "long", day: "numeric" });
        const hour = d.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: true }).replace(/\s?[AP]M$/i, (m) => " " + m.trim().toUpperCase());
        return `${date}, ${hour}`;
      };
      if (!isNaN(JUDGING_OPENS_AT) && Date.now() < JUDGING_OPENS_AT) {
        return res.status(403).json({
          error: `Judging has not opened yet. Sign-in for judges opens on ${fmt(JUDGING_OPENS_AT)}.`,
        });
      }
      if (!isNaN(JUDGING_CLOSES_AT) && Date.now() >= JUDGING_CLOSES_AT) {
        return res.status(403).json({
          error: `Judging is closed. The judging period ended on ${fmt(JUDGING_CLOSES_AT)}. Judge sign-in is no longer available.`,
        });
      }

      const rows = await sql`
        SELECT id, name, username, password_hash FROM pjt_judges WHERE username = ${uname} LIMIT 1
      `;
      const judge = rows[0];
      if (!judge || !(await bcrypt.compare(password, judge.password_hash))) {
        return res.status(401).json({ error: "Incorrect judge username or password." });
      }
      // Judges get a long-lived session (7 days) so a session never expires in the middle of judging.
      const token = signToken({ role: "judge", id: judge.id, username: judge.username, name: judge.name }, "7d");
      return res.status(200).json({ token, user: { role: "judge", id: judge.id, name: judge.name, username: judge.username } });
    }

    return res.status(400).json({ error: "Unrecognized role." });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "A server error occurred." });
  }
}
