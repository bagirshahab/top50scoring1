// =====================================================================
//  juri.js — Judge Panel logic (tablet friendly)
// =====================================================================
const judge = guard("judge");
if (judge) document.getElementById("who-name").textContent = judge.name || judge.username;

// Every criterion starts at the minimum. A judge who presses Submit by accident
// gets 1s, not a misleading mid-range score.
const DEFAULT_SCORE = 1;
let WORKS = [];
let SCORES = new Map(); // work_id -> weighted score this judge already saved
let currentWorkId = null;

const WIDE = window.matchMedia("(min-width: 1000px)");

// ---------- Score controls ----------
function buildParams() {
  const wrap = document.getElementById("score-params");
  wrap.innerHTML = CRITERIA.map((p) => `
    <div class="crit">
      <div class="crit-head">
        <div class="crit-name">
          <span class="crit-title">${esc(p.name)}</span>
          <span class="crit-meta">
            <span class="weight-badge">${p.weight}%</span>
            <span class="crit-pts">Adds <b id="pts-${p.key}">0.00</b> of ${p.weight}</span>
          </span>
        </div>
        <div class="stepper">
          <button type="button" class="step-btn" data-step="-1" data-key="${p.key}" aria-label="Decrease ${esc(p.name)}">−</button>
          <input type="number" class="step-num" id="num-${p.key}" min="1" max="100" value="${DEFAULT_SCORE}"
                 inputmode="numeric" aria-label="${esc(p.name)} score (1-100)" />
          <button type="button" class="step-btn" data-step="1" data-key="${p.key}" aria-label="Increase ${esc(p.name)}">+</button>
        </div>
      </div>
      <input type="range" class="crit-range" id="rng-${p.key}" min="1" max="100" value="${DEFAULT_SCORE}" aria-label="${esc(p.name)} slider" />
      <div class="crit-scale" aria-hidden="true"><span>1</span><span>50</span><span>100</span></div>
      <details class="crit-guide">
        <summary>Scoring guide</summary>
        <p class="cg-desc">${esc(p.desc)}</p>
        <p class="cg-row"><span class="tag tag-high">HIGH</span><span>${esc(p.high)}</span></p>
        <p class="cg-row"><span class="tag tag-low">LOW</span><span>${esc(p.low)}</span></p>
      </details>
    </div>`).join("");

  CRITERIA.forEach((p) => {
    const rng = document.getElementById("rng-" + p.key);
    const num = document.getElementById("num-" + p.key);
    rng.addEventListener("input", () => { num.value = rng.value; recalcTotal(); });
    num.addEventListener("input", () => {
      let v = parseInt(num.value, 10);
      if (!isNaN(v)) {
        if (v > 100) { v = 100; num.value = 100; }
        rng.value = Math.min(100, Math.max(1, v));
      }
      recalcTotal();
    });
    num.addEventListener("focus", () => num.select());
    num.addEventListener("blur", () => {
      let v = parseInt(num.value, 10);
      if (isNaN(v)) v = 1;
      v = Math.min(100, Math.max(1, v));
      num.value = v; rng.value = v;
      recalcTotal();
    });
  });

  wrap.querySelectorAll(".step-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.key;
      const cur = parseInt(document.getElementById("num-" + key).value, 10) || 1;
      setParamValue(key, Math.min(100, Math.max(1, cur + parseInt(b.dataset.step, 10))));
      recalcTotal();
    })
  );
}

function recalcTotal() {
  let sum = 0;
  CRITERIA.forEach((p) => {
    let v = parseInt(document.getElementById("num-" + p.key).value, 10);
    if (isNaN(v)) v = 0;
    v = Math.min(100, Math.max(0, v));
    sum += v * p.weight;
    document.getElementById("pts-" + p.key).textContent = ((v * p.weight) / 100).toFixed(2);
    paintRange(document.getElementById("rng-" + p.key));
  });
  document.getElementById("score-total-val").textContent = (sum / 100).toFixed(2);
}

