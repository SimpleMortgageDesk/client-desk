# MySimpleDesk – handoff (build LATEST242)

Live: https://mysimpledesk.co.uk · Repo: `SimpleMortgageDesk/client-desk` (old name `simplemortgagedesk/client-desk` still redirects; update the git remote when convenient) · Push to `main` auto-deploys (Cloudflare Pages + Functions + D1).

## What it is
Static HTML/JS/CSS records-and-reminders app for home owners, landlords and trades. Customers' data lives in their own OneDrive (Google Drive path is built but hidden until `googleLive:true` in config).

## Code layout
- `index.html` (app shell, loads scripts in order), `home.html`, `privacy.html`, `explainer.html`, `admin/index.html`
- `js/app-*.js` – 24 classic scripts sharing global scope (core, shell, clients, marketing, tools, events, trade, legal, home, agreements, property, rent, receipts, leases, assets, todo, dates, import, mortgage, lender-pdf, portfolio, appts, dupes, start). See `js/README.md`.
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

## Added since LATEST159 (all deployed)
- **Mortgage adviser trade** (`T.id==='mortgage'`, same behaviour as the owner's Mortgage Desk, no client records shipped): Tasks home, All cases/Pipeline/Tasks, appointments with booking/missed/drag, lender-PDF reader (`app-lender-pdf.js`), portfolio summary (`app-portfolio.js`), SPV/company clients, client numbers + "Tidy client numbers", Outlook event text, optional local-folder copy of records.
- **Backup/import** (sync.js): `bkRun` with progress steps, previous-backup file, two locations; `importFlow` (.json from MySimpleDesk or Mortgage Desk) with preview and progress. **CSV/Excel import** (`app-import.js`, `IM_TRADE.mortgage`): column matching, joint names split ("Mr A & Mrs B"), client numbers kept.
- **Duplicate finder** (`app-dupes.js`): same people (title/order ignored) + same address, or same name where one has no address. Banner on All cases (snooze 7 days), "Find duplicates" button, merge fills blanks and brings notes/tasks/protection, one-step undo (`cd.dupUndo`), "These are different" (`cd.dupNo`). A client with different properties is not flagged.
- Login: one-button sign-in; drive folder named "My Simple Desk - Do not delete"; diagnostics in Settings > Support details; offline/network resilience; build step (`tools/build.mjs`).
- Landing page simplified; no founder details or video (owner's choice).
- **Documents vs existing clients** (`app-lender-pdf.js`): `docCandidates` matches a document's applicants to cases by name + date of birth (+ address, property). New client from a PDF asks: add to existing / new case for the same client (keeps client number) / new client. A document opened on the wrong case offers the right client. Duplicate review also opens itself after any backup or CSV import (`dupAfterImport`), and the finder uses date of birth (same name+address+different DOB is not a duplicate; same DOB+address with a different spelling is).
- **Client folders** (`app-folders.js`): mortgage adviser documents now go to <records folder> > Clients > <client name> (one folder per client, shared by that client's cases; `docRoot: 'Clients'`). 'Client folders (N)' button on All cases makes them all; 'Create the folder now' in a client's documents. Needs the app-folder permission only (cannot make folders elsewhere in OneDrive).
- **Invoice details** (Settings > Your details > Invoices > Edit invoice details, `openInv` in app-home.js): up to two bank accounts (`BIZ.payDetails/payLabel`, `payDetails2/payLabel2`), invoice prefix, next number, payment days. New invoices ask which account (`d.payAcc`); `payFor(d)` picks the text for invoice, PDF and WhatsApp/email. All trades.
- **Security headers:** the build (`tools/build.mjs`, step 3) replaces `'unsafe-inline'` in `script-src` with the sha256 of each of our own inline scripts, so injected inline script cannot run. Source `_headers` keeps `unsafe-inline` (no effect locally). Sign-in tokens stay in localStorage by design (no server; app-folder scope only; shared-computer mode uses sessionStorage).
- **PDF reader upgraded** to PDF.js 6.5.438 (legacy build) in `lib/pdfjs/` (was 3.11.174, which had CVE-2024-4367). Loaded as a module via `lib/pdfjs/load.mjs` (`dxLoad(src, true)`); the three image decoders are in `lib/pdfjs/wasm/` (`PDFJS_WASM`). Re-copy from `pdfjs-dist/legacy/build` to update.
- **Mortgage adviser layout:** All cases header has no Import/Export/Find duplicates/Portfolio/New-client-from-PDF buttons. Create Case asks Blank or From a lender PDF; Portfolio summary is on the client page (`pfBtn`); Import and Export CSV are in Settings > Backup and restore; duplicates are suggested by the yellow banner (runs automatically). Other trades unchanged.
- **Mortgage invoices:** new invoice fills Regarding (property) = address (case type, lender), description 'Broker fee - type, address', amount from the case's Broker fee, client name/address/number; Client and Regarding show at the top of the invoice and PDF. Case has a 'Broker fee' section (fee amount, 'No fee'); a No-fee client asks before an invoice is made. CSV import reads a fee column.
- **Mortgage client page:** 'Advice fee and invoices' section (fee mode None/Fee, amount, description, payable, status, paid on, Create invoice; invoice list; saving/paying an invoice updates Fee status); no Documents section (Read a document button kept); the Done button is called Save. Client numbers still exist on cases but the Tidy tool and the Client folders tool (app-folders.js) were removed completely.
- **Mortgage review reminders:** one per case (review date = deal end minus 4 months, editable) for every stage except Lost, plus one per extra Security address (own deal end / review date, key `sec:<id>`, address in the label).
- **Lender PDF reader:** if the document does not say 'initial rate period ends...', the deal end date is taken from the early repayment charge section (latest 'until/ends/to' date, or completion date + N years); the ERC field lists stepped charges (5% / 4% / 3%).
- **One menu for every trade** (except landlord, which keeps its own, and mortgage, which has All cases + Tasks): top = Today (the old To do page), the main list, and Appointments where the trade has it; everything else (Reminders, Customers/Contacts, Tasks, Pipeline, Calendar, Quotes & invoices, Calculator, Notebook, Birthdays, Marketing, My Properties and Cars) is in the tools menu (side menu on a computer, the Menu button on a phone).
- **Client page top row** is Book appointment, New <noun> for this client (and, for mortgage, Read a document) and Save; Receipts and expenses / Portfolio summary sit under a More menu. The close button says Save in every trade. Import and Export CSV are in Settings > Backup and restore for every trade (list pages no longer have them); an empty list shows no filter or sort boxes.
- **Phone tap targets:** every button, field, checkbox and link is at least 40px high on a phone (CSS block 'phones: every tap target' at the end of styles.css; text links and link-like buttons get the area as padding balanced by a negative margin).
- **Birthday messages sign-off:** greeting + name + job title from My profile; a mortgage adviser's title defaults to 'Mortgage and Protection Adviser' and Islamic messages close with 'Wassalamu alaikum,' (mortgage trade only). A signature saved in Edit messages and signature still overrides.
- **Notes (mortgage adviser):** a multi-line note is shown as one block with its line breaks (paras() in app-core.js; other trades still show a block per line); each note has Edit and Delete (Delete asks Confirm delete first).
- **All-trades master copy:** on the admin page (Cloudflare Access) each person has an **All trades: on/off** button (`POST /api/admin/users?email=&alltrades=1|0`, column `all_trades`). The app reads it at start (`/api/verify` status returns `at`, `window.CD_allAt()`); with it on there is no limit of two and no lock, and the trade switch is one drop-down. Invite links: `https://mysimpledesk.co.uk/?trade=<id>` ticks that trade in a new person's first-time chooser (ids: landlord, gas, accountant, mortgage, solicitor, architect, plumber, electrician, builder, beauty, driving, general).

## Trade landing pages (search engines)
`for/<slug>.html` (12 pages) are generated: edit the words in `tools/trade-content.mjs`, then run `node tools/make-trade-pages.mjs` (it also rewrites `sitemap.xml`) and commit. Each page has its own title, description, canonical link, and JSON-LD (SoftwareApplication, FAQPage, BreadcrumbList); home.html has SoftwareApplication, WebSite and FAQPage. Cloudflare serves them without `.html`.

## Trust pages
`about.html`, `support.html`, `security.html`, `terms.html` are generated by `node tools/make-trust-pages.mjs` (words are in that file). Business name and email come from `ownerName` / `ownerEmail` in config.js. To do by the owner: legal business name and company number, solicitor check of the terms, real testimonials, a demo video. The security page says the app has not had an independent audit; change it if that changes.

Demo video: `media/demo.mp4` + `media/demo-poster.jpg`, shown in the "See it in action" section of home.html (recorded with Playwright in `?test=plumber` sample-data mode, captions burned in, British voiceover from Kokoro text-to-speech; script and timing in the session scratchpad, re-record if screens change). Re-record if the screens change a lot.

## Windows app
See `windows/README.md` (install from Edge now; Microsoft Store through PWABuilder later) and `windows/store-listing.md`. The manifest now has screenshots (`screenshots/`) for the install prompts and the Store. Not yet tested inside a real Windows app window: Microsoft sign-in hand-back.

## Desktop programs (Windows and Mac)
`desktop/` is a small Electron program (main.js) that opens https://mysimpledesk.co.uk in its own window, so website updates reach it automatically. `.github/workflows/desktop.yml` builds `MySimpleDesk-Setup.exe`, `MySimpleDesk-arm64.dmg` and `MySimpleDesk-x64.dmg` on GitHub and publishes them on the rolling release tagged `desktop` (runs when `desktop/` changes, or Actions > Desktop apps > Run workflow). The website page `/download` (download.html, made by tools/make-trust-pages.mjs) links to them. They are NOT code signed: Windows shows SmartScreen and Macs need right-click > Open. Removing those warnings needs a Windows code-signing certificate and an Apple Developer ID (US$99 a year) with notarisation. Only the website start URL (`/?p=login&source=desktop`) and the Microsoft sign-in hosts are allowed inside the window; every other link opens the person's browser.

Test page: `/try` (try.html, made by tools/make-trust-pages.mjs, noindex, not in the sitemap or footers) lists a sample-data link for every trade (`/?test=<trade>`), no sign-in.
