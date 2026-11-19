// =====================================================================
//  Shared helpers untuk semua API penjurian
// =====================================================================
import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

export const sql = neon(process.env.DATABASE_URL);

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// ---- CORS ----
export function setCors(res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ---- Parse body JSON (Vercel kadang kirim string) ----
export function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { body = {}; }
  }
  return body || {};
}

// ---- Token (JWT) ----
export function signToken(payload, expiresIn = "12h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ---- Guard: require a specific role ----
// Returns the user object if valid, or sends 401/403 and returns null.
export function requireRole(req, res, role) {
  const user = verifyToken(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in or session expired." });
    return null;
  }
  if (role && user.role !== role) {
    res.status(403).json({ error: "Access denied for this role." });
    return null;
  }
  return user;
}

// ---- Retry a DB operation on transient failures (cold start, brief network blip) ----
// Only wrap idempotent operations (reads, upserts).
export async function withRetry(fn, { tries = 3, baseMs = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------
//  Judging window (single source of truth on the server)
//  Judges can sign in, see projects and score ONLY while the window is open.
//  Admins are never blocked.
//  Defaults: opens Sunday 22 Nov 2026 08:00 Bangkok time (UTC+7), closes 31 Dec 2026 23:59.
//  Override with env JUDGING_OPENS_AT / JUDGING_CLOSES_AT (ISO 8601). If one of these is set in
//  Vercel it wins over the default, so check /api/health to see the effective values.
// ---------------------------------------------------------------------
export const JUDGING_OPENS_AT = new Date(process.env.JUDGING_OPENS_AT || "2026-11-22T08:00:00+07:00").getTime();
export const JUDGING_CLOSES_AT = new Date(process.env.JUDGING_CLOSES_AT || "2026-12-31T23:59:00+07:00").getTime();

// "before" | "open" | "closed"
export function judgingState(now = Date.now()) {
  if (!isNaN(JUDGING_OPENS_AT) && now < JUDGING_OPENS_AT) return "before";
  if (!isNaN(JUDGING_CLOSES_AT) && now >= JUDGING_CLOSES_AT) return "closed";
  return "open";
}

// e.g. "Sunday, November 22, 2026, 8:00 AM (Bangkok time)"
export function fmtWindow(t) {
  const d = new Date(t);
  const date = d.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time} (Bangkok time)`;
}

export function judgingBlockMessage(state) {
  return state === "before"
    ? `Judging has not opened yet. It opens on ${fmtWindow(JUDGING_OPENS_AT)}.`
    : `Judging is closed. The judging period ended on ${fmtWindow(JUDGING_CLOSES_AT)}.`;
}

// Use on judge endpoints: returns true when the request may continue, otherwise sends 403.
export function requireJudgingOpen(res, user) {
  if (!user || user.role !== "judge") return true; // admins are never blocked
  const state = judgingState();
  if (state === "open") return true;
  res.status(403).json({ error: judgingBlockMessage(state), judging: state });
  return false;
}

// ---- Buat kode karya unik berikutnya: KARYA-01, KARYA-02, ... ----
export async function nextWorkCode() {
  const rows = await sql`
    SELECT code FROM pjt_works
    WHERE code ~ '^KARYA-[0-9]+$'
    ORDER BY (regexp_replace(code, '\\D', '', 'g'))::int DESC
    LIMIT 1
  `;
  let n = 1;
  if (rows[0]) {
    const num = parseInt(rows[0].code.replace(/\D/g, ""), 10);
    if (!isNaN(num)) n = num + 1;
  }
  return `KARYA-${String(n).padStart(2, "0")}`;
}
