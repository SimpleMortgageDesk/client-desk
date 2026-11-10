/* POST /api/signup
   Stores the ACCOUNT HOLDER's own details (name, email, mobile, business, kind of work, account type, dates).
   Never their records: no tenants, clients, properties, documents or passwords are ever sent here.
   Needs a D1 database bound to this Pages project as DB (Settings > Bindings). The table is created automatically. */
let ready = false;
export async function ensureTable(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY, name TEXT, account_email TEXT, mobile TEXT, business TEXT, trade TEXT, account TEXT,
    signed_up TEXT, first_seen TEXT, last_seen TEXT, days_active INTEGER DEFAULT 0, app_build TEXT)`).run();
  ready = true;
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const say = (t, s) => new Response(t, { status: s || 200, headers: { 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.DB) return say('sign-up list not set up', 503);
  /* only accept calls made by the app's own pages */
  const origin = request.headers.get('Origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) return say('forbidden', 403);
  const raw = await request.text();
  if (raw.length > 4000) return say('too large', 413);
  let d; try { d = JSON.parse(raw); } catch (e) { return say('bad request', 400); }
  const email = clean(d.email || d.accountEmail, 160).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('ignored', 202);
  const now = new Date().toISOString();
  await ensureTable(env.DB);
  await env.DB.prepare(`INSERT INTO users (email, name, account_email, mobile, business, trade, account, signed_up, first_seen, last_seen, days_active, app_build)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 1, ?10)
      ON CONFLICT(email) DO UPDATE SET
        name = COALESCE(NULLIF(excluded.name, ''), users.name),
        account_email = COALESCE(NULLIF(excluded.account_email, ''), users.account_email),
        mobile = COALESCE(NULLIF(excluded.mobile, ''), users.mobile),
        business = COALESCE(NULLIF(excluded.business, ''), users.business),
        trade = COALESCE(NULLIF(excluded.trade, ''), users.trade),
        account = COALESCE(NULLIF(excluded.account, ''), users.account),
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