// Filled part of the slider track (CSS reads --p).
function paintRange(rng) {
  const min = Number(rng.min) || 1, max = Number(rng.max) || 100;
  rng.style.setProperty("--p", ((Number(rng.value) - min) / (max - min)) * 100 + "%");
}

function setParamValue(key, v) {
  document.getElementById("rng-" + key).value = v;
  document.getElementById("num-" + key).value = v;
}

// ---------- Local drafts (a failed save never loses what the judge typed) ----------
function draftKey(workId) { return `pjt_draft_${judge ? judge.id : "x"}_${workId}`; }
function saveDraft(workId, payload) {
  try { localStorage.setItem(draftKey(workId), JSON.stringify({ ts: Date.now(), payload })); } catch { /* blocked */ }
}
function loadDraft(workId) {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(workId)) || "null");
    return d && d.payload ? d : null;
  } catch { return null; }
}
function clearDraft(workId) { try { localStorage.removeItem(draftKey(workId)); } catch { /* ignore */ } }

// ---------- Project list ----------
async function loadWorks() {
  const list = document.getElementById("work-list");
  try {
    const [worksData, myScores] = await Promise.all([apiFetch("/api/works"), apiFetch("/api/my-scores")]);
    WORKS = worksData.works || [];
    SCORES = new Map((myScores.scored || []).map((s) => [s.work_id, s.weighted]));
    renderList();
  } catch (err) {
    list.innerHTML = `<tr><td colspan="6" class="empty">${esc(err.message)} <button type="button" class="link-btn" onclick="loadWorks()">Try again</button></td></tr>`;
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function workBadges(w) {
  const b = [];
  if (showTeamNo(w)) b.push(`<span class="bdg bdg-team">Team ${w.team_number}</span>`);
  if (w.bedrock_used === true) b.push(`<span class="bdg bdg-yes">${icon("status-positive")} Bedrock</span>`);
  if (w.bedrock_used === false) b.push(`<span class="bdg bdg-no">${icon("status-negative")} Bedrock</span>`);
  if (w.agentcore_used === true) b.push(`<span class="bdg bdg-yes">${icon("status-positive")} AgentCore</span>`);
  if (w.agentcore_used === false) b.push(`<span class="bdg bdg-no">${icon("status-negative")} AgentCore</span>`);
  if (w.fallback) b.push(`<span class="bdg bdg-warn">${icon("status-warning")} Link unavailable</span>`);
  return b.join("");
}

// YouTube / youtu.be links can be played inside the page. Anything else opens in a new tab.
function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    let id = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "m.youtube.com") {
      id = u.pathname === "/watch" ? u.searchParams.get("v") : (u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/) || [])[1];
    }
    return id && /^[\w-]{6,}$/.test(id) ? "https://www.youtube.com/embed/" + id : null;
  } catch { return null; }
}

// ---------- List: table view with filter and sort ----------
// The judge's last filter/sort is remembered on this device.
const VIEW_KEY = `pjt_list_view_${judge ? judge.id : "x"}`;
let VIEW = { sort: "order", dir: "asc", filter: "all" };
try {
  const v = JSON.parse(localStorage.getItem(VIEW_KEY) || "null");
  if (v && ["order", "project", "status", "score"].includes(v.sort)) {
    VIEW = { sort: v.sort, dir: v.dir === "desc" ? "desc" : "asc", filter: ["all", "todo", "done"].includes(v.filter) ? v.filter : "all" };
  }
} catch { /* ignore a corrupt saved view */ }
function saveView() { try { localStorage.setItem(VIEW_KEY, JSON.stringify(VIEW)); } catch { /* blocked */ } }

const isScored = (w) => SCORES.has(w.id);
const byOrder = (a, b) => (a.position || 0) - (b.position || 0);

