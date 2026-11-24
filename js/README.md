# The app's code (js/)

The page loads these files one after another (the order is in `index.html`). They are not separate
modules: they share one page, so a function or variable defined in one file can be used in any other.

| File | What is in it |
|---|---|
| `app-core.js` | Shared settings, helpers, pasted tables, saving, reminders made from record dates, search filters |
| `app-shell.js` | The main screen: menus, list pages (pipeline, cases, reminders), the record drawer |
| `app-clients.js` | Clients and appointments |
| `app-marketing.js` | Marketing contacts and messages, birthdays |
| `app-tools.js` | Connected clients, quick add, export, task tray, notebook, full backup |
| `app-events.js` | Click, keyboard and form handling for the whole page |
| `app-trade.js` | Choosing and switching trades, auto save, business details |
| `app-legal.js` | Quotes and invoices, landlord legal-to-let, repairs, tax checks, rent statements |
| `app-home.js` | The person's own residential property |
| `app-agreements.js` | Company let agreements |
| `app-property.js` | The rental property page, its folder and its uploaded documents |
| `app-rent.js` | Rent payments, rent status, expense reports |
| `app-receipts.js` | Photo scanning and receipts |
| `app-leases.js` | Tenancy and lease agreements |
| `app-assets.js` | Deleting uploads, documents for cars and the home, the My Properties and Cars page |
| `app-todo.js` | The To do list and the page that opens first |
| `app-dates.js` | Reading dates from uploaded documents, and the expiry reminders made from them |
| `app-import.js` | My tradesmen, import from Excel or CSV |
| `app-dupes.js` | Duplicate finder: spots records entered twice, suggests merges, undo |
| `app-start.js` | Start-up: connects to storage and shows the first page |

The sign-in, storage and settings code is in `../sync.js`; the trades (plumber, landlord and so on) are in `../trades.js`.

## Rules that keep it working
- **Order matters only while the page starts.** Code that runs as a file loads (not inside a function that is called later)
  may only use things from the same file or an earlier one. `node tools/check-code.mjs` checks this and runs on every push.
- **Every name is shared.** Do not give a new function or variable the name of an existing one (the browser would silently use the later one).
- **Adding a file:** add its `<script>` line to `index.html` in the right place, add it to `FILES` in `sw.js` (and raise `CACHE`),
  and add it to the list in `tools/check-code.mjs` is automatic (it reads `index.html`).
- **Deploying:** raise the `?v=` label on the script lines in `index.html` so browsers fetch the new files.

## Layout of the code
The code is laid out by Prettier (settings in `../.prettierrc.json`), so lines stay short and every file looks the same.
Before you push, run `npx prettier --write js/*.js sync.js trades.js sw.js config.js "functions/**/*.js"`; the automatic check
on GitHub fails if a file is not laid out that way. Laying code out never changes what it does.
