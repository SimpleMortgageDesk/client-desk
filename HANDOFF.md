# MySimpleDesk – handoff (build LATEST250)

Live: https://mysimpledesk.co.uk · Repo: `SimpleMortgageDesk/client-desk` (old name `simplemortgagedesk/client-desk` still redirects; update the git remote when convenient) · Push to `main` auto-deploys (Cloudflare Pages + Functions + D1).

## What it is
Static HTML/JS/CSS records-and-reminders app for home owners, landlords and trades. Customers' data lives in their own OneDrive (Google Drive path is built but hidden until `googleLive:true` in config).

## Code layout
- Pages: `index.html` (the app shell, loads the scripts in order), `home.html` (landing), `privacy.html`, `404.html`, `admin/index.html`. Generated pages (do not edit by hand): `for/<trade>.html` (12 trade pages, `node tools/make-trade-pages.mjs`), and `about.html`, `support.html`, `security.html`, `terms.html`, `download.html`, `try.html` (`node tools/make-trust-pages.mjs`).
- `js/app-*.js` – 28 classic scripts sharing one global scope; `js/README.md` lists each file and the rules (load order, shared names).
- `sync.js` (storage, login, Graph/Drive, PIN, lock, diagnostics, test mode), `trades.js` (every trade's fields and stages), `config.js`, `styles.css`, `sw.js` (offline cache; its name is stamped by the build), `manifest.webmanifest`, `lib/` (pdf.js, tesseract), `media/` (demo video), `screenshots/` (manifest and Store pictures).
- `functions/api/{signup,verify,admin/users}.js`, `functions/admin/_middleware.js`; admin is behind Cloudflare Access plus a 2-hour idle logout.
- `android/` (TWA project), `desktop/` (Electron window around the website for Windows and Mac), `windows/` (Store notes), `.github/workflows/{android,desktop,checks}.yml`.
- Checks: `tools/check-code.mjs` (start-up order), `eslint.config.mjs`, `.prettierrc.json`. CI runs all three.

## Deploy routine
Bump `LATESTnnn` in `index.html` AND `version.json` (they must match; the "new version" bar compares it), commit, `git push origin HEAD:main`, wait about 90 seconds, then check `https://mysimpledesk.co.uk/version.json`. `tools/build.mjs` (run by Cloudflare: build command `npm install && npm run build`, output `dist`) minifies JS and CSS, stamps the `?v=` labels, `MD_BUILD`, the `sw.js` cache name, and adds a hash of every inline script to the Content-Security-Policy, so none of that is done by hand. `functions/` stays at the repo root.

Local build: `npm install` then `npm run build` (output `dist/`, git-ignored). Tests that append hooks to internal names must run against the source files, not `dist/`.

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
- **Mortgage client page:** 'Advice fee and invoices' section (fee mode None/Fee, amount, description, payable, status, paid on, Create invoice; invoice list; saving/paying an invoice updates Fee status); no Documents section (Document reader button kept); the Done button is called Save. Client numbers still exist on cases but the Tidy tool and the Client folders tool (app-folders.js) were removed completely.
- **Mortgage review reminders:** one per case (review date = deal end minus 4 months, editable) for every stage except Lost, plus one per extra Security address (own deal end / review date, key `sec:<id>`, address in the label).
- **Lender PDF reader:** if the document does not say 'initial rate period ends...', the deal end date is taken from the early repayment charge section (latest 'until/ends/to' date, or completion date + N years); the ERC field lists stepped charges (5% / 4% / 3%).
- **One menu for every trade** (except landlord, which keeps its own, and mortgage, which has All cases + Tasks): top = Today (the old To do page), the main list, and Appointments where the trade has it; everything else (Reminders, Customers/Contacts, Tasks, Pipeline, Calendar, Quotes & invoices, Calculator, Notebook, Birthdays, Marketing, My Properties and Cars) is in the tools menu (side menu on a computer, the Menu button on a phone).
- **Client page top row** is Book appointment, New <noun> for this client (and, for mortgage, Document reader) and Save; Receipts and expenses / Portfolio summary sit under a More menu. The close button says Save in every trade. Import and Export CSV are in Settings > Backup and restore for every trade (list pages no longer have them); an empty list shows no filter or sort boxes.
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

## Document reader or a photo (every trade)
`js/app-docread.js`: chooser (Take a photo = camera, Choose a PDF or picture), text reading on the device (PDF text via pdf.js, pictures and scanned PDFs via the bundled tesseract), `drExtract` finds kind, name, phone, email, address/postcode, dates (renewal-type dates ticked) and amounts/reference numbers, `drReview` lists them for the user to tick, then a new record is made (or the open one is filled where blank) with reminders from the dates (2 weeks before by default) and a note. In the menu as "Document reader" for every trade (and a button on the open record). Mortgage advisers keep their lender reader (app-lender-pdf.js) which now also takes the chooser and photos. Test files in the session scratchpad (qa/docread.js).

## Animated birthday card
`js/app-bdcard.js`: the birthday message has an "Animated card" button. A 400x400 looping GIF (confetti and balloons, or a crescent and stars for the Islamic greeting) with the person's first name is drawn on a canvas and encoded on the device (own GIF writer, 216-colour palette). On phones the Share button hands the GIF and the message to the share sheet (WhatsApp); computers save the GIF to attach. WhatsApp itself cannot animate a plain text message.

Document reader also reads Word (.docx) and .txt client sheets (app-docread.js: own zip reader + DecompressionStream, paragraphs, label/value tables, heading-row tables), finds date of birth (any year, day first), and offers the rest of the document as a note. For mortgage advisers a .docx/.txt goes to this general reader (lender PDFs and photos still go to the lender reader). Old .doc files get a message to save as .docx. One client per document.

## Google (Gmail) sign-in is live
`googleLive: true` in config.js (set 2026-11-27 after the Google app was published: In production, only non-sensitive scopes openid/email/profile/drive.file, no logo so no verification; Drive API enabled; web client has the apex and www origins and redirect URIs; Cloudflare has GOOGLE_CLIENT_ID; old client secret deleted). Gmail is hidden in the Windows/Mac program (`?source=desktop` sets `cd.desktop`) because Google refuses sign-in in embedded windows. The Outlook calendar and "send from Outlook" are Microsoft-only. Static pages now say "OneDrive or Google Drive". Do not add a logo to the Google consent screen (it would force verification).
