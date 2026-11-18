// =====================================================================
//  theme.js — Light / Dark theme
//  - Default follows the device setting (prefers-color-scheme).
//  - The choice is remembered in localStorage ("pjt_theme": "light" | "dark").
//  - Load this file in <head> (before the stylesheet paints) to avoid a flash.
// =====================================================================
(function () {
  var KEY = "pjt_theme";
  var root = document.documentElement;

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function current() { return root.getAttribute("data-theme") || "dark"; }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      var next = theme === "dark" ? "light" : "dark";
      btn.setAttribute("aria-label", "Switch to " + next + " theme");
      btn.setAttribute("title", "Switch to " + next + " theme");
      var lbl = btn.querySelector(".tt-label");
      if (lbl) lbl.textContent = next === "light" ? "Light" : "Dark";
    }
  }

  window.toggleTheme = function () {
    var next = current() === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
    apply(next);
  };

  apply(stored() === "light" || stored() === "dark" ? stored() : systemTheme());

  // Follow the device setting only while the user has not chosen manually.
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onChange = function () { if (!stored()) apply(systemTheme()); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "theme-toggle";
    btn.className = "theme-toggle";
    btn.innerHTML = (typeof icon === "function" ? icon("light-dark") : "") + '<span class="tt-label"></span>';
    btn.addEventListener("click", window.toggleTheme);

    var bar = document.querySelector(".topbar-right");
    if (bar) bar.insertBefore(btn, bar.firstChild);
    else { btn.classList.add("theme-float"); document.body.appendChild(btn); }
    apply(current());
  });
})();
