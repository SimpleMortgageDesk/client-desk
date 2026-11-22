/* GET /api/admin/users          list everyone in the sign-up list
   DELETE /api/admin/users?email= move one person to Deleted accounts (kept 30 days, then erased); add &permanent=1 to erase now
   POST /api/admin/users?email=&restore=1  bring a deleted account back (within 30 days)
   POST /api/admin/users?email=&pay=trial|paid|due  set one person's payment status
   POST /api/admin/users?email=&tradeunlock=1|0  let someone with two trades change them again (they email support to ask)
   POST /api/admin/users?email=&suspend=1|0  suspend or restore one person (the app then shows them a suspended screen)
   Protected twice: Cloudflare Access must cover /admin* and /api/admin*, and this code checks Access's signed
   token itself. Settings > Variables: ACCESS_TEAM (e.g. yourteam.cloudflareaccess.com) and ACCESS_AUD (the
   Application Audience tag from the Access application). Optional ADMIN_EMAILS: comma-separated allowed emails. */
import { ensureTable, giveNumber } from '../signup.js';

const json = (o, s) =>
  new Response(JSON.stringify(o), {
    status: s || 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin'
    }
  });
const b64 = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) =>
    c.charCodeAt(0)
  );
let certs = null,
  certsAt = 0;

async function adminEmail(request, env) {
  const team = String(env.ACCESS_TEAM || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, ''),
    aud = env.ACCESS_AUD;
  const tok = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!team || !aud || !tok) return null;
  const parts = tok.split('.');
  if (parts.length !== 3) return null;
  let head, body;
  try {
    head = JSON.parse(new TextDecoder().decode(b64(parts[0])));
    body = JSON.parse(new TextDecoder().decode(b64(parts[1])));
  } catch (e) {
    return null;
  }
  if (head.alg !== 'RS256' || !head.kid) return null;
  if (!certs || Date.now() - certsAt > 3600e3) {
    certs = await (await fetch('https://' + team + '/cdn-cgi/access/certs')).json();
    certsAt = Date.now();
  }
  const jwk = (certs.keys || []).find((k) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (
    !ok ||
    body.iss !== 'https://' + team ||
    !(Array.isArray(body.aud) ? body.aud : [body.aud]).includes(aud) ||
    !(body.exp * 1000 > Date.now())
  )
    return null;
  const allow = String(env.ADMIN_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const who = String(body.email || '').toLowerCase();
  if (allow.length && allow.indexOf(who) < 0) return null;
  return who || 'admin';
}

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ error: 'The sign-up database is not connected yet.' }, 503);
  let who = null;
  try {
    who = await adminEmail(request, env);
  } catch (e) {
    who = null;
  }
  if (!who) return json({ error: 'Not signed in as an admin. Check the Cloudflare Access settings.' }, 401);
  /* changes must come from the admin page itself, not from another website */
  if (request.method !== 'GET') {
    let oh = '';
    try {
      oh = new URL(request.headers.get('Origin')).host;
    } catch (e) {}
    if (oh !== new URL(request.url).host) return json({ error: 'Forbidden' }, 403);
  }
  await ensureTable(env.DB);
  /* accounts deleted more than 30 days ago are erased for good */
  const cut = new Date(Date.now() - 30 * 864e5).toISOString();
  try {
    await env.DB.prepare('DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < ?1')
      .bind(cut)
      .run();
  } catch (e) {}
  if (request.method === 'GET') {
    const none = await env.DB.prepare(
      'SELECT email FROM users WHERE user_no IS NULL AND deleted_at IS NULL ORDER BY COALESCE(signed_up, first_seen) ASC'
    ).all();
    for (const u of none.results || []) await giveNumber(env.DB, u.email);
    const r = await env.DB.prepare(
      'SELECT * FROM users WHERE deleted_at IS NULL ORDER BY COALESCE(signed_up, first_seen) DESC'
    ).all();
    const dl = await env.DB.prepare(
      'SELECT user_no, name, email, account_email, mobile, business, trade, pay, signed_up, first_seen, deleted_at FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    ).all();
    /* false means anyone Cloudflare Access lets in could use this page: ADMIN_EMAILS (your own address) should be set */
    const hardened = String(env.ADMIN_EMAILS || '')
      .split(',')
      .some((x) => x.trim());
    /* people who filled in the Register form but have not finished: still to confirm the email, or confirmed but not yet signed in (includes people who registered before names were kept) */
    let pending = [];
    try {
      pending =
        (
          await env.DB.prepare(
            'SELECT v.email, v.name, v.mobile, v.trade, v.first_at, v.sent_at, v.sent_n, v.confirmed_at FROM verify v WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.deleted_at IS NULL AND (u.email = v.email OR lower(u.account_email) = v.email)) ORDER BY COALESCE(v.first_at, v.sent_at) DESC LIMIT 200'
          ).all()
        ).results || [];
    } catch (e) {
      pending = [];
    }
    return json({ admin: who, hardened, users: r.results || [], deleted: dl.results || [], pending });
  }
  if (request.method === 'DELETE') {
    const email = (new URL(request.url).searchParams.get('email') || '').toLowerCase();
    if (!email) return json({ error: 'No email given' }, 400);
    if (new URL(request.url).searchParams.get('permanent') === '1') {
      await env.DB.prepare('DELETE FROM users WHERE email = ?1').bind(email).run();
      return json({ erased: email });
    }
    await env.DB.prepare('UPDATE users SET deleted_at = ?2 WHERE email = ?1')
      .bind(email, new Date().toISOString())
      .run();
    return json({ deleted: email });
  }
  if (request.method === 'POST') {
    const u = new URL(request.url),
      email = (u.searchParams.get('email') || '').toLowerCase(),
      on = u.searchParams.get('suspend') === '1';
    if (!email) return json({ error: 'No email given' }, 400);
    /* bring a deleted account back, if the person asked within the 30 days */
    if (u.searchParams.get('restore') === '1') {
      await env.DB.prepare('UPDATE users SET deleted_at = NULL WHERE email = ?1').bind(email).run();
      return json({ email, restored: true });
    }
    /* payment status set by the owner: trial (the default, stored as empty), paid or due */
    const pay = u.searchParams.get('pay');
    if (pay !== null) {
      if (['trial', 'paid', 'due'].indexOf(pay) < 0) return json({ error: 'Unknown status' }, 400);
      await env.DB.prepare('UPDATE users SET pay = ?2 WHERE email = ?1')
        .bind(email, pay === 'trial' ? null : pay)
        .run();
      return json({ email, pay });
    }
    /* let this person change their two trades again: they asked support by email; it is used up when they next save their trades */
    const tul = u.searchParams.get('tradeunlock');
    if (tul !== null) {
      const at = tul === '1' ? new Date().toISOString() : null;
      await env.DB.prepare('UPDATE users SET trade_unlock = ?2 WHERE email = ?1').bind(email, at).run();
      return json({ email, trade_unlock: at });
    }
    await env.DB.prepare('UPDATE users SET suspended = ?2 WHERE email = ?1')
      .bind(email, on ? new Date().toISOString() : null)
      .run();
    return json({ email, suspended: on });
  }
  return json({ error: 'Not allowed' }, 405);
}