function visibleWorks() {
  const list = WORKS.filter((w) => VIEW.filter === "all" || (VIEW.filter === "done") === isScored(w));
  const dir = VIEW.dir === "desc" ? -1 : 1;
  if (VIEW.sort === "score") {
    // Unscored projects always sit below the scored ones, in presentation order.
    const scored = list.filter(isScored).sort((a, b) => dir * (Number(SCORES.get(a.id)) - Number(SCORES.get(b.id))) || byOrder(a, b));
    return scored.concat(list.filter((w) => !isScored(w)).sort(byOrder));
  }
  const cmp = {
    order: byOrder,
    project: (a, b) => a.project_title.localeCompare(b.project_title, undefined, { sensitivity: "base", numeric: true }),
    status: (a, b) => (isScored(a) ? 1 : 0) - (isScored(b) ? 1 : 0), // ascending = not scored first
  }[VIEW.sort];
  return list.sort((a, b) => dir * cmp(a, b) || byOrder(a, b));
}

function setSort(key) {
  if (VIEW.sort === key) VIEW.dir = VIEW.dir === "asc" ? "desc" : "asc";
  else { VIEW.sort = key; VIEW.dir = key === "score" ? "desc" : "asc"; }
  saveView(); renderList();
}
function setFilter(f) { VIEW.filter = f; saveView(); renderList(); }

function statusHtml(w) {
  if (loadDraft(w.id)) return `<span class="chip pending">${icon("status-warning")} Unsaved draft</span>`;
  if (isScored(w)) return `<span class="chip done">${icon("status-positive")} Scored</span>`;
  return '<span class="chip">Not scored</span>';
}

function techChips(w) {
  return [w.bedrock_used ? "Bedrock" : null, w.agentcore_used ? "AgentCore" : null]
    .filter(Boolean).map((t) => `<span class="bdg bdg-yes">${t}</span>`).join("");
}

function updateStats() {
  const total = WORKS.length;
  const done = WORKS.filter(isScored).length;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-done").textContent = done;
  document.getElementById("stat-left").textContent = Math.max(0, total - done);
  document.getElementById("n-all").textContent = total;
  document.getElementById("n-done").textContent = done;
  document.getElementById("n-todo").textContent = Math.max(0, total - done);
}

function renderList() {
  const body = document.getElementById("work-list");
  updateStats();

  // controls reflect the current view
  document.querySelectorAll("[data-filter]").forEach((b) => {
    const on = b.dataset.filter === VIEW.filter;
    b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll("th[data-col]").forEach((th) => {
    const on = th.dataset.col === VIEW.sort;
    th.setAttribute("aria-sort", on ? (VIEW.dir === "asc" ? "ascending" : "descending") : "none");
    const ic = th.querySelector(".th-ic");
    if (ic) ic.innerHTML = on ? icon(VIEW.dir === "asc" ? "angle-up" : "angle-down") : "";
  });
  const sel = document.getElementById("sort-select");
  if (sel) sel.value = `${VIEW.sort}-${VIEW.dir}`;

  if (!WORKS.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty"><div class="empty-ic">${icon("folder-open", "big")}</div>No projects yet. Please wait for the admin to add them.</td></tr>`;
    return;
  }
  const rows = visibleWorks();
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">${VIEW.filter === "todo" ? "You have scored every project." : "You have not scored any project yet."} <button type="button" class="link-btn" onclick="setFilter('all')">Show all projects</button></td></tr>`;
    return;
  }
  body.innerHTML = rows.map((w) => {
    const scored = isScored(w);
    const sub = teamSubline(w);
    const tags = (showTeamNo(w) ? `<span class="bdg bdg-team">Team ${w.team_number}</span>` : "") +
      (w.fallback ? `<span class="bdg bdg-warn">${icon("status-warning")} Link unavailable</span>` : "");
    const tech = techChips(w);
    return `
      <tr class="work-tr ${scored ? "is-done" : ""}" data-id="${esc(w.id)}" onclick="openScore('${esc(w.id)}')">
        <td class="c-order"><span class="num">${w.position || ""}</span></td>
        <td class="c-proj">
          <button type="button" class="row-link" onclick="event.stopPropagation(); openScore('${esc(w.id)}')">${esc(w.project_title)}</button>
          ${sub ? `<div class="cell-sub">${esc(sub)}</div>` : ""}
          ${tags ? `<div class="bdg-row">${tags}</div>` : ""}
          ${tech ? `<div class="bdg-row tech-inline">${tech}</div>` : ""}
        </td>
        <td class="c-tech">${tech || '<span class="t-mute">-</span>'}</td>
        <td class="c-status">${statusHtml(w)}</td>
        <td class="c-score">${scored ? `<span class="score-cell">${Number(SCORES.get(w.id)).toFixed(2)}</span>` : '<span class="t-mute">-</span>'}</td>
        <td class="c-act"><button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openScore('${esc(w.id)}')">${scored ? "Edit" : "Score"} ${icon("angle-right")}</button></td>
      </tr>`;
  }).join("");
}

// A saved (or failed) score changes the row's status and its place in a filtered list.
function refreshRow() { renderList(); }

// ---- list controls ----
document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter)));
document.querySelectorAll("th[data-col] .th-sort").forEach((b) => b.addEventListener("click", () => setSort(b.closest("th").dataset.col)));
document.getElementById("sort-select").addEventListener("change", (e) => {
  const [sort, dir] = e.target.value.split("-");
  VIEW.sort = sort; VIEW.dir = dir; saveView(); renderList();
});

