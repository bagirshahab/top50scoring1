// =====================================================================
//  juri.js — Judge Panel logic
// =====================================================================
const judge = guard("judge");
if (judge) document.getElementById("who-name").textContent = judge.name || judge.username;

// Definition of the 5 weighted scoring parameters.
//   weight  = porsi parameter dalam nilai akhir (total 100%)
//   desc    = penjelasan singkat yang selalu tampil
//   detail  = penjelasan lengkap yang muncul saat hover / klik "?"
const PARAMS = [
  {
    key: "problem", name: "Problem & Impact", weight: 25,
    detail: "Is the problem real, well-scoped, and clearly articulated? How significant and widespread is the impact if solved? Higher scores for pressing, well-evidenced problems with meaningful potential impact.",
  },
  {
    key: "solution", name: "Solution Fit & Insight", weight: 25,
    detail: "Does the solution directly address the stated problem? Is there a genuine, non-obvious insight driving the approach? Reward clever fit and depth of understanding over generic ideas.",
  },
  {
    key: "evidence", name: "Evidence & Consistency", weight: 15,
    detail: "Are claims backed by data, references, or working demos? Is the narrative internally consistent (no contradictions between problem, solution, and results)? Reward verifiable, coherent evidence.",
  },
  {
    key: "feasibility", name: "Feasibility & Risk Honesty", weight: 15,
    detail: "Can this realistically be built/scaled? Does the team honestly acknowledge risks, limitations, and assumptions rather than overclaiming? Reward realistic plans and transparent risk assessment.",
  },
  {
    key: "ux", name: "Visual & User Experience", weight: 20,
    detail: "Is the interface clean, intuitive, and accessible? Does the visual design support the message? Reward polished, usable, and aesthetically coherent experiences.",
  },
];

let WORKS = [];
let currentWorkId = null;

// Build the parameter controls once (slider + manual number input + weight + tooltip)
function buildParams() {
  const wrap = document.getElementById("score-params");
  wrap.innerHTML = PARAMS.map((p) => `
    <div class="score-param">
      <div class="sp-head">
        <span class="sp-name">
          <span class="sp-label">${p.name}</span>
          <span class="weight-badge" title="This parameter is ${p.weight}% of the final score">${p.weight}%</span>
          <span class="sp-help" tabindex="0" role="button" aria-label="Details for ${p.name}">i
            <span class="sp-tooltip"><b>${p.name} · ${p.weight}%</b><br>${p.detail}</span>
          </span>
        </span>
        <label class="sp-input" title="Click to type a score (1-100)">
          <input type="number" class="sp-num" id="num-${p.key}" min="1" max="100" value="50"
                 inputmode="numeric" aria-label="${p.name} score (1-100)" />
          <span class="sp-edit-ic" aria-hidden="true">✎</span>
        </label>
      </div>
      <input type="range" id="rng-${p.key}" min="1" max="100" value="50" />
    </div>`).join("");

  // Two-way sync between slider and manual number input
  PARAMS.forEach((p) => {
    const rng = document.getElementById("rng-" + p.key);
    const num = document.getElementById("num-" + p.key);

    rng.addEventListener("input", () => {
      num.value = rng.value;
      recalcTotal();
    });

    // While typing, keep the slider roughly in sync but don't fight the user
    num.addEventListener("input", () => {
      let v = parseInt(num.value, 10);
      if (!isNaN(v)) {
        if (v > 100) { v = 100; num.value = 100; }
        if (v < 1 && num.value !== "") { /* allow mid-typing, clamp on blur */ }
        rng.value = Math.min(100, Math.max(1, isNaN(v) ? 1 : v));
      }
      recalcTotal();
    });

    // Clamp firmly to 1..100 when the user leaves the field
    num.addEventListener("blur", () => {
      let v = parseInt(num.value, 10);
      if (isNaN(v)) v = 1;
      v = Math.min(100, Math.max(1, v));
      num.value = v;
      rng.value = v;
      recalcTotal();
    });
  });
}

// Compute the weighted final score (0-100) live, same formula as the server
function recalcTotal() {
  let weighted = 0;
  PARAMS.forEach((p) => {
    let v = parseInt(document.getElementById("num-" + p.key).value, 10);
    if (isNaN(v)) v = 0;
    v = Math.min(100, Math.max(0, v));
    weighted += v * p.weight;
  });
  weighted = weighted / 100; // 0-100
  document.getElementById("score-total-val").textContent = weighted.toFixed(2);
}

function setParamValue(key, v) {
  document.getElementById("rng-" + key).value = v;
  document.getElementById("num-" + key).value = v;
}

// ---------- Local drafts (so a failed save never loses what the judge typed) ----------
function draftKey(workId) { return `pj_draft_${judge ? judge.id : "x"}_${workId}`; }
function saveDraft(workId, payload) {
  try { localStorage.setItem(draftKey(workId), JSON.stringify({ ts: Date.now(), payload })); } catch { /* storage full/blocked */ }
}
function loadDraft(workId) {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(workId)) || "null");
    return d && d.payload ? d : null;
  } catch { return null; }
}
function clearDraft(workId) { try { localStorage.removeItem(draftKey(workId)); } catch { /* ignore */ } }

