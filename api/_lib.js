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

// ---- Buat kode karya unik berikutnya: KARYA-01, KARYA-02, ... ----
export async function nextWorkCode() {
  const rows = await sql`
    SELECT code FROM pj_works
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