// ---------- Scoring sheet ----------
function setPane(name) {
  document.querySelectorAll(".sheet-tab").forEach((t) => t.classList.toggle("active", t.dataset.pane === name));
  const wide = WIDE.matches;
  document.getElementById("pane-score").hidden = !wide && name !== "score";
  document.getElementById("pane-project").hidden = !wide && name !== "project";
  if (!wide && name === "project") ensureFrame();
  requestAnimationFrame(updateScrollHint);
}

// Fallback project: the website could not be published, so show the video / screenshot instead.
function applyFallback(work) {
  const box = document.getElementById("proj-fallback");
  const f = document.getElementById("score-frame");
  const on = !!work.fallback;
  box.hidden = !on;
  f.hidden = on;
  document.getElementById("proj-note").hidden = on;
  const frame = document.getElementById("pf-video-frame");
  frame.src = "about:blank";
  if (!on) return;

  const emb = work.video_url ? youtubeEmbed(work.video_url) : null;
  document.getElementById("pf-video-embed").hidden = !emb;
  if (emb) frame.src = emb;
  const vid = document.getElementById("pf-video");
  vid.hidden = !work.video_url;
  if (work.video_url) vid.href = work.video_url;
  const shotLink = document.getElementById("pf-shot-link");
  shotLink.hidden = !work.screenshot_url;
  if (work.screenshot_url) {
    shotLink.href = work.screenshot_url;
    document.getElementById("pf-shot").src = work.screenshot_url;
  } else {
    document.getElementById("pf-shot").src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  }
  document.getElementById("pf-empty").hidden = !!(work.video_url || work.screenshot_url);
}

function ensureFrame() {
  const work = WORKS.find((w) => w.id === currentWorkId);
  const f = document.getElementById("score-frame");
  if (work && work.fallback) return;
  if (work && f.dataset.for !== work.id) {
    f.dataset.for = work.id;
    f.src = work.project_url;
  }
}

WIDE.addEventListener("change", () => {
  if (currentWorkId) setPane(document.querySelector(".sheet-tab.active")?.dataset.pane || "score");
});

// ---------- Locked (read-only) state ----------
// A project that already has a score opens greyed out. The judge has to click "edit" on purpose,
// so a saved score is never changed (or re-submitted) by accident.
function setLocked(locked) {
  document.getElementById("score-form").classList.toggle("is-locked", locked);
  document.querySelectorAll("#score-form .crit-range, #score-form .step-num, #score-form .step-btn, #score-comment, #score-submit")
    .forEach((el) => { el.disabled = locked; });
}
const EDIT_LINK = '<button type="button" class="link-btn" data-unlock>Click here if you want to edit the score</button>';

document.getElementById("score-status").addEventListener("click", (e) => {
  if (!e.target.closest("[data-unlock]")) return;
  setLocked(false);
  document.getElementById("score-status").innerHTML =
    `<span class="chip pending">${icon("edit")} Editing. Press Submit Score to save your changes.</span>`;
  document.getElementById("rng-" + CRITERIA[0].key).focus();
});

