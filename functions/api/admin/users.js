/* GET /api/admin/users          list everyone in the sign-up list
   DELETE /api/admin/users?email= remove one person (for deletion requests)
   Protected twice: Cloudflare Access must cover /admin* and /api/admin*, and this code checks Access's signed
   token itself. Settings > Variables: ACCESS_TEAM (e.g. yourteam.cloudflareaccess.com) and ACCESS_AUD (the
   Application Audience tag from the Access application). Optional ADMIN_EMAILS: comma-separated allowed emails. */
import { ensureTable } from '../signup.js';

const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let certs = null, certsAt = 0;

async function adminEmail(request, env) {
  const team = String(env.ACCESS_TEAM || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''), aud = env.ACCESS_AUD;
  const tok = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!team || !aud || !tok) return null;
  const parts = tok.split('.'); if (parts.length !== 3) return null;
  let head, body; try { head = JSON.parse(new TextDecoder().decode(b64(parts[0]))); body = JSON.parse(new TextDecoder().decode(b64(parts[1]))); } catch (e) { return null; }
  if (head.alg !== 'RS256' || !head.kid) return null;
  if (!certs || Date.now() - certsAt > 3600e3) { certs = await (await fetch('https://' + team + '/cdn-cgi/access/certs')).json(); certsAt = Date.now(); }
  const jwk = (certs.keys || []).find(k => k.kid === head.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok || body.iss !== 'https://' + team || !(Array.isArray(body.aud) ? body.aud : [body.aud]).includes(aud) || !(body.exp * 1000 > Date.now())) return null;
  const allow = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const who = String(body.email || '').toLowerCase();
  if (allow.length && allow.indexOf(who) < 0) return null;
  return who || 'admin';
}

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ error: 'The sign-up database is not connected yet.' }, 503);
  let who = null; try { who = await adminEmail(request, env); } catch (e) { who = null; }
  if (!who) return json({ error: 'Not signed in as an admin. Check the Cloudflare Access settings.' }, 401);
  await ensureTable(env.DB);
  if (request.method === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM users ORDER BY COALESCE(signed_up, first_seen) DESC').all();
    return json({ admin: who, users: r.results || [] });
  }
  if (request.method === 'DELETE') {
    const email = (new URL(request.url).searchParams.get('email') || '').toLowerCase();
    if (!email) return json({ error: 'No email given' }, 400);
    await env.DB.prepare('DELETE FROM users WHERE email = ?1').bind(email).run();
    return json({ deleted: email });
  }
  return json({ error: 'Not allowed' }, 405);
}
