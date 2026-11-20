// =====================================================================
//  admin.js — Admin Dashboard logic
// =====================================================================
const admin = guard("admin");
if (admin) document.getElementById("who-name").textContent = admin.name || "Admin";

let RANKING = [];
let DETAILS = [];
let WORKS = [];
let MAX_WORKS = 20;
let editingId = null;

// ---------- Tabs ----------
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  ["ranking", "works", "judges"].forEach((n) => { document.getElementById("tab-" + n).hidden = n !== name; });
  if (name === "works") loadWorks();
  if (name === "judges") loadJudges();
  if (name === "ranking") loadRanking();
}

// ---------- RANKING ----------
async function loadRanking() {
  const body = document.getElementById("ranking-body");
  try {
    const data = await apiFetch("/api/ranking");
    RANKING = data.ranking || [];
    DETAILS = data.details || [];

    document.getElementById("stat-works").textContent = data.stats.totalWorks;
    document.getElementById("stat-judges").textContent = data.stats.totalJudges;
    document.getElementById("stat-scored").textContent = DETAILS.length;
    const top = RANKING.find((r) => Number(r.judge_count) > 0);
    document.getElementById("stat-top").textContent = top ? top.project_title : "-";

    if (!RANKING.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty"><div class="empty-ic">${icon("folder-open", "big")}</div>No projects yet. Add them in the "Projects &amp; Order" tab.</td></tr>`;
      return;
    }

    body.innerHTML = RANKING.map((r, i) => {
      const rank = i + 1;
      const rankCls = rank <= 3 ? `rank-${rank}` : "";
      const hasScore = Number(r.judge_count) > 0;
      const cut = rank === TOP_N && RANKING.length > TOP_N
        ? `<tr class="cut-row"><td colspan="5">Top ${TOP_N} advance above this line</td></tr>` : "";
      return `
        <tr class="clickable ${rank <= TOP_N && hasScore ? "in-top" : ""}" onclick="openDetail('${esc(r.id)}')">
          <td><span class="rank-badge ${rankCls}">${rank}</span></td>
          <td>
            <div class="cell-title">${showTeamNo(r) ? `<span class="team-no">T${r.team_number}</span> ` : ""}${esc(r.project_title)}${r.fallback ? ' <span class="bdg bdg-warn">Fallback</span>' : ""}</div>
            <div class="cell-sub">${esc(teamSubline(r))}</div>
          </td>
          <td><span class="order-badge sm">${r.position || "–"}</span></td>
          <td>${hasScore ? `<span class="chip done">${r.judge_count}</span>` : `<span class="chip pending">none</span>`}</td>
          <td>${hasScore ? `<div class="meter"><span class="meter-track" aria-hidden="true"><span class="meter-fill" style="width:${Math.max(0, Math.min(100, Number(r.avg_weighted)))}%"></span></span><span class="score-cell">${Number(r.avg_weighted).toFixed(2)}</span></div>` : `<span class="t-mute">Not scored</span>`}</td>
        </tr>${cut}`;
    }).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="empty">${esc(err.message)}</td></tr>`;
  }
}

function openDetail(workId) {
  const work = RANKING.find((r) => r.id === workId);
  if (!work) return;
  const rows = DETAILS.filter((d) => d.work_id === workId);
  document.getElementById("detail-title").textContent = work.project_title;

  document.getElementById("detail-head").innerHTML =
    "<tr><th>Judge</th>" +
    CRITERIA.map((c) => `<th title="${esc(c.name)} (${c.weight}%)">${esc(c.short)}<small>${c.weight}%</small></th>`).join("") +
    "<th>Weighted</th></tr>";

  const body = document.getElementById("detail-body");
  const comments = document.getElementById("detail-comments");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${CRITERIA.length + 2}" class="empty">No judge has scored this project yet.</td></tr>`;
    comments.innerHTML = "";
  } else {
    body.innerHTML = rows.map((d) => `
      <tr>
        <td class="cell-title">${esc(d.judge_name)}</td>
        ${CRITERIA.map((c) => `<td>${d[c.key]}</td>`).join("")}
        <td class="score-cell">${Number(d.weighted).toFixed(2)}</td>
      </tr>`).join("") + `
      <tr class="avg-row">
        <td class="cell-title">Average</td>
        ${CRITERIA.map((c) => `<td>${work["avg_" + c.key]}</td>`).join("")}
        <td class="score-cell">${Number(work.avg_weighted).toFixed(2)}</td>
      </tr>`;

    const withComment = rows.filter((d) => d.comment);
    comments.innerHTML = withComment.length
      ? `<h2 style="font-size:14px;margin-bottom:8px">Judge comments</h2>` +
        withComment.map((d) => `<div class="comment-box"><b>${esc(d.judge_name)}:</b> <span>${esc(d.comment)}</span></div>`).join("")
      : "";
  }
  document.getElementById("detail-modal").hidden = false;
}
function closeDetail() { document.getElementById("detail-modal").hidden = true; }


