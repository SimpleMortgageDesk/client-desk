# MySimpleDesk – handoff (build LATEST159)

Live: https://mysimpledesk.co.uk · Repo: `SimpleMortgageDesk/client-desk` (old name `simplemortgagedesk/client-desk` still redirects; update the git remote when convenient) · Push to `main` auto-deploys (Cloudflare Pages + Functions + D1).

## What it is
Static HTML/JS/CSS records-and-reminders app for home owners, landlords and trades. Customers' data lives in their own OneDrive (Google Drive path is built but hidden until `googleLive:true` in config).

## Code layout
- `index.html` (app shell, loads scripts in order), `home.html`, `privacy.html`, `explainer.html`, `admin/index.html`
- `js/app-*.js` – 19 classic scripts sharing global scope (core, shell, clients, marketing, tools, events, trade, legal, home, agreements, property, rent, receipts, leases, assets, todo, dates, import, start). See `js/README.md`.
- `sync.js` (storage, login, Graph/Drive, PIN, lock, diagnostics), `trades.js`, `config.js`, `styles.css`, `sw.js` (offline cache, currently `client-desk-v7`), `manifest.webmanifest`, `lib/` (pdf.js, tesseract)
- `functions/api/{signup,verify,admin/users}.js`, `functions/admin/_middleware.js`; admin is behind Cloudflare Access plus a 2-hour idle logout
- `android/` (TWA project, `uk.co.mysimpledesk.app`), `.github/workflows/{android,checks}.yml`
- Checks: `tools/check-code.mjs` (start-up order), `eslint.config.mjs`, `.prettierrc.json`. CI runs all three.

## Deploy routine
**Today (site served straight from the repo):** bump `LATESTnnn` in `index.html` AND `version.json` (the number is what the "new version" check compares), bump the `?v=` labels, bump `CACHE` in `sw.js` if cached files changed, push to `main`, wait ~90s, compare md5 of live vs local.

**After switching Cloudflare to the build (see below):** just push. `tools/build.mjs` minifies JS/CSS into `dist/`, stamps `?v=`, `MD_BUILD`, `version.json` and the `sw.js` cache name from a hash of the content, so nothing needs bumping by hand. Only bump the `LATESTnnn` number in `version.json` + `index.html` for a human-readable release number (build fails if they disagree).

Local build: `npm install` then `npm run build` (output `dist/`, git-ignored). Measured with Lighthouse (mobile, same server): app page score 83-85 -> 91-93, largest paint ~4.3s -> ~3.3s, 275 KB -> 230 KB over the wire. Tests that append hooks to internal names inside `sync.js` cannot run against `dist/`; every other suite passed against it.

**Cloudflare switch (owner set these on 2026-11-23; confirm it built):** Pages project > Settings > Builds: Build command `npm install && npm run build`, Build output directory `dist`. `functions/` stays at the repo root and still works. Keep the old settings noted so you can revert in one minute.

## This stretch (all deployed)
Welcome email; sign-in-first registration with automatic email proof; To do, Reminders and Calendar; My Properties and Cars with documents and Delete everywhere; automatic 60-day expiry reminders read from uploaded documents; PIN and 30-day stay-logged-in; admin "Registered, not finished" list and logout tab; Android app build; code split into 19 files and Prettier formatted; LATEST159 moved the sign-in and settings-dialog CSS into `styles.css`.

## Waiting on the owner
- **iPhone home-screen login loss:** retest (delete icon, re-add from Safari, log in, leave and return). If the Log in screen appears, tap "Show details" and send a screenshot. If sign-in finishes in a different window, build a server hand-off fix.
- **Android:** add four GitHub secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`=upload, `ANDROID_KEY_PASSWORD`). Then Play Console registration ($25). Still unanswered: personal or organisation account (a limited company needs a D-U-N-S number).
- **Cloudflare Access:** "Revoke existing tokens", then a private-window test that admin asks for the 6-digit code.
- **Google:** reset the exposed client secret, publish the Google app, then set `googleLive:true`.
- Bank details for `CFG.payDetails`; real-phone testing.

## Not done / optional
- Remaining long strings (not worth the risk yet): Calculator, "Add a property", agreement clauses and name lists (about 17k chars, could become plain script data files); 99 strings that mix text with live data.
- Admin table full width; one-button login; native iPhone app (needs $99/yr Apple account).

## Testing notes
Playwright suites are in the session scratchpad `qa/` (not in the repo): run against `python3 -m http.server 8766`; test mode `?test=<trade|both>`; tests set `window.CD_DEMO=false` to exercise the login gate. Server tests are in `srv/`. All passed at LATEST159. The scratchpad may be cleared, so re-create tests if needed.

## Speed notes (added 2026-11-23)
- `sw.js` now serves script and style files that carry a `?v=` code straight from its saved copy (no server check), and saves them at install, so repeat opens skip the network for code. This relies on the `?v=` code changing whenever a file changes: the Cloudflare build stamps it from a hash of the content. On a manual (unbuilt) deploy, bump the `?v=` labels or users will keep old files.
- `index.html` preconnects to graph.microsoft.com and login.microsoftonline.com.
- Measured: only ~17% of the JS runs on the first screen. Next options: load agreements/receipts/leases/import/legal after first paint (medium risk), split `sync.js`. Test with `swcache.js`-style checks (second visit fetches no js/css).
