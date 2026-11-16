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
    document.getElementById("stat-top").textContent = top ? top.project_title : "—";

    if (!RANKING.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty"><div class="empty-ic">📭</div>No projects yet. Add them in the "Projects &amp; Order" tab.</td></tr>`;
      return;
    }

    body.innerHTML = RANKING.map((r, i) => {
      const rank = i + 1;
      const rankCls = rank <= 3 ? `rank-${rank}` : "";
      const hasScore = Number(r.judge_count) > 0;
      const cut = rank === TOP_N && RANKING.length > TOP_N
        ? `<tr class="cut-row"><td colspan="5">Top ${TOP_N} advance · cut line</td></tr>` : "";
      return `
        <tr class="clickable ${rank <= TOP_N && hasScore ? "in-top" : ""}" onclick="openDetail('${esc(r.id)}')">
          <td><span class="rank-badge ${rankCls}">${rank}</span></td>
          <td>
            <div class="cell-title">${esc(r.project_title)}</div>
            <div class="cell-sub">${esc(r.team_name)}${r.category ? " · " + esc(r.category) : ""}</div>
          </td>
          <td><span class="order-badge sm">${r.position || "–"}</span></td>
          <td>${hasScore ? `<span class="chip done">${r.judge_count}</span>` : `<span class="chip pending">none</span>`}</td>
          <td><span class="score-cell">${hasScore ? Number(r.avg_weighted).toFixed(2) : "—"}</span></td>
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
      ? `<h2 style="font-size:14px;margin-bottom:8px">💬 Judge comments</h2>` +
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
  } catch (err) {
    list.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function renderWorks() {
  const list = document.getElementById("works-list");
  document.getElementById("works-count").textContent = `${WORKS.length} / ${MAX_WORKS}`;
  document.getElementById("stat-works").textContent = WORKS.length;
  document.getElementById("work-submit").disabled = !editingId && WORKS.length >= MAX_WORKS;

  if (!WORKS.length) {
    list.innerHTML = `<div class="empty"><div class="empty-ic">📋</div>No projects yet. Add the first one.</div>`;
    return;
  }
  const opts = (cur) => WORKS.map((_, k) => `<option value="${k + 1}" ${k + 1 === cur ? "selected" : ""}>${k + 1}</option>`).join("");

  list.innerHTML = WORKS.map((w, i) => `
    <div class="order-item">
      <span class="order-badge">${i + 1}</span>
      <div class="oi-main">
        <div class="cell-title">${esc(w.project_title)}</div>
        <div class="cell-sub">${esc(w.team_name)}${w.category ? " · " + esc(w.category) : ""}</div>
        <a class="oi-link" href="${esc(w.project_url)}" target="_blank" rel="noopener noreferrer">${esc(w.project_url)}</a>
      </div>
      <div class="oi-controls">
        <div class="oi-move">
          <button class="icon-btn" ${i === 0 ? "disabled" : ""} onclick="moveWork(${i}, ${i - 1})" aria-label="Move up">▲</button>
          <select class="oi-select" onchange="moveWork(${i}, this.value - 1)" aria-label="Position">${opts(i + 1)}</select>
          <button class="icon-btn" ${i === WORKS.length - 1 ? "disabled" : ""} onclick="moveWork(${i}, ${i + 1})" aria-label="Move down">▼</button>
        </div>
        <div class="oi-actions">
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

function editWork(id) {
  const w = WORKS.find((x) => x.id === id);
  if (!w) return;
  editingId = id;
  document.getElementById("w-team").value = w.team_name;
  document.getElementById("w-title").value = w.project_title;
  document.getElementById("w-category").value = w.category || "";
  document.getElementById("w-url").value = w.project_url || "";
  document.getElementById("work-form-title").textContent = "✏️ Edit Project";
  document.getElementById("work-submit").textContent = "Update Project";
  document.getElementById("work-submit").disabled = false;
  document.getElementById("work-cancel").hidden = false;
  document.getElementById("work-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetWorkForm() {
  editingId = null;
  document.getElementById("work-form").reset();
  document.getElementById("work-form-title").textContent = "➕ Add Project";
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

// ---------- JUDGES ----------
async function loadJudges() {
  const body = document.getElementById("judges-body");
  try {
    const data = await apiFetch("/api/judges");
    const judges = data.judges || [];
    document.getElementById("stat-judges").textContent = judges.length;
    if (!judges.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty"><div class="empty-ic">👨‍⚖️</div>No judges yet.</td></tr>`;
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