// ---------- Project list ----------
// SCORES: work_id -> weighted score this judge has already saved
let SCORES = new Map();

// Fetch the project list + this judge's saved scores (2 small API calls, no HTML).
async function loadWorks() {
  const grid = document.getElementById("work-grid");
  try {
    const [worksData, myScores] = await Promise.all([
      apiFetch("/api/works"),
      apiFetch("/api/my-scores"),
    ]);
    WORKS = worksData.works || [];
    SCORES = new Map((myScores.scored || []).map((s) => [s.work_id, s.weighted]));
    renderGrid();
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(err.message)}</div>`;
  }
}

// ----- Card pieces (shared by the full render and the single-card refresh) -----
function scoreBadgeHtml(w) {
  return SCORES.has(w.id)
    ? `<div class="thumb-score" title="Your weighted score">${Number(SCORES.get(w.id)).toFixed(2)}<span>/100</span></div>`
    : "";
}
function footerHtml(w) {
  const done = SCORES.has(w.id);
  const myScore = done ? Number(SCORES.get(w.id)).toFixed(2) : null;
  const hasDraft = !!loadDraft(w.id);
  return `
    ${hasDraft
      ? '<span class="chip pending" title="These scores were not saved yet. Open the project and press Submit.">⚠ Unsaved draft</span>'
      : done
        ? `<span class="chip done">✓ Your score: <b>${myScore}</b></span>`
        : '<span class="chip pending">Not scored</span>'}
    <span class="btn btn-primary btn-sm">${done ? "Edit Score" : "Score"}</span>`;
}
function updateStats() {
  document.getElementById("stat-total").textContent = WORKS.length;
  document.getElementById("stat-done").textContent = SCORES.size;
  document.getElementById("stat-left").textContent = Math.max(0, WORKS.length - SCORES.size);
}

// Render the cards from local state only (the list itself needs no extra network calls).
function renderGrid() {
  const grid = document.getElementById("work-grid");
  updateStats();

  if (!WORKS.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-ic">📭</div>No projects to score yet. Please wait for the admin to add projects.</div>`;
    return;
  }

  // Each thumbnail is a live, scaled-down preview of the project. Its address is kept in data-src
  // and only attached while the card is on (or near) the screen, see setupThumbs().
  // sandbox="allow-scripts" (NO allow-same-origin) keeps participant code away from the judge's session.
  grid.innerHTML = WORKS.map((w) => `
      <div class="work-card" data-id="${esc(w.id)}" onclick="openScore('${w.id}')">
        <div class="work-thumb">
          <div class="thumb-placeholder">
            <span class="tp-ic">🖥️</span>
            <span class="tp-code">${esc(w.code)}</span>
            <span class="tp-hint">Click to preview &amp; score</span>
          </div>
          <iframe class="thumb-frame" data-src="/preview/${encodeURIComponent(w.code)}"
                  title="Preview of ${esc(w.code)}" sandbox="allow-scripts" scrolling="no"
                  tabindex="-1" aria-hidden="true" referrerpolicy="no-referrer"></iframe>
          <div class="thumb-overlay"></div>
          ${scoreBadgeHtml(w)}
        </div>
        <div class="work-body">
          <span class="code-pill">${esc(w.code)}</span>
          <div class="wc-title">${esc(w.project_title)}</div>
          <div class="wc-team">${esc(w.team_name)}${w.category ? " · " + esc(w.category) : ""}</div>
        </div>
        <div class="work-foot">${footerHtml(w)}</div>
      </div>`).join("");

  setupThumbs();
}

// Update ONE card after a save (or a failed save) without touching the other thumbnails.
function refreshCard(workId) {
  const w = WORKS.find((x) => x.id === workId);
  if (w) {
    const card = document.querySelector(`#work-grid .work-card[data-id="${workId}"]`);
    if (card) {
      const thumb = card.querySelector(".work-thumb");
      const oldBadge = thumb.querySelector(".thumb-score");
      if (oldBadge) oldBadge.remove();
      thumb.insertAdjacentHTML("beforeend", scoreBadgeHtml(w));
      card.querySelector(".work-foot").innerHTML = footerHtml(w);
    }
  }
  updateStats();
}

