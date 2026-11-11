/* POST /api/signup
   Stores the ACCOUNT HOLDER's own details (name, email, mobile, business, kind of work, account type, dates).
   Never their records: no tenants, clients, properties, documents or passwords are ever sent here.
   Needs a D1 database bound to this Pages project as DB (Settings > Bindings). The tables are created automatically.

   This address is open to the internet, so it protects the list three ways:
   1. Details already saved for an email are never overwritten from here: a call can only fill in blanks and record activity.
   2. Each sender is limited to PER_HOUR calls an hour. Senders are counted by a scrambled, short-lived code, not their IP address.
   3. No more than NEW_PER_DAY new people can be added in one day. */
const PER_HOUR = 30, NEW_PER_DAY = 300;
let ready = false;
export async function ensureTable(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY, name TEXT, account_email TEXT, mobile TEXT, business TEXT, trade TEXT, account TEXT,
    signed_up TEXT, first_seen TEXT, last_seen TEXT, days_active INTEGER DEFAULT 0, app_build TEXT)`).run();
  await db.prepare('CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, hr TEXT, n INTEGER)').run();
  ready = true;
}
/* true when this sender has made too many calls this hour */
async function tooMany(db, request, now) {
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
  return say('ok');
}
export const onRequest = () => say('use POST', 405);