async function openScore(workId) {
  const work = WORKS.find((w) => w.id === workId);
  if (!work) return;
  currentWorkId = workId;

  document.getElementById("score-order").textContent = "#" + (work.position || "");
  document.getElementById("score-title").textContent = work.project_title;
  document.getElementById("score-team").textContent = teamSubline(work);
  document.getElementById("score-url").textContent = work.project_url;
  document.getElementById("score-badges").innerHTML = workBadges(work);
  applyFallback(work);
  document.getElementById("score-open").href = work.project_url;
  const f = document.getElementById("score-frame");
  f.dataset.for = ""; f.src = "about:blank";
  document.getElementById("score-msg").textContent = "";
  document.getElementById("score-msg").className = "msg";

  CRITERIA.forEach((p) => setParamValue(p.key, DEFAULT_SCORE));
  document.querySelectorAll(".crit-guide").forEach((d) => (d.open = false));
  document.getElementById("score-comment").value = "";
  // Already scored: start greyed out until the saved values are loaded.
  const alreadyScored = SCORES.has(workId);
  setLocked(alreadyScored);
  document.getElementById("score-status").innerHTML = alreadyScored ? '<span class="chip">Loading your saved score...</span>' : "";

  document.getElementById("score-modal").hidden = false;
  document.body.classList.add("no-scroll");
  document.querySelector(".sheet-body").scrollTop = 0;
  formSnapshot = formState();
  setPane("score");
  if (WIDE.matches) ensureFrame();
  recalcTotal();
  requestAnimationFrame(updateScrollHint);

  try {
    const data = await apiFetch(`/api/scores?work_id=${encodeURIComponent(workId)}`);
    if (currentWorkId !== workId) return;
    if (data.score) {
      CRITERIA.forEach((p) => setParamValue(p.key, data.score[p.key]));
      document.getElementById("score-comment").value = data.score.comment || "";
      setLocked(true);
      document.getElementById("score-status").innerHTML =
        `<span class="chip done">${icon("status-positive")} Previously scored.</span> ${EDIT_LINK}`;
    } else {
      setLocked(false);
      document.getElementById("score-status").innerHTML = '<span class="chip">Not scored yet</span>';
    }
  } catch {
    if (SCORES.has(workId)) {
      // Keep it locked: showing defaults for an already scored project would be misleading.
      document.getElementById("score-status").innerHTML =
        `<span class="chip pending">${icon("status-warning")} Could not load your saved score. Go back and open this project again.</span>`;
    } else {
      setLocked(false);
    }
  }

  // What the server (or the defaults) holds. Restoring a local draft below counts as an edit.
  formSnapshot = formState();

  const draft = loadDraft(workId);
  if (draft && currentWorkId === workId) {
    setLocked(false); // unsaved edits from an earlier attempt: let the judge finish them
    CRITERIA.forEach((p) => {
      const v = parseInt(draft.payload[p.key], 10);
      if (!isNaN(v)) setParamValue(p.key, Math.min(100, Math.max(1, v)));
    });
    document.getElementById("score-comment").value = draft.payload.comment || "";
    document.getElementById("score-status").innerHTML =
      `<span class="chip pending">${icon("status-warning")} Unsaved scores restored. Press Submit to save.</span>`;
  }
  recalcTotal();
  updateScrollHint();
}

// ---------- Leaving the scoring sheet ----------
// Snapshot of the form as loaded from the server (or the defaults), used to detect edits.
let formSnapshot = "";
function formState() {
  return JSON.stringify([
    CRITERIA.map((p) => parseInt(document.getElementById("num-" + p.key).value, 10)),
    document.getElementById("score-comment").value.trim(),
  ]);
}
const isDirty = () => formState() !== formSnapshot;

