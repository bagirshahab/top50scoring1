// =====================================================================
//  app.js — Shared frontend helpers (used by all pages)
// =====================================================================

// API base URL. Since the frontend & API are deployed together on Vercel,
// use a relative path. (Can be changed to an absolute URL if separated.)
const API_BASE = "";
function API(path) { return API_BASE + path; }

// ---- Session management (token + user) via localStorage ----
const Auth = {
  KEY: "pj_session",
  // remember=true  -> kept in this browser (localStorage)
  // remember=false -> forgotten when the tab/browser is closed (sessionStorage)
  set(token, user, remember = true) {
    this.clear();
    (remember ? localStorage : sessionStorage).setItem(this.KEY, JSON.stringify({ token, user }));
  },
  get() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY) || localStorage.getItem(this.KEY) || "null"); }
    catch { return null; }
  },
  token() { return this.get()?.token || null; },
  user() { return this.get()?.user || null; },
  clear() { localStorage.removeItem(this.KEY); sessionStorage.removeItem(this.KEY); },
  logout() { this.clear(); location.href = "/login"; },
};

// ---- Sign out with a confirmation popup ----
// Shows a modal first; only signs out when the user clicks "Yes".
function confirmLogout() {
  // Reuse an existing dialog if already created
  let overlay = document.getElementById("logout-confirm");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "logout-confirm";
    overlay.className = "modal";
    overlay.innerHTML = `
      <div class="modal-backdrop" data-logout-cancel></div>
      <div class="confirm-card">
        <div class="confirm-ic">${icon("sign-out")}</div>
        <h3>Sign out?</h3>
        <p>You will be returned to the login page. Are you sure you want to sign out?</p>
        <div class="confirm-actions">
          <button type="button" class="btn btn-ghost" data-logout-cancel>Cancel</button>
          <button type="button" class="btn btn-primary" data-logout-yes>Yes, sign out</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Wire up actions
    overlay.querySelectorAll("[data-logout-cancel]").forEach((el) =>
      el.addEventListener("click", () => { overlay.hidden = true; })
    );
    overlay.querySelector("[data-logout-yes]").addEventListener("click", () => Auth.logout());
    // Close on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) overlay.hidden = true;
    });
  }
  overlay.hidden = false;
}

// ---- Generic confirmation dialog ----
// await askConfirm({ title, message, confirmText, cancelText }) -> true when confirmed.
// Esc or the cancel button resolves false. Focus starts on the cancel button (the safe choice).
function askConfirm({ title, message, confirmText = "Yes", cancelText = "Cancel", iconName = "status-warning" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal";
    overlay.style.zIndex = "400";
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", title || "Confirm");
    overlay.innerHTML = `
      <div class="modal-backdrop" data-no></div>
      <div class="confirm-card">
        <div class="confirm-ic">${icon(iconName)}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
        <div class="confirm-actions">
          <button type="button" class="btn btn-ghost" data-no>${esc(cancelText)}</button>
          <button type="button" class="btn btn-primary" data-yes>${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const finish = (answer) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(answer);
    };
    // Capture phase + stopImmediatePropagation so Esc closes only this dialog, not the page behind it.
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(false); }
    };
    document.addEventListener("keydown", onKey, true);
    overlay.querySelectorAll("[data-no]").forEach((el) => el.addEventListener("click", () => finish(false)));
    overlay.querySelector("[data-yes]").addEventListener("click", () => finish(true));
    overlay.querySelector(".btn[data-no]").focus();
  });
}

// ---- Fetch with automatic Authorization header ----
async function apiFetch(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };
  const token = Auth.token();
  if (token) opts.headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API(path), opts);

  // Session expired / invalid -> back to login
  if (res.status === 401) {
    Auth.clear();
    const p = location.pathname;
    const onLogin = p === "/login" || p.endsWith("/login.html");
    if (!onLogin) location.href = "/login";
    throw new Error("Session expired. Please sign in again.");
  }

  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();

  if (!res.ok) throw new Error((data && data.error) || "Something went wrong.");
  return data;
}

// ---- Team label helpers: show the same thing only once ----
// The team name is skipped when it just repeats the project title, and the team number
// is skipped when the team name already contains it (e.g. "test 6" + number 6).
const _same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
function teamSubline(w) {
  const parts = [];
  if (w.team_name && !_same(w.team_name, w.project_title)) parts.push(w.team_name);
  if (w.category) parts.push(w.category);
  return parts.join(" · ");
}

// ---- Small helper ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- POST JSON with automatic retry ----
// Safe for idempotent endpoints such as /api/scores (an upsert).
// Retries only on network failures, timeouts (408), rate limits (429) and
// server errors (5xx). Client errors (400/403/404...) and an expired
// session (401) are NOT retried: they fail immediately with err.fatal = true.
// Resolves with the parsed JSON, or rejects with an Error (.status, .fatal, .expired).
async function postWithRetry(path, body, opts = {}) {
  const delays = opts.delays || [0, 800, 2500];
  const onAttempt = opts.onAttempt || (() => {});
  const timeoutMs = opts.timeoutMs || 20000;
  let lastErr = new Error("Could not reach the server.");

  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    onAttempt(i + 1, delays.length);

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const headers = { "Content-Type": "application/json" };
      const token = Auth.token();
      if (token) headers["Authorization"] = "Bearer " + token;

      const res = await fetch(API(path), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });

      let data = null;
      try { data = await res.json(); } catch { /* non-JSON body */ }
      if (res.ok) return data;

      const err = new Error((data && data.error) || `Server responded with status ${res.status}.`);
      err.status = res.status;
      if (res.status === 401) { err.fatal = true; err.expired = true; throw err; }
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        err.fatal = true;
        throw err;
      }
      lastErr = err; // 5xx / 408 / 429 -> try again
    } catch (e) {
      if (e && e.fatal) throw e;
      if (e && e.name === "AbortError") lastErr = new Error("The server took too long to respond.");
      else if (e instanceof TypeError) lastErr = new Error("Network problem. Please check your connection.");
      else lastErr = e instanceof Error ? e : new Error(String(e));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr;
}

// ---- Page guard: require a specific role ----
function guard(role) {
  const user = Auth.user();
  if (!user) { location.href = "/login"; return null; }
  if (role && user.role !== role) {
    // Wrong role -> redirect to the matching dashboard
    location.href = user.role === "admin" ? "/admin" : "/juri";
    return null;
  }
  return user;
}

// ---- Small toast ----
function toast(message, type = "success") {
  let el = document.getElementById("pj-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "pj-toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "toast " + (type === "error" ? "error" : "") + " show";
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = "toast"; }, 3000);
}

// ---- Escape HTML to prevent XSS when rendering user data ----
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---- Short date format ----
function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}