// ---------- PROJECTS & ORDER ----------
async function loadWorks() {
  const list = document.getElementById("works-list");
  try {
    const data = await apiFetch("/api/works");
    WORKS = data.works || [];
    MAX_WORKS = data.max || 20;
    renderWorks();
    showSyncNote(data.sync);
  } catch (err) {
    list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// ----- Submission form sync -----
// Projects come in automatically from the form. Each one shows where it came from.
function sourceBadges(w) {
  if (!w.source_submitted_at) return "";
  const n = Number(w.source_count) || 1;
  let h = `<span class="bdg" title="Added from the submission form. Latest submission: ${esc(fmtDate(w.source_submitted_at))}">${icon("upload")} From form${n > 1 ? " (" + n + " submissions)" : ""}</span>`;
  if (w.source_conflict) h += `<span class="bdg bdg-warn" title="Another email address submitted the same team number, so this project has no team number. Please verify.">${icon("status-warning")} Team number clash</span>`;
  return h;
}

// Shown only when something is worth saying: new/updated projects, skipped rows, or warnings.
function showSyncNote(sync) {
  const box = document.getElementById("sync-note");
  if (!box) return;
  const lines = [];
  if (sync && sync.added) lines.push(`<b>${sync.added} new project${sync.added > 1 ? "s" : ""}</b> added from the submission form.`);
  if (sync && sync.updated) lines.push(`<b>${sync.updated} project${sync.updated > 1 ? "s" : ""}</b> updated from a newer submission.`);
  ((sync && sync.skipped) || []).forEach((s) => lines.push(esc(s)));
  ((sync && sync.warnings) || []).forEach((s) => lines.push(esc(s)));
  box.hidden = !lines.length;
  box.className = "check-summary " + (sync && sync.skipped && sync.skipped.length ? "has-bad" : "all-ok");
  box.innerHTML = lines.join("<br>");
}

async function syncNow() {
  const btn = document.getElementById("sync-btn");
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = "Syncing...";
  try {
    const r = await apiFetch("/api/sync-submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await loadWorks();
    showSyncNote(r);
    toast(r.added || r.updated ? `Synced: ${r.added} new, ${r.updated} updated.` : "Already up to date with the submission form.");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.innerHTML = label; btn.disabled = false;
  }
}

function yesNoBadge(label, v) {
  if (v === true) return `<span class="bdg bdg-yes">${icon("status-positive")} ${label}</span>`;
  if (v === false) return `<span class="bdg bdg-no">${icon("status-negative")} ${label}</span>`;
  return "";
}

function linkBadge(w) {
  if (w.link_ok === true) return `<span class="bdg bdg-ok" title="${esc("HTTP " + w.link_status + " · checked " + fmtDate(w.link_checked_at))}">${icon("status-positive")} Link OK</span>`;
  if (w.link_ok === false) return `<span class="bdg bdg-bad" title="${esc((w.link_note || "Failed") + " · checked " + fmtDate(w.link_checked_at))}">${icon("status-negative")} ${esc(w.link_note || "Link failed")}</span>`;
  return `<span class="bdg">${icon("status-pending")} Not checked</span>`;
}

function renderWorks() {
  const list = document.getElementById("works-list");
  document.getElementById("works-count").textContent = `${WORKS.length} / ${MAX_WORKS}`;
  document.getElementById("stat-works").textContent = WORKS.length;
  document.getElementById("work-submit").disabled = !editingId && WORKS.length >= MAX_WORKS;
  document.getElementById("check-all-btn").disabled = !WORKS.length;

  if (!WORKS.length) {
    list.innerHTML = `<div class="empty"><div class="empty-ic">${icon("folder-open", "big")}</div>No projects yet. Add one or import from the submission form.</div>`;
    return;
  }
  const opts = (cur) => WORKS.map((_, k) => `<option value="${k + 1}" ${k + 1 === cur ? "selected" : ""}>${k + 1}</option>`).join("");

  list.innerHTML = WORKS.map((w, i) => `
    <div class="order-item ${w.fallback ? "is-fallback" : ""}">
      <span class="order-badge">${i + 1}</span>
      <div class="oi-main">
        <div class="cell-title">${showTeamNo(w) ? `<span class="team-no">T${w.team_number}</span> ` : ""}${esc(w.project_title)}</div>
        <div class="cell-sub">${esc(teamSubline(w))}</div>
        <div class="bdg-row">
          ${linkBadge(w)}
          ${w.fallback ? `<span class="bdg bdg-warn">${icon("status-warning")} Fallback</span>` : ""}
          ${yesNoBadge("Bedrock", w.bedrock_used)}${yesNoBadge("AgentCore", w.agentcore_used)}
          ${w.video_url ? `<span class="bdg">${icon("video-on")} Video</span>` : ""}${w.screenshot_url ? `<span class="bdg">${icon("file")} Screenshot</span>` : ""}
          ${sourceBadges(w)}
        </div>
        <a class="oi-link" href="${esc(w.project_url)}" target="_blank" rel="noopener noreferrer">${esc(w.project_url)}</a>
      </div>
      <div class="oi-controls">
        <div class="oi-move">
          <button class="icon-btn" ${i === 0 ? "disabled" : ""} onclick="moveWork(${i}, ${i - 1})" aria-label="Move up">${icon("angle-up")}</button>
          <select class="oi-select" onchange="moveWork(${i}, this.value - 1)" aria-label="Position">${opts(i + 1)}</select>
          <button class="icon-btn" ${i === WORKS.length - 1 ? "disabled" : ""} onclick="moveWork(${i}, ${i + 1})" aria-label="Move down">${icon("angle-down")}</button>
        </div>
        <div class="oi-actions">
          <button class="btn btn-ghost btn-sm" onclick="checkLinks('${esc(w.id)}')">Check</button>
          <button class="btn btn-ghost btn-sm" onclick="editWork('${esc(w.id)}')">Edit</button>
          <button class="btn btn-danger btn-sm" data-id="${esc(w.id)}" data-title="${esc(w.project_title)}" onclick="deleteWork(this.dataset.id, this.dataset.title)">Delete</button>
        </div>
      </div>
    </div>`).join("");
}

async function moveWork(from, to) {
  to = parseInt(to, 10);
  if (isNaN(to) || to < 0 || to >= WORKS.length || to === from) { renderWorks(); return; }
  const prev = WORKS.slice();
  const next = WORKS.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  WORKS = next;
  renderWorks();
  try {
    await apiFetch("/api/works", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: WORKS.map((w) => w.id) }),
    });
    toast(`Moved to position ${to + 1}.`);
  } catch (err) {
    WORKS = prev;
    renderWorks();
    toast(err.message, "error");
  }
}