// ---------- Thumbnails: only cards near the screen keep a live preview ----------
// 50 live project pages at once would be heavy for a judge's laptop, so a preview is attached when its
// card scrolls into view (plus a margin) and released when the card is far away. A released card shows
// its placeholder again and reloads from cache when scrolled back.
let thumbObserver = null;
function loadThumb(f) {
  if (f.dataset.loaded === "1") return;
  f.dataset.loaded = "1";
  f.classList.remove("ready");
  f.src = f.dataset.src;
}
function unloadThumb(f) {
  if (f.dataset.loaded !== "1") return;
  f.dataset.loaded = "0";
  f.classList.remove("ready");
  f.src = "about:blank";
}
function setupThumbs() {
  if (thumbObserver) { thumbObserver.disconnect(); thumbObserver = null; }
  const frames = document.querySelectorAll("#work-grid .thumb-frame");
  frames.forEach((f) => {
    // Fade the preview in once it has really loaded (ignore the blank page used to release it).
    f.addEventListener("load", () => { if (f.dataset.loaded === "1") f.classList.add("ready"); });
  });
  if (!("IntersectionObserver" in window)) { frames.forEach(loadThumb); return; }
  thumbObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const f = e.target.querySelector(".thumb-frame");
      if (!f) return;
      if (e.isIntersecting) loadThumb(f); else unloadThumb(f);
    });
  }, { rootMargin: "500px 0px" });
  document.querySelectorAll("#work-grid .work-card").forEach((c) => thumbObserver.observe(c));
}

// ---------- Open the scoring modal ----------
async function openScore(workId) {
  const work = WORKS.find((w) => w.id === workId);
  if (!work) return;
  currentWorkId = workId;

  document.getElementById("score-title").textContent = "Score — " + work.project_title;
  document.getElementById("score-code").textContent = work.code;
  document.getElementById("score-frame").src = `/preview/${encodeURIComponent(work.code)}`;
  document.getElementById("score-msg").textContent = "";
  document.getElementById("score-msg").className = "msg";

  // Reset to default first
  PARAMS.forEach((p) => setParamValue(p.key, 50));
  document.getElementById("score-comment").value = "";
  document.getElementById("score-status").innerHTML = "";

  document.getElementById("score-modal").hidden = false;

  // Fetch the previous score (if any) so it can be edited
  try {
    const data = await apiFetch(`/api/scores?work_id=${encodeURIComponent(workId)}`);
    if (data.score) {
      PARAMS.forEach((p) => setParamValue(p.key, data.score[p.key]));
      document.getElementById("score-comment").value = data.score.comment || "";
      document.getElementById("score-status").innerHTML = '<span class="chip done">✓ Previously scored — editable</span>';
    } else {
      document.getElementById("score-status").innerHTML = '<span class="chip pending">Not scored</span>';
    }
  } catch { /* ignore, keep defaults */ }

  // If a previous save attempt failed, bring back exactly what the judge typed.
  const draft = loadDraft(workId);
  if (draft && currentWorkId === workId) {
    PARAMS.forEach((p) => {
      const v = parseInt(draft.payload[p.key], 10);
      if (!isNaN(v)) setParamValue(p.key, Math.min(100, Math.max(1, v)));
    });
    document.getElementById("score-comment").value = draft.payload.comment || "";
    document.getElementById("score-status").innerHTML =
      '<span class="chip pending">⚠ Unsaved scores restored. Press Submit to save.</span>';
  }
  recalcTotal();
}

function closeScore() {
  document.getElementById("score-modal").hidden = true;
  document.getElementById("score-frame").src = "about:blank";
  currentWorkId = null;
}

// ---------- Submit the score ----------
document.getElementById("score-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentWorkId) return;
  const btn = document.getElementById("score-submit");
  const msg = document.getElementById("score-msg");
  msg.className = "msg"; msg.textContent = "";

  const payload = { work_id: currentWorkId, comment: document.getElementById("score-comment").value.trim() };
  let valid = true;
  PARAMS.forEach((p) => {
    let v = parseInt(document.getElementById("num-" + p.key).value, 10);
    if (isNaN(v) || v < 1 || v > 100) valid = false;
    payload[p.key] = v;
  });
  if (!valid) {
    msg.className = "msg error"; msg.textContent = "Each parameter must be a number from 1 to 100.";
    return;
  }

  // Keep a local copy BEFORE sending. It is removed only after the server confirms.
  const workId = currentWorkId;
  saveDraft(workId, payload);

  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const data = await postWithRetry("/api/scores", payload, {
      onAttempt: (n, total) => {
        btn.textContent = n === 1 ? "Saving..." : `Retrying (${n}/${total})...`;
      },
    });
    // Server confirmed: drop the draft, update the card locally (no reload).
    clearDraft(workId);
    SCORES.set(workId, data.weighted);
    toast(`Score saved (weighted ${Number(data.weighted).toFixed(2)} / 100).`);
    closeScore();
    refreshCard(workId);
  } catch (err) {
    msg.className = "msg error";
    if (err.expired) {
      msg.innerHTML =
        'Your session has expired. <b>Your scores are kept on this device.</b> ' +
        '<a href="/login" onclick="Auth.clear()">Sign in again</a>, open this project, and press Submit.';
    } else {
      msg.textContent =
        `Not saved: ${err.message} Your scores are still here and kept on this device. Press Submit to try again.`;
    }
    refreshCard(workId); // shows the "Unsaved draft" marker on the card
  } finally {
    btn.disabled = false; btn.textContent = "Submit Score";
  }
});

// Close the modal with ESC
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeScore(); });

// ---------- Init ----------
buildParams();
loadWorks();
