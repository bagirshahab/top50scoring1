# Why a project does not open inside the judging page

**Applies to:** the judge panel at `https://top20scoring.vercel.app/juri`
**Short answer:** the judging platform is working. The project's own website refuses to be shown inside another website's page.

---

## What the judge sees

In the scoring screen, the left panel is meant to show the team's live prototype. For some projects the panel stays grey and shows a **sad-face icon** (for example `rohaso.com`). The **Open in new tab** button still works.

## The cause

The project's website sends two response headers that forbid embedding. They were checked directly on `rohaso.com`:

```
X-Frame-Options: DENY
Content-Security-Policy: ... frame-ancestors 'none'
```

Both mean: **"do not display this site inside an iframe on any other site."**

The browser obeys the rule, so the panel stays blank. The team, or their hosting provider (here Cloudflare), added these headers. Many sites turn them on as a standard security protection (it prevents "clickjacking").

This is a browser security rule, not a bug in the judging platform, and the judging page cannot override it.

## Why we do not force it open

The only technical workaround is to copy the team's site through our own server (a proxy). That is not acceptable here:

- It breaks logins, cookies and many site features.
- It opens security holes in the judging platform.
- It overrides a protection the team chose on purpose.

**Open in new tab** is the one method that works reliably for every site, so it is the supported way to view projects that block embedding.

## Options

| # | Option | Who does it | Result |
|---|---|---|---|
| 1 | Allow embedding for this platform on the team's site | Participating team | Their site loads in the left panel |
| 2 | Keep using **Open in new tab** | Judge | Works for every project, no changes needed |
| 3 | Show a clear "this site blocks embedding" message with one large button | Platform (proposed) | Judges understand it is not an error |

### Option 1: what the team changes

Ask the team to allow this platform as a parent page and remove the blocking headers:

- Remove `X-Frame-Options: DENY` (or set `X-Frame-Options` aside entirely).
- Set the Content Security Policy to allow this site:

```
Content-Security-Policy: frame-ancestors https://top20scoring.vercel.app
```

How, by hosting provider:

| Hosting | Where to change it |
|---|---|
| **CloudFront** | Response Headers Policy: remove the `X-Frame-Options` entry and set `frame-ancestors https://top20scoring.vercel.app` in the Content-Security-Policy |
| **Cloudflare** | Rules, Transform Rules, Modify Response Header: remove `X-Frame-Options` and edit `Content-Security-Policy` |
| **Vercel** | `vercel.json` `headers` section: remove the two headers, or set `frame-ancestors` as above |
| **Netlify** | `_headers` file or `netlify.toml`: same change |

After the change the team should reload their site once and confirm it still works normally.

### Option 3: proposed platform change

When links are checked, the server would also read `X-Frame-Options` and the CSP `frame-ancestors` value of each project. If a site blocks embedding:

- the left panel shows a short message ("This site does not allow being shown inside this page") instead of the browser's sad-face icon,
- one large **Open site in new tab** button is shown,
- the admin sees a "Blocks embedding" badge in the project list, so teams can be contacted ahead of time.

Not built yet. It needs a decision from the organisers.

## Recommendation

1. Tell participating teams about Option 1 before Demo Day, especially teams on Cloudflare or Vercel.
2. Build Option 3 so that judges are never confused by a blank panel.
3. On the day, judges simply use **Open in new tab** for any project that does not load in the panel.

## Quick check for any project

Run this from a terminal and read the two headers:

```
curl -sI https://the-team-site.example/ | findstr /i "x-frame-options content-security-policy"
```

If `X-Frame-Options` is `DENY` or `SAMEORIGIN`, or the CSP contains `frame-ancestors 'none'` or `frame-ancestors 'self'`, the site cannot load in the judging page.