// Back button / Esc / backdrop: ask first when nothing has been submitted yet or edits would be lost.
async function requestClose() {
  if (!currentWorkId) return;
  const submitted = SCORES.has(currentWorkId);
  if (submitted && !isDirty()) { closeScore(); return; }

  const ok = await askConfirm({
    title: submitted ? "Discard your changes?" : "No score given yet",
    message: submitted
      ? "You have unsaved changes to this score. Are you sure you want to go back to the main menu?"
      : "You have not submitted a score for this project. Are you sure you want to go back to the main menu?",
    confirmText: "Yes, go back",
    cancelText: "Stay and score",
  });
  if (ok) closeScore();
}

// ---------- "More criteria below" hint ----------
// The Submit bar is pinned to the bottom, so criteria further down can be hidden behind it.
function updateScrollHint() {
  const hint = document.getElementById("scroll-hint");
  const pane = document.getElementById("pane-score");
  const bar = document.querySelector(".submit-bar");
  if (!hint || !pane || !bar || pane.hidden || !currentWorkId) { if (hint) hint.hidden = true; return; }
  const limit = pane.getBoundingClientRect().bottom - bar.offsetHeight;
  const below = [...pane.querySelectorAll(".crit")].filter((c) => c.getBoundingClientRect().bottom > limit + 2).length;
  hint.hidden = below === 0;
  if (below > 0) {
    document.getElementById("scroll-hint-text").textContent =
      below === 1 ? "1 more criterion below" : `${below} more criteria below`;
  }
}
document.getElementById("pane-score").addEventListener("scroll", updateScrollHint, { passive: true });
document.getElementById("pane-score").addEventListener("toggle", updateScrollHint, true); // scoring guide opened/closed
window.addEventListener("resize", updateScrollHint);
document.getElementById("scroll-hint").addEventListener("click", () => {
  const pane = document.getElementById("pane-score");
  pane.scrollBy({ top: Math.round(pane.clientHeight * 0.7), behavior: "smooth" });
});

function closeScore() {
  document.getElementById("scroll-hint").hidden = true;
  document.getElementById("score-modal").hidden = true;
  document.body.classList.remove("no-scroll");
  const f = document.getElementById("score-frame");
  f.dataset.for = ""; f.src = "about:blank";
  document.getElementById("pf-video-frame").src = "about:blank";
  currentWorkId = null;
}

// ---------- Submit ----------
document.getElementById("score-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentWorkId) return;
  if (document.getElementById("score-form").classList.contains("is-locked")) return;
  const btn = document.getElementById("score-submit");
  const msg = document.getElementById("score-msg");
  msg.className = "msg"; msg.textContent = "";

  const payload = { work_id: currentWorkId, comment: document.getElementById("score-comment").value.trim() };
  let valid = true;
  CRITERIA.forEach((p) => {
    const v = parseInt(document.getElementById("num-" + p.key).value, 10);
    if (isNaN(v) || v < 1 || v > 100) valid = false;
    payload[p.key] = v;
  });
  if (!valid) {
    msg.className = "msg error"; msg.textContent = "Each criterion must be a number from 1 to 100.";
    return;
  }

  const workId = currentWorkId;
  saveDraft(workId, payload);

  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const data = await postWithRetry("/api/scores", payload, {
      onAttempt: (n, total) => { btn.textContent = n === 1 ? "Saving..." : `Retrying (${n}/${total})...`; },
    });
    clearDraft(workId);
    SCORES.set(workId, data.weighted);
    toast(`Score saved: ${Number(data.weighted).toFixed(2)} / 100`);
    closeScore();
    refreshRow(workId);
  } catch (err) {
    msg.className = "msg error";
    if (err.expired) {
      msg.innerHTML = 'Your session has expired. <b>Your scores are kept on this device.</b> <a href="/login" onclick="Auth.clear()">Sign in again</a>, open this project, and press Submit.';
    } else {
      msg.textContent = `Not saved: ${err.message} Your scores are kept on this device. Press Submit to try again.`;
    }
    refreshRow(workId);
  } finally {
    btn.disabled = false; btn.textContent = "Submit Score";
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && currentWorkId) requestClose(); });

buildParams();
loadWorks();
