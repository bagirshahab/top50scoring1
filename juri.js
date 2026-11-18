// =====================================================================
//  juri.js — Judge Panel logic (tablet friendly)
// =====================================================================
const judge = guard("judge");
if (judge) document.getElementById("who-name").textContent = judge.name || judge.username;

const DEFAULT_SCORE = 50;
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
          <span class="weight-badge">${p.weight}%</span>
        </div>
        <div class="stepper">
          <button type="button" class="step-btn" data-step="-1" data-key="${p.key}" aria-label="Decrease ${esc(p.name)}">−</button>
          <input type="number" class="step-num" id="num-${p.key}" min="1" max="100" value="${DEFAULT_SCORE}"
                 inputmode="numeric" aria-label="${esc(p.name)} score (1-100)" />
          <button type="button" class="step-btn" data-step="1" data-key="${p.key}" aria-label="Increase ${esc(p.name)}">+</button>
        </div>
      </div>
      <input type="range" class="crit-range" id="rng-${p.key}" min="1" max="100" value="${DEFAULT_SCORE}" aria-label="${esc(p.name)} slider" />
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
    sum += Math.min(100, Math.max(0, v)) * p.weight;
  });
  document.getElementById("score-total-val").textContent = (sum / 100).toFixed(2);
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
    list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function workBadges(w) {
  const b = [];
  if (w.team_number) b.push(`<span class="bdg bdg-team">Team ${w.team_number}</span>`);
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

function statusHtml(w) {
  if (loadDraft(w.id)) return `<span class="chip pending">${icon("status-warning")} Unsaved draft</span>`;
  if (SCORES.has(w.id)) return `<span class="chip done">${icon("status-positive")} ${Number(SCORES.get(w.id)).toFixed(2)}</span>`;
  return '<span class="chip">Not scored</span>';
}

function updateStats() {
  const total = WORKS.length;
  const done = WORKS.filter((w) => SCORES.has(w.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-done").textContent = done;
  document.getElementById("stat-left").textContent = Math.max(0, total - done);
  document.getElementById("progress-pct").textContent = pct + "%";
  document.getElementById("progress-fill").style.width = pct + "%";
}

function renderList() {
  const list = document.getElementById("work-list");
  updateStats();
  if (!WORKS.length) {
    list.innerHTML = `<div class="empty"><div class="empty-ic">${icon("folder-open", "big")}</div>No projects yet. Please wait for the admin to add them.</div>`;
    return;
  }
  list.innerHTML = WORKS.map((w, i) => `
    <button type="button" class="work-row ${SCORES.has(w.id) ? "is-done" : ""}" data-id="${esc(w.id)}" onclick="openScore('${esc(w.id)}')">
      <span class="order-badge">${w.position || i + 1}</span>
      <span class="wr-main">
        <span class="wr-title">${esc(w.project_title)}</span>
        <span class="wr-team">${esc(w.team_name)}${w.category ? " · " + esc(w.category) : ""}</span>
        <span class="bdg-row">${workBadges(w)}</span>
        <span class="wr-host">${esc(hostOf(w.project_url))}</span>
      </span>
      <span class="wr-side">
        <span class="wr-status">${statusHtml(w)}</span>
        <span class="wr-cta">${SCORES.has(w.id) ? "Edit" : "Score"} ${icon("angle-right")}</span>
      </span>
    </button>`).join("");
}

function refreshRow(workId) {
  const w = WORKS.find((x) => x.id === workId);
  const row = document.querySelector(`.work-row[data-id="${workId}"]`);
  if (w && row) {
    row.classList.toggle("is-done", SCORES.has(w.id));
    row.querySelector(".wr-status").innerHTML = statusHtml(w);
    row.querySelector(".wr-cta").innerHTML = (SCORES.has(w.id) ? "Edit" : "Score") + " " + icon("angle-right");
  }
  updateStats();
}

// ---------- Scoring sheet ----------
function setPane(name) {
  document.querySelectorAll(".sheet-tab").forEach((t) => t.classList.toggle("active", t.dataset.pane === name));
  const wide = WIDE.matches;
  document.getElementById("pane-score").hidden = !wide && name !== "score";
  document.getElementById("pane-project").hidden = !wide && name !== "project";
  if (!wide && name === "project") ensureFrame();
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
    document.getElementById("pf-shot").removeAttribute("src");
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

async function openScore(workId) {
  const work = WORKS.find((w) => w.id === workId);
  if (!work) return;
  currentWorkId = workId;

  document.getElementById("score-order").textContent = "#" + (work.position || "");
  document.getElementById("score-title").textContent = work.project_title;
  document.getElementById("score-team").textContent = work.team_name + (work.category ? " · " + work.category : "");
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
  document.getElementById("score-status").innerHTML = "";

  document.getElementById("score-modal").hidden = false;
  document.body.classList.add("no-scroll");
  document.querySelector(".sheet-body").scrollTop = 0;
  setPane("score");
  if (WIDE.matches) ensureFrame();
  recalcTotal();

  try {
    const data = await apiFetch(`/api/scores?work_id=${encodeURIComponent(workId)}`);
    if (currentWorkId !== workId) return;
    if (data.score) {
      CRITERIA.forEach((p) => setParamValue(p.key, data.score[p.key]));
      document.getElementById("score-comment").value = data.score.comment || "";
      document.getElementById("score-status").innerHTML = `<span class="chip done">${icon("status-positive")} Previously scored. You can edit.</span>`;
    } else {
      document.getElementById("score-status").innerHTML = '<span class="chip">Not scored yet</span>';
    }
  } catch { /* keep defaults */ }

  const draft = loadDraft(workId);
  if (draft && currentWorkId === workId) {
    CRITERIA.forEach((p) => {
      const v = parseInt(draft.payload[p.key], 10);
      if (!isNaN(v)) setParamValue(p.key, Math.min(100, Math.max(1, v)));
    });
    document.getElementById("score-comment").value = draft.payload.comment || "";
    document.getElementById("score-status").innerHTML =
      `<span class="chip pending">${icon("status-warning")} Unsaved scores restored. Press Submit to save.</span>`;
  }
  recalcTotal();
}

function closeScore() {
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

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && currentWorkId) closeScore(); });

buildParams();
loadWorks();
