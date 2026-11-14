/* POST /api/signup
   Stores the ACCOUNT HOLDER's own details (name, email, mobile, business, kind of work, account type, dates).
   Never their records: no tenants, clients, properties, documents or passwords are ever sent here.
   Needs a D1 database bound to this Pages project as DB (Settings > Bindings). The tables are created automatically.

   This address is open to the internet, so it protects the list three ways:
   1. Details already saved for an email are never overwritten from here: a call can only fill in blanks and record activity.
   2. Each sender is limited to PER_HOUR calls an hour. Senders are counted by a scrambled, short-lived code, not their IP address.
   3. No more than NEW_PER_DAY new people can be added in one day.

   Deleting (event "delete"): the app sends a key that only the signed-in account holder's app can work out.
   If it matches the key saved for that email, the entry is deleted at once. If it cannot be checked, the entry is
   only marked "asked to be deleted" for the owner to confirm on the admin page, so nobody can delete someone else. */
const PER_HOUR = 30, NEW_PER_DAY = 300;
let ready = false;
export async function ensureTable(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY, name TEXT, account_email TEXT, mobile TEXT, business TEXT, trade TEXT, account TEXT,
    signed_up TEXT, first_seen TEXT, last_seen TEXT, days_active INTEGER DEFAULT 0, app_build TEXT)`).run();
  await db.prepare('CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, hr TEXT, n INTEGER)').run();
  /* added later: del_key lets a person delete their own entry; delete_requested marks a request we could not verify */
  for (const col of ['del_key TEXT', 'delete_requested TEXT', 'suspended TEXT', 'props INTEGER', 'home INTEGER', 'user_no INTEGER', 'pay TEXT']) { try { await db.prepare('ALTER TABLE users ADD COLUMN ' + col).run(); } catch (e) {} }
  try { await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS users_no ON users (user_no)').run(); } catch (e) {}
  try { await db.prepare('CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER)').run(); } catch (e) {}
  ready = true;
}
/* every account gets a user number, starting at 1001, used as the payment reference. One statement, so two sign-ups cannot get the same number. */
export async function giveNumber(db, email) {
  try {
    await db.prepare("UPDATE users SET user_no = MAX(COALESCE((SELECT MAX(user_no) FROM users), 1000), COALESCE((SELECT n FROM counters WHERE k = 'user_no'), 1000)) + 1 WHERE email = ?1 AND user_no IS NULL").bind(email).run();
    /* remember the highest number ever given, so a deleted account's number is never used again */
    await db.prepare("INSERT INTO counters (k, n) VALUES ('user_no', (SELECT COALESCE(MAX(user_no), 1000) FROM users)) ON CONFLICT(k) DO UPDATE SET n = MAX(counters.n, excluded.n)").run();
  } catch (e) {}
}
/* true when this sender has made too many calls this hour */
export async function tooMany(db, request, now) {
  try {
    const hr = now.slice(0, 13), ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + hr));
    const k = Array.from(new Uint8Array(dig)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
    const r = await db.prepare('INSERT INTO hits (k, hr, n) VALUES (?1, ?2, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n').bind(k, hr).first();
    if (Math.random() < 0.02) await db.prepare('DELETE FROM hits WHERE hr < ?1').bind(new Date(Date.parse(now) - 3 * 3600e3).toISOString().slice(0, 13)).run();
    return !!r && r.n > PER_HOUR;
  } catch (e) { return false; }
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const say = (t, s) => new Response(t, { status: s || 200, headers: { 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.DB) return say('sign-up list not set up', 503);
  /* only accept calls made by the app's own pages */
  const origin = request.headers.get('Origin');
  let oh = ''; try { oh = new URL(origin).host; } catch (e) {}
  if (!origin || oh !== new URL(request.url).host) return say('forbidden', 403);
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return say('forbidden', 403);
  const raw = await request.text();
  if (raw.length > 4000) return say('too large', 413);
  let d; try { d = JSON.parse(raw); } catch (e) { return say('bad request', 400); }
  const email = clean(d.email || d.accountEmail, 160).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('ignored', 202);
  const now = new Date().toISOString();
  await ensureTable(env.DB);
  if (await tooMany(env.DB, request, now)) return say('too many requests', 429);
  const known = await env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?1').bind(email).first();
  const key = /^[a-f0-9]{32,64}$/.test(String(d.k || '')) ? String(d.k) : '';
  if (d.event === 'delete') {
    if (!known) return say('deleted');
    const row = await env.DB.prepare('SELECT del_key FROM users WHERE email = ?1').bind(email).first();
    if (key && row && row.del_key && row.del_key === key) { await env.DB.prepare('DELETE FROM users WHERE email = ?1').bind(email).run(); return say('deleted'); }
    await env.DB.prepare('UPDATE users SET delete_requested = ?2 WHERE email = ?1').bind(email, now).run();
    return say('requested', 202);
  }
  if (!known) {
    const c = await env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE substr(first_seen, 1, 10) = ?1').bind(now.slice(0, 10)).first();
    if (c && c.c >= NEW_PER_DAY) return say('too many requests', 429);
  }
  await env.DB.prepare(`INSERT INTO users (email, name, account_email, mobile, business, trade, account, signed_up, first_seen, last_seen, days_active, app_build)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 1, ?10)
      ON CONFLICT(email) DO UPDATE SET
        name = COALESCE(NULLIF(users.name, ''), excluded.name),
        account_email = COALESCE(NULLIF(users.account_email, ''), excluded.account_email),
        mobile = COALESCE(NULLIF(users.mobile, ''), excluded.mobile),
        business = COALESCE(NULLIF(users.business, ''), excluded.business),
        trade = COALESCE(NULLIF(users.trade, ''), excluded.trade),
        account = COALESCE(NULLIF(users.account, ''), excluded.account),
        signed_up = COALESCE(users.signed_up, excluded.signed_up),
        days_active = users.days_active + (CASE WHEN substr(COALESCE(users.last_seen, ''), 1, 10) <> substr(excluded.last_seen, 1, 10) THEN 1 ELSE 0 END),
        last_seen = excluded.last_seen,
        app_build = COALESCE(NULLIF(excluded.app_build, ''), users.app_build)`)
    .bind(email, clean(d.name, 100), clean(d.accountEmail, 160).toLowerCase(), clean(d.mobile, 30), clean(d.business, 120),
      clean(d.trade, 60), clean(d.account, 20), d.event === 'signup' ? now : null, now, clean(d.build, 40))
    .run();
  await giveNumber(env.DB, email);
  /* how many properties they manage: a number only, sent by the app so the right plan can be shown */
  if (Number.isInteger(d.props) && d.props >= 0 && d.props < 10000) { try { await env.DB.prepare('UPDATE users SET props = ?2, home = ?3 WHERE email = ?1').bind(email, d.props, d.home ? 1 : 0).run(); } catch (e) {} }
  if (key) await env.DB.prepare("UPDATE users SET del_key = ?2 WHERE email = ?1 AND (del_key IS NULL OR del_key = '')").bind(email, key).run();
  return say('ok');
}
export const onRequest = () => say('use POST', 405);
