// =====================================================================
//  icons.js — Icon set + helpers
//
//  Icon artwork is from the Cloudscape Design System (https://cloudscape.design/foundation/visual-foundation/iconography/),
//  Copyright Amazon.com, Inc. or its affiliates, licensed under the Apache License 2.0
//  (https://www.apache.org/licenses/LICENSE-2.0). 16x16 grid, 2px strokes.
//
//  Usage:
//    HTML:  <i data-icon="status-positive"></i>   (optional data-size="medium|big|large")
//    JS:    icon("status-positive")  ->  "<svg ...>"
// =====================================================================
const ICON_SVG = {
  "angle-left": "<path d=\"M11 2 5 8l6 6\" class=\"stroke-linejoin-round\"/>",
  "eye": "<path d=\"M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z\"/><path d=\"M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z\"/>",
  "eye-off": "<path d=\"M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z\"/><path d=\"M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z\"/><path d=\"M2.5 14 13.5 2\" class=\"stroke-linecap-round\"/>",
  "gen-ai": "<path d=\"M6.15 10.365 8 15.005l1.86-4.64 4.64-1.86-4.64-1.85L8 2.005l-1.85 4.65-4.65 1.85 4.65 1.86Z\" class=\"stroke-linejoin-round\"/><path d=\"M2.38 4.915c.02.05.07.08.12.08.05 0 .12-.08.12-.08l.66-1.64 1.64-.66a.13.13 0 0 0 .08-.12c0-.05-.08-.12-.08-.12l-1.64-.66-.66-1.64c-.04-.1-.2-.1-.24 0l-.66 1.64-1.64.66a.13.13 0 0 0-.08.12c0 .05.08.12.08.12l1.64.66.66 1.64Z\" class=\"filled no-stroke\"/>",
  "bar-chart": "<path d=\"M14 14H2V2\" class=\"stroke-linejoin-round\"/><path d=\"M5 11V7M8 11V5M11 11V3\"/>",
  "list-view": "<path d=\"M5 3h10\"/><path d=\"M5 8h10\"/><path d=\"M5 13h10\"/><path d=\"M2.01 3.01H2V3h.01v.01ZM2.01 8.01H2V8h.01v.01ZM2.01 13.01H2V13h.01v.01Z\" class=\"filled\"/>",
  "group": "<path d=\"M15 16v-2a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2\"/><circle cx=\"11.25\" cy=\"6.75\" r=\"2.25\"/><path d=\"M6.254 8.99H3a2.005 2.005 0 0 0-2.005 2.005v2h.01v-2C1.005 9.893 1.898 9 3 9h3.261a8.678 8.678 0 0 1-.007-.01Z\" class=\"filled\"/><circle cx=\"4.25\" cy=\"4.25\" r=\"2.25\"/>",
  "add-plus": "<path d=\"M2.01 8h12M8 14l.01-12\"/>",
  "edit": "<path d=\"m6.19 13.275-4.19.7\" class=\"stroke-linecap-round\"/><path d=\"m2 13.975.7-4.19\" class=\"stroke-linecap-round\"/><path d=\"m2.7 9.785 7.2-7.2c.78-.78 2.05-.78 2.83 0l.66.66c.78.78.78 2.05 0 2.83l-7.2 7.2\" class=\"stroke-linejoin-round stroke-linecap-round\"/><path d=\"m9 3.995 3 3\" class=\"stroke-linejoin-round stroke-linecap-round\"/>",
  "upload": "<path d=\"M1 1h14\" class=\"stroke-linejoin-round\"/><path d=\"M13 10 8 5l-5 5M8 6v9\" class=\"stroke-linejoin-round\"/>",
  "search": "<path d=\"m11 11 4 4M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10Z\" class=\"stroke-linejoin-round\"/>",
  "refresh": "<path d=\"M15 0v5l-5-.04\" class=\"stroke-linejoin-round\"/><path d=\"M15 8c0 3.87-3.13 7-7 7s-7-3.13-7-7 3.13-7 7-7c2.79 0 5.2 1.63 6.33 4\"/>",
  "external": "<path d=\"M13 9.012v-6H7M13.02 3 7 9.01\" class=\"stroke-linejoin-round\"/><path d=\"M3 5.012v8h8.01\" class=\"stroke-linejoin-round\"/>",
  "globe": "<circle cx=\"8\" cy=\"8\" r=\"7\"/><ellipse cx=\"8\" cy=\"8\" rx=\"3\" ry=\"7\"/><path d=\"M1 8h14\" class=\"stroke-linejoin-round\"/>",
  "angle-up": "<path d=\"m2 11 6-6 6 6\" class=\"stroke-linejoin-round\"/>",
  "angle-down": "<path d=\"m2 5 6 6 6-6\" class=\"stroke-linejoin-round\"/>",
  "angle-right": "<path d=\"m5 2 6 6-6 6\" class=\"stroke-linejoin-round\"/>",
  "arrow-left": "<path d=\"M7 3 2 8l5 5M2 8h13\" class=\"stroke-linejoin-round\"/>",
  "remove": "<path d=\"M1 5h14\" class=\"stroke-linejoin-round\"/><path d=\"m13 5-1 10H4L3 5\" class=\"stroke-linejoin-round\"/><path d=\"M5 5V2h6v3\" class=\"stroke-linejoin-round\"/>",
  "status-positive": "<circle cx=\"8\" cy=\"8\" r=\"7\"/><path d=\"M4.5 7.5 7 10l4-5\" class=\"stroke-linejoin-round\"/>",
  "status-negative": "<circle cx=\"8\" cy=\"8\" r=\"7\"/><path d=\"m5.5 5.5 5 5M10.5 5.5l-5 5\"/>",
  "status-warning": "<path d=\"M8 5v4M8 10v2M6.52 1.88l-5.33 9.76c-.13.23-.19.5-.19.76 0 .88.71 1.59 1.59 1.59H13.4c.88 0 1.59-.71 1.59-1.59 0-.27-.07-.53-.19-.76L9.48 1.88C9.18 1.34 8.62 1 8 1s-1.18.34-1.48.88Z\" class=\"stroke-linejoin-round\"/>",
  "status-pending": "<circle cx=\"8\" cy=\"8\" r=\"7\"/><path d=\"M8 4v5H4\" class=\"stroke-linejoin-round\"/>",
  "status-in-progress": "<circle cx=\"8\" cy=\"8\" r=\"7\"/><path d=\"M9 7H7v2h2V7ZM6 7H4v2h2V7ZM12 7h-2v2h2V7Z\" class=\"filled no-stroke\"/>",
  "status-info": "<circle cx=\"8\" cy=\"8\" r=\"7\"/><path d=\"M8 12V7M8 6V4\"/>",
  "lock-private": "<path d=\"M12 7H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z\" class=\"stroke-linejoin-round\"/><g/>",
  "user-profile": "<path d=\"M8 7c1.66 0 3-1.34 3-3S9.66 1 8 1 5 2.34 5 4s1.34 3 3 3Z\"/><path d=\"M2 16v-3c0-1.66 1.34-3 3-3h6c1.66 0 3 1.34 3 3v3\" class=\"stroke-linejoin-round\"/>",
  "settings": "<path d=\"M6.11 1.729c.07-.42.44-.729.86-.729h2.02c.43 0 .79.31.86.729l.17.999c.05.29.24.529.5.679.06.03.11.06.17.1.25.15.56.2.84.1l.95-.35c.4-.15.85 0 1.07.38l1.01 1.747c.21.37.13.839-.2 1.108l-.78.64c-.23.189-.34.479-.33.768v.2c0 .29.11.579.33.769l.78.639c.33.27.42.739.2 1.108l-1.01 1.748c-.21.37-.66.529-1.06.38l-.95-.35a.966.966 0 0 0-.84.1c-.06.03-.11.07-.17.1-.26.14-.45.389-.5.679l-.17.998A.878.878 0 0 1 9 15H6.98a.87.87 0 0 1-.86-.729l-.17-.998a.988.988 0 0 0-.5-.68c-.06-.03-.11-.06-.17-.1a.996.996 0 0 0-.84-.1l-.95.35c-.4.15-.85 0-1.06-.38l-1.01-1.747a.873.873 0 0 1 .2-1.108l.78-.64c.23-.189.34-.479.33-.768v-.2c0-.3-.11-.579-.33-.769l-.78-.639a.861.861 0 0 1-.2-1.108l1.01-1.748c.21-.37.66-.529 1.07-.38l.95.35c.28.1.58.06.84-.1.06-.03.11-.07.17-.1.26-.14.45-.379.5-.678l.15-1Z\" class=\"stroke-linecap-round stroke-linejoin-round\"/><path d=\"M10 8c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2Z\" class=\"stroke-linecap-round stroke-linejoin-round\"/>",
  "sign-out": "<path d=\"M7 2H2v12h5\" class=\"stroke-linejoin-round\"/><path d=\"M13.98 8.018 5.5 8.01m4.241 4.244 4.243-4.242-4.243-4.243\" class=\"stroke-linejoin-round\"/>",
  "video-on": "<circle cx=\"8\" cy=\"7\" r=\"5\"/><circle cx=\"8\" cy=\"7\" r=\"2\" class=\"filled no-stroke\"/><path d=\"M3 15h10M8 15v-3\"/>",
  "file": "<path d=\"M13 15H3V1h6l4 4v10Z\" class=\"stroke-linejoin-round\"/><path d=\"M8 1v5h5\" class=\"stroke-linejoin-round\"/>",
  "folder-open": "<path d=\"M2 7V2h6l1 2h5c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1h-1\" class=\"stroke-linejoin-round\"/><path d=\"M1 7h10\"/><path d=\"M3 14h11\"/><path d=\"m1 7 2 7\" class=\"stroke-linecap-round\"/><path d=\"m11 7 3 7\" class=\"stroke-linecap-round\"/>",
  "light-dark": "<circle cx=\"8\" cy=\"8\" r=\"7\"/><path d=\"M8 15A7 7 0 1 0 8 1v14Z\" class=\"filled no-stroke\"/>",
  "star-filled": "<path d=\"m8 1 2.16 4.38 4.84.71-3.5 3.41.83 4.81L8 12.04l-4.33 2.27.83-4.81L1 6.09l4.84-.71L8 1Z\" class=\"filled stroke-linejoin-round\"/>",
  "close": "<path d=\"m2 1.71 12 12M2 13.71l12-12\" class=\"stroke-linejoin-round\"/>",
  "check": "<path d=\"m1 9 4 4L15 2\" class=\"stroke-linejoin-round\"/>",
};

function icon(name, size) {
  const inner = ICON_SVG[name] || "";
  return '<svg class="ico' + (size ? " ico-" + size : "") + '" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">' + inner + "</svg>";
}

function hydrateIcons(root) {
  (root || document).querySelectorAll("i[data-icon]").forEach((el) => {
    el.outerHTML = icon(el.getAttribute("data-icon"), el.getAttribute("data-size"));
  });
}
document.addEventListener("DOMContentLoaded", () => hydrateIcons());
