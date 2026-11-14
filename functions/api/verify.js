/* POST /api/verify   {action:'start', email, name}  -> emails a confirmation link (once a minute, 5 a day per address)
                      {action:'status', email}       -> {status:'confirmed'|'pending'|'none'}
   GET  /api/verify?t=TOKEN&e=EMAIL                   -> the link in the email: marks the address as confirmed
   Needs: the D1 database bound as DB (already used by sign-up) and a secret RESEND_API_KEY (Settings > Variables and Secrets).
   Optional variable MAIL_FROM, default "MySimpleDesk <support@mysimpledesk.co.uk>".
   Only an address that has asked for a link can be 'pending'. People who registered before this existed have no row, so are never locked out.
   Tokens are stored only as a hash and expire after 48 hours. */
import { ensureTable, tooMany } from './signup.js';

const say = (t, s, h) => new Response(t, { status: s || 200, headers: Object.assign({ 'Cache-Control': 'no-store' }, h || {}) });
const json = (o, s) => say(JSON.stringify(o), s, { 'Content-Type': 'application/json' });
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]+/g, ' ').trim().slice(0, n);
const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
let ready = false;
async function table(db) {
  await ensureTable(db);
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS verify (email TEXT PRIMARY KEY, token_hash TEXT, sent_at TEXT, sent_day TEXT, sent_n INTEGER DEFAULT 0, confirmed_at TEXT)').run();
  ready = true;
}
const page = (title, body) => say('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>body{font:16px system-ui,sans-serif;background:#FBFAF7;color:#101C26;margin:0;display:grid;place-items:center;min-height:100vh;padding:20px}main{max-width:440px;background:#fff;border:1px solid #D4DBDF;border-radius:14px;padding:28px}h1{font-size:22px;margin:0 0 10px}a.b{display:inline-block;margin-top:14px;background:#0A6B50;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600}</style></head><body><main>' + body + '</main></body></html>', 200, { 'Content-Type': 'text/html;charset=utf-8' });

export async function onRequestGet({ request, env }) {
  if (!env.DB) return page('Not ready', '<h1>Not ready yet</h1><p>Please try again later.</p>');
  const u = new URL(request.url), t = u.searchParams.get('t') || '', e = clean(u.searchParams.get('e'), 160).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(t) || !EMAIL.test(e)) return page('Link problem', '<h1>This link is not valid</h1><p>Open the latest email we sent you and use that link, or register again.</p>');
  await table(env.DB);
  const row = await env.DB.prepare('SELECT token_hash, sent_at, confirmed_at FROM verify WHERE email = ?1').bind(e).first();
  if (row && row.confirmed_at) return page('Confirmed', '<h1>Already confirmed</h1><p>Your email address is confirmed. You can log in.</p><a class="b" href="/?p=login">Log in</a>');
  if (!row || row.token_hash !== await sha(t) || Date.now() - Date.parse(row.sent_at) > 48 * 3600e3) return page('Link problem', '<h1>This link has expired or is not valid</h1><p>Go back to the app and press <b>Send the email again</b>.</p><a class="b" href="/?p=login">Open the app</a>');
  await env.DB.prepare('UPDATE verify SET confirmed_at = ?2, token_hash = NULL WHERE email = ?1').bind(e, new Date().toISOString()).run();
  return page('Confirmed', '<h1>Email confirmed</h1><p>Thank you. Your email address is confirmed. You can now log in.</p><a class="b" href="/?p=login">Log in</a>');
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'not set up' }, 503);
  const origin = request.headers.get('Origin');
  let oh = ''; try { oh = new URL(origin).host; } catch (e) {}
  if (!origin || oh !== new URL(request.url).host) return json({ error: 'forbidden' }, 403);
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return json({ error: 'forbidden' }, 403);
  const raw = await request.text();
  if (raw.length > 2000) return json({ error: 'too large' }, 413);
  let d; try { d = JSON.parse(raw); } catch (e) { return json({ error: 'bad request' }, 400); }
  const email = clean(d.email, 160).toLowerCase();
  if (!EMAIL.test(email)) return json({ error: 'bad email' }, 400);
  await table(env.DB);
  const row = await env.DB.prepare('SELECT sent_at, sent_day, sent_n, confirmed_at FROM verify WHERE email = ?1').bind(email).first();
  if (d.action === 'status') {
    let sus = false, no = null, since = null, pay = 'trial'; try { const alt = EMAIL.test(clean(d.alt, 160).toLowerCase()) ? clean(d.alt, 160).toLowerCase() : email; const u = await env.DB.prepare('SELECT 1 AS x FROM users WHERE (email IN (?1, ?2) OR lower(account_email) IN (?1, ?2)) AND suspended IS NOT NULL LIMIT 1').bind(email, alt).first(); sus = !!u;
      const me = await env.DB.prepare('SELECT user_no, pay, COALESCE(signed_up, first_seen) AS since FROM users WHERE email IN (?1, ?2) OR lower(account_email) IN (?1, ?2) ORDER BY COALESCE(signed_up, first_seen) ASC LIMIT 1').bind(email, alt).first();
      if (me) { no = me.user_no; since = me.since; pay = me.pay || 'trial'; } } catch (e) {}
    return json({ status: !row ? 'none' : row.confirmed_at ? 'confirmed' : 'pending', suspended: sus, no, since, pay });
  }
  if (d.action !== 'start') return json({ error: 'bad request' }, 400);
  if (!env.RESEND_API_KEY) return json({ error: 'email sending is not set up' }, 503);
  if (row && row.confirmed_at) return json({ status: 'confirmed' });
  const now = new Date(), nowIso = now.toISOString(), day = nowIso.slice(0, 10);
  if (await tooMany(env.DB, request, nowIso)) return json({ error: 'too many requests' }, 429);
  if (row && Date.now() - Date.parse(row.sent_at) < 60e3) return json({ status: 'pending', wait: true });
  const n = row && row.sent_day === day ? (row.sent_n || 0) : 0;
  if (n >= 5) return json({ error: 'too many emails today' }, 429);
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const link = new URL(request.url).origin + '/api/verify?t=' + token + '&e=' + encodeURIComponent(email);
  const name = clean(d.name, 80) || 'there', from = env.MAIL_FROM || 'MySimpleDesk <support@mysimpledesk.co.uk>';
  const html = '<div style="font:16px system-ui,sans-serif;color:#101C26;max-width:480px"><p>Hello ' + name + ',</p><p>Please confirm your email address to finish registering with MySimpleDesk.</p><p><a href="' + link + '" style="display:inline-block;background:#0A6B50;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Confirm my email</a></p><p style="font-size:13px;color:#58697A">Or copy this link into your browser:<br>' + link + '</p><p style="font-size:13px;color:#58697A">The link works for 48 hours. If you did not register, you can ignore this email.</p></div>';
  const text = 'Hello ' + name + ',\n\nPlease confirm your email address to finish registering with MySimpleDesk:\n' + link + '\n\nThe link works for 48 hours. If you did not register, ignore this email.';
  let ok = false;
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject: 'Confirm your email for MySimpleDesk', html, text }) });
    ok = r.ok;
  } catch (e) { ok = false; }
  if (!ok) return json({ error: 'could not send' }, 502);
  await env.DB.prepare('INSERT INTO verify (email, token_hash, sent_at, sent_day, sent_n) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT(email) DO UPDATE SET token_hash = ?2, sent_at = ?3, sent_day = ?4, sent_n = ?5').bind(email, await sha(token), nowIso, day, n + 1).run();
  return json({ status: 'pending' });
}