// ----- Link check (server side, so the real HTTP status can be read) -----
async function checkLinks(id) {
  const btn = document.getElementById("check-all-btn");
  const box = document.getElementById("check-summary");
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = id ? "Checking..." : "Checking all links...";
  try {
    const data = await apiFetch("/api/check-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    await loadWorks();
    if (!id) {
      const bad = WORKS.filter((w) => w.link_ok === false);
      box.hidden = false;
      box.className = "check-summary " + (bad.length ? "has-bad" : "all-ok");
      box.innerHTML = bad.length
        ? `<b>${bad.length} of ${data.checked} links failed</b> at ${fmtDate(new Date().toISOString())}: ` +
          bad.map((w) => `${w.team_number ? "T" + w.team_number + " " : ""}${esc(w.project_title)} (${esc(w.link_note || "failed")})`).join(" · ") +
          `<br>Open <b>Edit</b> on those projects and tick <b>Mark as fallback</b> if the team cannot fix the link.`
        : `<b>All ${data.checked} links are working</b> (checked ${fmtDate(new Date().toISOString())}).`;
    } else {
      const r = data.results[0];
      toast(r.ok ? "Link is working." : "Link failed: " + (r.note || "unknown"), r.ok ? "success" : "error");
    }
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.textContent = label; btn.disabled = !WORKS.length;
  }
}

// ----- Add / edit form -----
const yn = (v) => (v === true ? "yes" : v === false ? "no" : "");

function editWork(id) {
  const w = WORKS.find((x) => x.id === id);
  if (!w) return;
  editingId = id;
  document.getElementById("w-team").value = w.team_name;
  document.getElementById("w-title").value = w.project_title;
  document.getElementById("w-category").value = w.category || "";
  document.getElementById("w-url").value = w.project_url || "";
  document.getElementById("w-number").value = w.team_number || "";
  document.getElementById("w-bedrock").value = yn(w.bedrock_used);
  document.getElementById("w-agentcore").value = yn(w.agentcore_used);
  document.getElementById("w-video").value = w.video_url || "";
  document.getElementById("w-shot").value = w.screenshot_url || "";
  document.getElementById("w-repo").value = w.repo_url || "";
  document.getElementById("w-fallback").checked = !!w.fallback;
  document.getElementById("w-more").open = !!(w.fallback || w.video_url || w.screenshot_url || w.repo_url);
  document.getElementById("work-form-title").textContent = "Edit Project";
  document.getElementById("work-submit").textContent = "Update Project";
  document.getElementById("work-submit").disabled = false;
  document.getElementById("work-cancel").hidden = false;
  document.getElementById("work-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetWorkForm() {
  editingId = null;
  document.getElementById("work-form").reset();
  document.getElementById("w-more").open = false;
  document.getElementById("work-form-title").textContent = "Add Project";
  document.getElementById("work-submit").textContent = "Save Project";
  document.getElementById("work-cancel").hidden = true;
  document.getElementById("work-msg").textContent = "";
  renderWorks();
}

document.getElementById("work-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("work-submit");
  const msg = document.getElementById("work-msg");
  msg.className = "msg"; msg.textContent = "";

  const payload = {
    team_name: document.getElementById("w-team").value.trim(),
    project_title: document.getElementById("w-title").value.trim(),
    category: document.getElementById("w-category").value.trim(),
    project_url: document.getElementById("w-url").value.trim(),
    team_number: document.getElementById("w-number").value.trim(),
    bedrock_used: document.getElementById("w-bedrock").value,
    agentcore_used: document.getElementById("w-agentcore").value,
    video_url: document.getElementById("w-video").value.trim(),
    screenshot_url: document.getElementById("w-shot").value.trim(),
    repo_url: document.getElementById("w-repo").value.trim(),
    fallback: document.getElementById("w-fallback").checked,
  };
  if (!payload.team_name || !payload.project_title || !payload.project_url) {
    msg.className = "msg error"; msg.textContent = "Team name, title, and project link are required.";
    return;
  }

  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    if (editingId) {
      await apiFetch("/api/works", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
      toast("Project updated.");
    } else {
      const data = await apiFetch("/api/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast(`Project added at position ${data.work.position}.`);
    }
    editingId = null;
    resetWorkForm();
    await loadWorks();
  } catch (err) {
    msg.className = "msg error"; msg.textContent = err.message;
    btn.textContent = label;
    btn.disabled = false;
  }
});

async function deleteWork(id, title) {
  if (!confirm(`Delete project "${title}"? All scores for this project will also be removed.`)) return;
  try {
    await apiFetch(`/api/works?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    toast("Project deleted.");
    if (editingId === id) resetWorkForm();
    loadWorks();
  } catch (err) { toast(err.message, "error"); }
}

// ----- Import from the submission form (CSV / JSON) -----
let IMPORT_ROWS = null;

// Minimal CSV parser: quoted fields, escaped quotes, commas/newlines inside quotes.
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = []; let row = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

function parseImportText(text) {
  const t = text.trim();
  if (!t) return [];
  if (t[0] === "[" || t[0] === "{") {
    const j = JSON.parse(t);
    if (Array.isArray(j)) return j;
    for (const k of ["rows", "submissions", "data", "items"]) if (Array.isArray(j[k])) return j[k];
    throw new Error("JSON must be an array of submissions.");
  }
  return parseCsv(t);
}

document.getElementById("imp-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById("imp-text").value = await file.text();
  document.getElementById("imp-text").hidden = false;
  IMPORT_ROWS = null;
  document.getElementById("imp-apply").disabled = true;
  document.getElementById("imp-result").innerHTML = "";
});

async function runImport(dry) {
  const out = document.getElementById("imp-result");
  const applyBtn = document.getElementById("imp-apply");
  const prevBtn = document.getElementById("imp-preview");
  try {
    if (dry || !IMPORT_ROWS) IMPORT_ROWS = parseImportText(document.getElementById("imp-text").value);
    if (!IMPORT_ROWS.length) { out.innerHTML = `<div class="msg error">No rows found. Choose a file or paste the export first.</div>`; return; }
  } catch (err) {
    out.innerHTML = `<div class="msg error">Could not read the data: ${esc(err.message)}</div>`;
    return;
  }
  if (!dry && !confirm("Apply this import? Existing projects with the same team number will be updated.")) return;

  applyBtn.disabled = true; prevBtn.disabled = true;
  try {
    const data = await apiFetch("/api/import-works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: IMPORT_ROWS, dry_run: dry }),
    });
    const blockers = (data.errors || []).filter((x) => !x.startsWith("Row"));
    const list = (arr, cls) => arr && arr.length ? `<ul class="imp-list ${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    out.innerHTML =
      `<div class="imp-summary"><b>${data.summary.add}</b> to add · <b>${data.summary.update}</b> to update · <b>${data.summary.skipped}</b> rows skipped</div>` +
      list(data.errors, "bad") + list(data.warnings, "warn") +
      (data.plan.length ? `<div class="table-wrap"><table><thead><tr><th>Action</th><th>Team</th><th>Project</th><th>Link</th><th>Bedrock</th><th>AgentCore</th></tr></thead><tbody>` +
        data.plan.map((p) => `<tr><td><span class="chip ${p.action === "add" ? "done" : "pending"}">${p.action}</span></td><td class="cell-title">T${p.team_number} · ${esc(p.team_name)}</td><td>${esc(p.project_title)}</td><td class="oi-link-cell">${esc(p.project_url)}${p.url_changed ? " <span class='bdg bdg-warn'>link changed</span>" : ""}</td><td>${p.bedrock_used === null ? "—" : p.bedrock_used ? "Yes" : "No"}</td><td>${p.agentcore_used === null ? "—" : p.agentcore_used ? "Yes" : "No"}</td></tr>`).join("") +
        `</tbody></table></div>` : "");
    if (data.applied) {
      toast(`Import done: ${data.summary.add} added, ${data.summary.update} updated.`);
      IMPORT_ROWS = null;
      loadWorks();
    } else {
      applyBtn.disabled = blockers.length > 0 || !data.plan.length;
    }
  } catch (err) {
    out.innerHTML = `<div class="msg error">${esc(err.message)}</div>`;
  } finally {
    prevBtn.disabled = false;
    if (!dry) applyBtn.disabled = true;
  }
}

// ---------- JUDGES ----------
async function loadJudges() {
  const body = document.getElementById("judges-body");
  try {
    const data = await apiFetch("/api/judges");
    const judges = data.judges || [];
    document.getElementById("stat-judges").textContent = judges.length;
    if (!judges.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty"><div class="empty-ic">${icon("folder-open", "big")}</div>No judges yet.</td></tr>`;
      return;
    }
    body.innerHTML = judges.map((j) => `
      <tr>
        <td class="cell-title">${esc(j.name)}</td>
        <td><span class="code-pill">${esc(j.username)}</span></td>
        <td>${j.scored_count}</td>
        <td style="text-align:right"><button class="btn btn-danger btn-sm" data-id="${esc(j.id)}" data-name="${esc(j.name)}" onclick="deleteJudge(this.dataset.id, this.dataset.name)">Delete</button></td>
      </tr>`).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="empty">${esc(err.message)}</td></tr>`;
  }
}

document.getElementById("judge-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("judge-submit");
  const msg = document.getElementById("judge-msg");
  msg.className = "msg"; msg.textContent = "";

  const payload = {
    name: document.getElementById("j-name").value.trim(),
    username: document.getElementById("j-username").value.trim(),
    password: document.getElementById("j-password").value.trim(),
  };
  if (!payload.name || !payload.username || !payload.password) {
    msg.className = "msg error"; msg.textContent = "Please fill in all fields.";
    return;
  }

  btn.disabled = true; btn.textContent = "Creating...";
  try {
    await apiFetch("/api/judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    toast(`Judge account "${payload.username}" created.`);
    e.target.reset();
    loadJudges();
  } catch (err) {
    msg.className = "msg error"; msg.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Create Judge Account";
  }
});

async function deleteJudge(id, name) {
  if (!confirm(`Delete judge account "${name}"? All scores from this judge will also be removed.`)) return;
  try {
    await apiFetch(`/api/judges?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    toast("Judge account deleted.");
    loadJudges();
  } catch (err) { toast(err.message, "error"); }
}

// ---------- Init ----------
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
loadRanking();
