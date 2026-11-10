// =====================================================================
//  Safety helpers for serving participant HTML (used by api/preview.js)
//
//  Participant projects are untrusted code that runs in a judge's / admin's
//  browser. They must never share an origin with the judging platform,
//  otherwise a project could read the signed-in user's token from
//  localStorage and act on their behalf.
//
//  Defence in depth:
//   1. The page that embeds a preview uses  <iframe sandbox="allow-scripts">
//      (no "allow-same-origin").
//   2. The preview response itself carries  Content-Security-Policy: sandbox
//      allow-scripts , so even a direct visit to /preview/KARYA-xx gets an
//      opaque (unique) origin.
//   Result: the project can run its scripts, but cannot read the platform's
//   storage, cookies or DOM.
//
//  A sandboxed page with an opaque origin is not allowed to touch
//  localStorage / sessionStorage / document.cookie (the browser throws).
//  Some projects use them for harmless UI state, so a tiny in-memory
//  stand-in is injected first. Their previews keep working; nothing is saved.
// =====================================================================

// Scripts allowed, but opaque origin (no allow-same-origin).
export const PREVIEW_CSP = "sandbox allow-scripts";
// Error pages need no scripts at all.
export const ERROR_CSP = "sandbox";

export function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SHIM = `
(function () {
  function memStorage() {
    var d = {};
    var s = {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[String(k)] = String(v); },
      removeItem: function (k) { delete d[String(k)]; },
      clear: function () { d = {}; },
      key: function (i) { var ks = Object.keys(d); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    Object.defineProperty(s, "length", { get: function () { return Object.keys(d).length; } });
    return s;
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    var blocked = false;
    try { void window[name]; } catch (e) { blocked = true; }
    if (blocked) {
      try { Object.defineProperty(window, name, { configurable: true, enumerable: true, value: memStorage() }); } catch (e) {}
    }
  });
  var cookieBlocked = false;
  try { void document.cookie; } catch (e) { cookieBlocked = true; }
  if (cookieBlocked) {
    var jar = {};
    try {
      Object.defineProperty(document, "cookie", {
        configurable: true,
        get: function () { return Object.keys(jar).map(function (k) { return k + "=" + jar[k]; }).join("; "); },
        set: function (v) {
          var parts = String(v).split(";");
          var kv = parts[0].split("=");
          var k = kv.shift().trim();
          if (!k) return;
          var del = false;
          parts.slice(1).forEach(function (a) {
            a = a.trim().toLowerCase();
            if (a.indexOf("max-age=") === 0 && parseInt(a.slice(8), 10) <= 0) del = true;
            if (a.indexOf("expires=") === 0 && new Date(a.slice(8)).getTime() < Date.now()) del = true;
          });
          if (del) delete jar[k]; else jar[k] = kv.join("=");
        }
      });
    } catch (e) {}
  }
})();
`;

// Insert the stand-in as the very first script of the document, without ever
// putting anything before the <!DOCTYPE> (that would switch the page to quirks mode).
export function prepareForPreview(html) {
  const tag = "<script>" + SHIM + "</script>";
  const m = /<head(?:\s[^>]*)?>/i.exec(html) || /<html(?:\s[^>]*)?>/i.exec(html);
  if (m) {
    const at = m.index + m[0].length;
    return html.slice(0, at) + tag + html.slice(at);
  }
  const d = /^\s*<!doctype[^>]*>/i.exec(html);
  if (d) return html.slice(0, d[0].length) + tag + html.slice(d[0].length);
  return tag + html;
}
