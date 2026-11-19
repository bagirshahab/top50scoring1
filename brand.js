// =====================================================================
//  brand.js — Left panel of the sign-in and landing screens
//
//  Renders into <aside id="brand-panel">:
//   - wordmark, title, and the four judging steps
//   - a looping "cue board": 20 tiles are scored one by one, then the Top 5 light up.
//     It is an illustration of the process, not data. Tile numbers 01-20 stand for the
//     presentation order; which five advance in the loop is arbitrary.
//   - the rubric weights (from criteria.js)
//   - a live Bangkok clock and the real state of the judging window (OPEN_AT / CLOSE_AT
//     are defined by the page that loads this file)
//  Motion stops when the tab is hidden and is replaced by a still frame when the visitor
//  prefers reduced motion.
// =====================================================================
(function () {
  var root = document.getElementById("brand-panel");
  if (!root || typeof CRITERIA === "undefined") return;

  var TOTAL = 20;
  var ADVANCE = typeof TOP_N === "number" ? TOP_N : 5;
  var LIT = [2, 6, 10, 13, 17]; // 03, 07, 11, 14, 18: arbitrary, for the illustration only
  var pad2 = function (n) { return String(n).padStart(2, "0"); };
  var ico = function (n) { return typeof icon === "function" ? icon(n) : ""; };

  var tiles = "";
  for (var i = 1; i <= TOTAL; i++) tiles += '<span class="cue-tile">' + pad2(i) + "</span>";

  var steps = ["Watch the pitch", "Score five criteria", "Submit", "Top " + ADVANCE + " advance"]
    .map(function (s, k) {
      return '<li><b>' + (k + 1) + "</b>" + s + "</li>" + (k < 3 ? '<li class="step-arrow" aria-hidden="true">' + ico("angle-right") + "</li>" : "");
    }).join("");

  var bar = CRITERIA.map(function (c) { return '<i style="flex:' + c.weight + '"></i>'; }).join("");
  var list = CRITERIA.map(function (c) { return "<li><span>" + c.name + "</span><b>" + c.weight + "%</b></li>"; }).join("");

  root.innerHTML =
    '<div class="brand-top">' +
      '<span class="logo-wordmark">AI For All Hackathon</span>' +
      '<h1 class="auth-title">Demo Day <span class="accent">Judging</span><span class="sub">Round 2 &middot; Top 20 &rarr; Top ' + ADVANCE + "</span></h1>" +
      '<ol class="steps">' + steps + "</ol>" +
    "</div>" +
    '<section class="cue-stage" aria-label="Illustration: twenty teams are scored, the top ' + ADVANCE + ' advance">' +
      '<div class="cue-stage-head">' +
        '<span class="cue-tag">Illustration</span>' +
        '<span class="cue-counter"><b id="cue-scored">00</b> / ' + TOTAL + " scored</span>" +
        '<span class="cue-counter"><b id="cue-adv">0</b> / ' + ADVANCE + " advance</span>" +
      "</div>" +
      '<div class="cue-grid" id="cue-grid" aria-hidden="true">' + tiles + "</div>" +
      '<p class="cue-caption" id="cue-caption">Judges score every team</p>' +
    "</section>" +
    '<div class="brand-bottom">' +
      '<section class="auth-criteria" aria-labelledby="crit-h">' +
        '<h2 id="crit-h">Five criteria, weighted to 100</h2>' +
        '<div class="weights" aria-hidden="true">' + bar + "</div>" +
        '<ul class="weights-list">' + list + "</ul>" +
      "</section>" +
      '<div class="brand-foot">' +
        '<span class="live-clock" title="Venue time"><b id="live-clock">--:--:--</b></span>' +
        '<span id="live-state"></span>' +
      "</div>" +
    "</div>";

  // ---- live clock + real state of the judging window ----
  var fmt = null;
  try { fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }); } catch (e) { /* old browser */ }
  function tick() {
    var now = new Date();
    document.getElementById("live-clock").textContent = fmt ? fmt.format(now) : now.toLocaleTimeString();
    var el = document.getElementById("live-state");
    if (typeof JUDGING_OPEN_AT === "undefined" || typeof JUDGING_CLOSE_AT === "undefined") { el.innerHTML = ""; return; }
    var t = now.getTime(), html;
    if (t < JUDGING_OPEN_AT) html = '<span class="bdg bdg-warn">' + ico("status-in-progress") + " Opens " + new Date(JUDGING_OPEN_AT).toLocaleString("en-US", { timeZone: "Asia/Bangkok", weekday: "short", month: "short", day: "numeric", hour: "2-digit", hour12: true }).replace(/,/g, "") + "</span>";
    else if (t >= JUDGING_CLOSE_AT) html = '<span class="bdg bdg-bad">' + ico("lock-private") + " Judging closed</span>";
    else html = '<span class="bdg bdg-ok">' + ico("status-positive") + " Judging is open</span>";
    if (el.dataset.k !== html) { el.innerHTML = html; el.dataset.k = html; }
  }
  tick();
  document.addEventListener("DOMContentLoaded", tick); // criteria.js defines JUDGING_OPEN_AT / JUDGING_CLOSE_AT
  setInterval(tick, 1000);

  // ---- the cue board loop ----
  var grid = document.getElementById("cue-grid");
  var cells = Array.prototype.slice.call(grid.children);
  var scoredEl = document.getElementById("cue-scored");
  var advEl = document.getElementById("cue-adv");
  var captionEl = document.getElementById("cue-caption");
  var alive = true;

  function caption(t) { captionEl.textContent = t; }
  function reset() {
    cells.forEach(function (c) { c.className = "cue-tile"; });
    scoredEl.textContent = "00"; advEl.textContent = "0";
  }
  function stillFrame() {
    cells.forEach(function (c, i) { c.className = "cue-tile " + (LIT.indexOf(i) > -1 ? "is-top" : "is-out"); });
    scoredEl.textContent = String(TOTAL); advEl.textContent = String(ADVANCE);
    caption("Top " + ADVANCE + " advance");
  }
  function sleep(ms) {
    return new Promise(function (resolve) {
      (function wait() {
        // do not burn battery in a background tab
        if (document.hidden) return setTimeout(wait, 500);
        setTimeout(resolve, ms);
      })();
    });
  }

  async function cycle() {
    reset(); caption("Judges score every team"); await sleep(900);
    for (var i = 0; i < TOTAL && alive; i++) {
      cells[i].classList.add("is-scoring"); await sleep(90);
      cells[i].classList.remove("is-scoring"); cells[i].classList.add("is-scored");
      scoredEl.textContent = pad2(i + 1); await sleep(80);
    }
    caption("Scores are averaged and ranked"); await sleep(700);
    cells.forEach(function (c, k) { if (LIT.indexOf(k) < 0) { c.classList.remove("is-scored"); c.classList.add("is-out"); } });
    await sleep(650);
    for (var j = 0; j < LIT.length && alive; j++) {
      cells[LIT[j]].classList.remove("is-scored"); cells[LIT[j]].classList.add("is-top");
      advEl.textContent = String(j + 1); await sleep(170);
    }
    caption("Top " + ADVANCE + " advance"); await sleep(3200);
    reset(); caption("Judges score every team"); await sleep(600);
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) stillFrame();
  else (async function run() { while (alive) await cycle(); })();
})();
