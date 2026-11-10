// =====================================================================
//  admin.js — Admin Dashboard logic
// =====================================================================
const admin = guard("admin");
if (admin) document.getElementById("who-name").textContent = admin.name || "Admin";

let RANKING = [];
let DETAILS = [];

// ---------- Tabs ----------
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  ["ranking", "works", "judges"].forEach((n) => {
    document.getElementById("tab-" + n).hidden = n !== name;
  });
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

    // Stats
    document.getElementById("stat-works").textContent = data.stats.totalWorks;
    document.getElementById("stat-judges").textContent = data.stats.totalJudges;
    const scoredCount = DETAILS.length;
    document.getElementById("stat-scored").textContent = scoredCount;
    const top = RANKING.find((r) => Number(r.judge_count) > 0);
    document.getElementById("stat-top").textContent = top ? top.code : "—";

    if (!RANKING.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty"><div class="empty-ic">📭</div>No projects yet. Add them in the "Projects" tab.</td></tr>`;
      return;
    }

    body.innerHTML = RANKING.map((r, i) => {
      const rank = i + 1;
      const rankCls = rank <= 3 ? `rank-${rank}` : "";
      const hasScore = Number(r.judge_count) > 0;
      return `
        <tr style="cursor:pointer" onclick="openDetail('${r.id}')">
          <td><span class="rank-badge ${rankCls}">${rank}</span></td>
          <td><span class="code-pill">${esc(r.code)}</span></td>
          <td>
            <div style="font-weight:700">${esc(r.project_title)}</div>
            <div style="font-size:12.5px;color:var(--muted)">${esc(r.team_name)}${r.category ? " · " + esc(r.category) : ""}</div>
          </td>
          <td>${hasScore ? `<span class="chip done">${r.judge_count} judge${Number(r.judge_count) > 1 ? "s" : ""}</span>` : `<span class="chip pending">none</span>`}</td>
          <td><span class="score-cell">${hasScore ? Number(r.avg_weighted).toFixed(2) : "—"}</span></td>
        </tr>`;
    }).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty">${esc(err.message)}</td></tr>`;
  }
}

function openDetail(workId) {
  const work = RANKING.find((r) => r.id === workId);
  const rows = DETAILS.filter((d) => d.work_id === workId);
  document.getElementById("detail-title").textContent = `Score Breakdown — ${work.project_title}`;

  const body = document.getElementById("detail-body");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">No judge has scored this project yet.</td></tr>`;
    document.getElementById("detail-comments").innerHTML = "";
  } else {
    body.innerHTML = rows.map((d) => `
      <tr>
        <td style="font-weight:600">${esc(d.judge_name)}</td>
        <td>${d.problem}</td><td>${d.solution}</td><td>${d.evidence}</td>
        <td>${d.feasibility}</td><td>${d.ux}</td>
        <td class="score-cell">${Number(d.weighted).toFixed(2)}</td>
      </tr>`).join("") + `
      <tr style="background:rgba(251,191,36,0.08)">
        <td style="font-weight:800">Average</td>
        <td>${work.avg_problem}</td><td>${work.avg_solution}</td><td>${work.avg_evidence}</td>
        <td>${work.avg_feasibility}</td><td>${work.avg_ux}</td>
        <td class="score-cell">${Number(work.avg_weighted).toFixed(2)}</td>
      </tr>`;

    const comments = rows.filter((d) => d.comment);
    document.getElementById("detail-comments").innerHTML = comments.length
      ? `<h2 style="font-size:14px;margin-bottom:8px">💬 Judge Comments</h2>` +
        comments.map((d) => `<div style="background:var(--card-2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px"><b style="font-size:13px">${esc(d.judge_name)}:</b> <span style="color:var(--muted);font-size:13px">${esc(d.comment)}</span></div>`).join("")
      : "";
  }
  document.getElementById("detail-modal").hidden = false;
}
function closeDetail() { document.getElementById("detail-modal").hidden = true; }

// ---------- PROJECTS ----------
async function loadWorks() {
  const body = document.getElementById("works-body");
  try {
    const data = await apiFetch("/api/works");
    const works = data.works || [];
    if (!works.length) {
      body.innerHTML = `<tr><td colspan="3" class="empty"><div class="empty-ic">📦</div>No projects yet.</td></tr>`;
      return;
    }
    body.innerHTML = works.map((w) => `
      <tr>
        <td><span class="code-pill">${esc(w.code)}</span></td>
        <td>
          <div style="font-weight:700">${esc(w.project_title)}</div>
          <div style="font-size:12.5px;color:var(--muted)">${esc(w.team_name)}</div>
        </td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" data-code="${esc(w.code)}" data-title="${esc(w.project_title)}" onclick="openPreview(this.dataset.code, this.dataset.title)">Preview</button>
          <button class="btn btn-danger btn-sm" data-id="${esc(w.id)}" data-title="${esc(w.project_title)}" onclick="deleteWork(this.dataset.id, this.dataset.title)">Delete</button>
        </td>
      </tr>`).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="3" class="empty">${esc(err.message)}</td></tr>`;
  }
}

// Read the HTML file when selected
document.getElementById("w-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  document.getElementById("w-html").value = text;
  toast("HTML file loaded into the text box.");
});

document.getElementById("work-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("work-submit");
  const msg = document.getElementById("work-msg");
  msg.className = "msg";
  msg.textContent = "";

  const payload = {
    team_name: document.getElementById("w-team").value.trim(),
    project_title: document.getElementById("w-title").value.trim(),
    category: document.getElementById("w-category").value.trim(),
    html_content: document.getElementById("w-html").value,
  };
  if (!payload.team_name || !payload.project_title || !payload.html_content.trim()) {
    msg.className = "msg error"; msg.textContent = "Team name, title, and HTML are required.";
    return;
  }

  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const data = await apiFetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    toast(`Project saved: ${data.work.code}`);
    e.target.reset();
    document.getElementById("w-html").value = "";
    loadWorks();
  } catch (err) {
    msg.className = "msg error"; msg.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Save Project";
  }
});

async function deleteWork(id, title) {
  if (!confirm(`Delete project "${title}"? All scores for this project will also be removed.`)) return;
  try {
    await apiFetch(`/api/works?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    toast("Project deleted.");
    loadWorks();
  } catch (err) { toast(err.message, "error"); }
}

// ---------- PREVIEW ----------
function openPreview(code, title) {
  document.getElementById("preview-title").textContent = "Preview — " + title;
  document.getElementById("preview-frame").src = `/preview/${encodeURIComponent(code)}`;
  document.getElementById("preview-modal").hidden = false;
}
function closePreview() {
  document.getElementById("preview-modal").hidden = true;
  document.getElementById("preview-frame").src = "about:blank";
}

// ---------- JUDGES ----------
async function loadJudges() {
  const body = document.getElementById("judges-body");
  try {
    const data = await apiFetch("/api/judges");
    const judges = data.judges || [];
    if (!judges.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty"><div class="empty-ic">👨‍⚖️</div>No judges yet.</td></tr>`;
      return;
    }
    body.innerHTML = judges.map((j) => `
      <tr>
        <td style="font-weight:600">${esc(j.name)}</td>
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
loadRanking();
