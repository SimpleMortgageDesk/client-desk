/* Client Desk (web): Microsoft or Google sign-in, OneDrive or Google Drive storage, offline cache.
   Stores one JSON file per record in a folder named after the business, in the user's own OneDrive (Apps / <app> / <business>)
   or Google Drive (My Drive / <app> - <business>). No other server is used. */
(function () {
  'use strict';
  var CFG = window.MD_CONFIG || {};
  var APPN = CFG.appName || 'Client Desk', APPF = APPN.replace(/[^A-Za-z0-9]+/g, '-');
  var TR = function () { return (window.CD_T && window.CD_T()) || { noun: ['Record', 'Records'], fields: [], id: 'general' }; };
  var BASE_SCOPES = 'Files.ReadWrite.AppFolder User.Read offline_access';
  var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lset = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  function scopes() { return BASE_SCOPES + ((ls('cd.cal') === '1' || ls('cd.calwant') === '1') ? ' Calendars.ReadWrite' : '') + ((ls('cd.mail') === '1' || ls('cd.mailwant') === '1') ? ' Mail.Send' : ''); }
  var AUTH = 'https://login.microsoftonline.com/' + (CFG.tenant || 'common') + '/oauth2/v2.0/';
  var GRAPH = 'https://graph.microsoft.com/v1.0';
  var APP = '/me/drive/special/approot';
  /* storage provider: 'ms' (OneDrive) or 'google' (Google Drive). Chosen on the sign-in screen. */
  var PROV = (ls('cd.prov') === 'google') ? 'google' : 'ms';
  var GAUTH = 'https://accounts.google.com/o/oauth2/v2/auth', GAPI = 'https://www.googleapis.com';
  var GSCOPE = 'openid email profile https://www.googleapis.com/auth/drive.file';
  var GFOLDER = 'application/vnd.google-apps.folder';
  function SNAME() { return PROV === 'google' ? 'Google Drive' : 'OneDrive'; }
  function FOLDER() { var f = ls('cd.folder'); return f == null ? null : f; }
  function rootLabel() {
    var f = FOLDER() || '';
    return PROV === 'google' ? 'Google Drive \u203a My Drive \u203a ' + gRootName(f) : 'OneDrive \u203a Apps \u203a ' + APPN + (f ? ' \u203a ' + f : '');
  }
  function gRootName(f) { return APPN + ' \u2013 ' + f; }
  /* Google sign-in pop-up: hand the result back to the main window and close. */
  if (window.opener && window.name === 'cdg' && /access_token=|error=/.test(location.hash)) {
    try { window.opener.postMessage({ cdg: location.hash.slice(1) }, location.origin); } catch (e) {}
    window.CD_POPUP = true; document.documentElement.style.display = 'none'; setTimeout(function () { window.close(); }, 50);
    return;
  }
  var COLS = ['cases', 'notebook', 'appointments', 'marketing', 'settings'];
  var REDIRECT = CFG.redirectUri || (location.origin + location.pathname.replace(/[^\/]*$/, ''));
  var $ = function (i) { return document.getElementById(i); };
  var enc = function (p) { return p.split('/').map(encodeURIComponent).join('/'); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var safeId = function (s) { return String(s).replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 120); };
  var genId = function () { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- small UI helpers ---------- */
  function toast(msg) {
    var t = $('mdToast');
    if (!t) { t = document.createElement('div'); t.id = 'mdToast'; t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:20px;background:#101C26;color:#fff;padding:10px 16px;border-radius:8px;z-index:200;max-width:90vw;font:14px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)'; document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, 5000);
  }
  window.mdToast = toast;

  /* ---------- tokens (Microsoft sign-in, PKCE, no library) ---------- */
  function readTok() { try { return JSON.parse(localStorage.getItem('cd.tok2') || 'null'); } catch (e) { return null; } }
  function writeTok(t) { try { if (t) localStorage.setItem('cd.tok2', JSON.stringify(t)); else localStorage.removeItem('cd.tok2'); } catch (e) {} }
  var memTok = null;
  function tok() { return memTok || (memTok = readTok()); }
  function setTok(t) { memTok = t; writeTok(t); }
  function b64url(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function rand(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
  function form(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }

  async function startLogin(reauth) {
    if (window.CD_DEMO_LOGIN) return window.CD_DEMO_LOGIN('ms');
    var v = rand(48), st = rand(16);
    var h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
    try { localStorage.setItem('cd.pkce', JSON.stringify({ v: v, st: st })); } catch (e) {}
    location.href = AUTH + 'authorize?' + form(Object.assign({ client_id: CFG.clientId, response_type: 'code', redirect_uri: REDIRECT, response_mode: 'query', scope: scopes(), state: st, code_challenge: b64url(h), code_challenge_method: 'S256', prompt: reauth ? 'login' : 'select_account' }, reauth && ((tok() || {}).account || {}).mail ? { login_hint: tok().account.mail } : {}));
  }
  async function tokenRequest(params) {
    var r = await fetch(AUTH + 'token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(Object.assign({ client_id: CFG.clientId, scope: scopes() }, params)) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error_description || j.error || 'Sign-in failed'); e.auth = true; e.code = j.error; throw e; }
    var old = tok() || {};
    setTok({ access: j.access_token, refresh: j.refresh_token || old.refresh, exp: Date.now() + (j.expires_in || 3600) * 1000, account: old.account });
    return j;
  }
  /* ---------- Google sign-in (OAuth 2.0 for browser apps, no Google script loaded) ---------- */
  function gUrl(mode, hint) {
    var s = rand(16); lset('cd.gstate', s);
    return GAUTH + '?' + form(Object.assign({ client_id: CFG.googleClientId || '', redirect_uri: REDIRECT, response_type: 'token', scope: GSCOPE, state: s, include_granted_scopes: 'true' },
      mode === 'login' ? { prompt: 'select_account' } : {}, hint ? { login_hint: hint } : {}));
  }
  function gStart() {
    if (window.CD_DEMO_LOGIN) return window.CD_DEMO_LOGIN('google');
    lset('cd.prov', 'google'); location.href = gUrl('login');
  }
  function gParse(h) { var p = new URLSearchParams(h); return { at: p.get('access_token'), exp: +p.get('expires_in') || 3600, st: p.get('state'), err: p.get('error'), scope: p.get('scope') || '' }; }
  var gWaiting = null;
  function gRenew() {
    var acc = (tok() || {}).account || {};
    var w = null; try { w = window.open(gUrl('renew', acc.mail || ''), 'cdg', 'width=520,height=640'); } catch (e) {}
    if (!w) { lset('cd.prov', 'google'); location.href = gUrl('renew', acc.mail || ''); return; }
    gWaiting = w;
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || typeof e.data.cdg !== 'string') return;
    var r = gParse(e.data.cdg); gWaiting = null;
    if (r.err || !r.at) { gBanner('Google did not reconnect (' + (r.err || 'no access') + '). Try again.'); return; }
    if (r.st !== ls('cd.gstate')) { gBanner('That reconnection could not be verified. Try again.'); return; }
    if (!/drive\.file/.test(r.scope)) { gBanner('Google did not give access to Drive. Tick the Drive box when you reconnect.'); return; }
    lset('cd.gstate', null);
    var t = tok() || {}, old = String((t.account || {}).mail || '').toLowerCase();
    fetch(GAPI + '/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + r.at } }).then(function (x) { return x.ok ? x.json() : {}; }, function () { return {}; }).then(function (u) {
      var now = String(u.email || '').toLowerCase();
      if (old && now && old !== now) { gBanner('That was a different Google account (' + now + '). Reconnect with ' + old + '.'); return; }
      setTok({ access: r.at, exp: Date.now() + r.exp * 1000, prov: 'google', account: t.account });
      gBannerOff(); st.err = ''; setState(); flush(); pull();
      if (window.CD_gAfter) { var f = window.CD_gAfter; window.CD_gAfter = null; f(); }
    });
  });
  function gBanner(msg) {
    var b = $('cdGBar');
    if (!b) { b = document.createElement('div'); b.id = 'cdGBar'; b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:72px;z-index:240;background:#FFF6DD;border:1px solid #E8D9A8;color:#4a3b00;border-radius:10px;padding:10px 12px;font:14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:94vw;box-shadow:0 4px 16px rgba(0,0,0,.15)'; document.body.appendChild(b); }
    b.innerHTML = '<span>' + esc(msg || 'Google asks you to confirm access to your Drive every hour. Your changes are kept safely on this device until you do.') + '</span><button type="button" class="btn sm" id="cdGGo">Reconnect Google Drive</button>';
    b.querySelector('#cdGGo').onclick = gRenew;
  }
  function gBannerOff() { var b = $('cdGBar'); if (b) b.remove(); }
  var refreshing = null;
  function getToken() {
    var t = tok();
    if (!t) { var e = new Error('Not signed in'); e.auth = true; return Promise.reject(e); }
    if (PROV === 'google') {
      if (t.exp - Date.now() > 60000) return Promise.resolve(t.access);
      var ge = new Error('Google needs you to reconnect'); ge.auth = true; ge.renew = true; gBanner(); return Promise.reject(ge);
    }
    if (t.exp - Date.now() > 120000) return Promise.resolve(t.access);
    if (refreshing) return refreshing;
    refreshing = tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh }).then(function () { return tok().access; }, function (e) {
      if (e.auth && /invalid_grant|interaction_required|invalid_request/.test(e.code || '')) { setTok(null); sessionExpired(); }
      throw e;
    }).then(function (a) { refreshing = null; return a; }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }
  async function gfetch(path, opt, retried) {
    opt = opt || {};
    var at = await getToken();
    var url = path.indexOf('http') === 0 ? path : (PROV === 'google' ? GAPI : GRAPH) + path;
    var r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + at }, opt.headers || {}) }));
    if (r.status === 401 && PROV === 'google') { var tg = tok(); if (tg) { tg.exp = 0; setTok(tg); } return gfetch(path, opt, true); }
    if (r.status === 401 && !retried) { var t = tok(); if (t) { t.exp = 0; } return gfetch(path, opt, true); }
    if ((r.status === 429 || r.status === 503) && !retried) { await sleep(Math.min(10, +r.headers.get('Retry-After') || 2) * 1000); return gfetch(path, opt, true); }
    return r;
  }
  function httpErr(r) { var e = new Error(SNAME() + ' said ' + r.status); e.status = r.status; return e; }

  /* ---------- local cache (IndexedDB) ---------- */
  var idb = null;
  function openIdb() {
    return new Promise(function (res) {
      try {
        var q = indexedDB.open('client-desk', 1);
        q.onupgradeneeded = function () { var d = q.result; d.createObjectStore('docs', { keyPath: 'k' }); d.createObjectStore('dirty', { keyPath: 'k' }); };
        q.onsuccess = function () { idb = q.result; res(); };
        q.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function idbAll(store) { return new Promise(function (res) { if (!idb) return res([]); try { var q = idb.transaction(store).objectStore(store).getAll(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; } catch (e) { res([]); } }); }
  function idbPut(store, o) { if (!idb) return; try { idb.transaction(store, 'readwrite').objectStore(store).put(o); } catch (e) {} }
  function idbDel(store, k) { if (!idb) return; try { idb.transaction(store, 'readwrite').objectStore(store).delete(k); } catch (e) {} }
  function idbClearAll() { return new Promise(function (res) { if (!idb) return res(); try { var t = idb.transaction(['docs', 'dirty'], 'readwrite'); t.objectStore('docs').clear(); t.objectStore('dirty').clear(); t.oncomplete = res; t.onerror = res; } catch (e) { res(); } }); }

  var mem = { cases: {}, notebook: {}, appointments: {}, marketing: {}, settings: {} }, dirty = {}, vctr = 0, subs = { cases: [], notebook: [], appointments: [], marketing: [], settings: [] };
  function persistDoc(col, id) { var d = mem[col][id]; if (d) idbPut('docs', { k: col + '/' + id, col: col, id: id, data: d.data, etag: d.etag, itemId: d.itemId }); }
  function snap(col) { return { docs: Object.keys(mem[col]).map(function (id) { var d = mem[col][id].data; return { id: id, data: function () { return clone(d); } }; }) }; }
  function notify(col) { subs[col].forEach(function (cb) { try { cb(snap(col)); } catch (e) { console.error(e); } }); }
  var base = function () { var f = FOLDER(); return f ? f + '/' : ''; };
  var docPath = function (col, id) { return APP + ':/' + enc(base() + col + '/' + id + '.json'); };

  /* ---------- storage: the same small set of operations for OneDrive and Google Drive ---------- */
  var gcols = (function () { try { return JSON.parse(ls('cd.gcols') || '{}') || {}; } catch (e) { return {}; } })();
  function gq(q, fields) {
    return (async function () {
      var out = [], tokn = '';
      do {
        var r = await gfetch('/drive/v3/files?' + form({ q: q, spaces: 'drive', pageSize: 1000, fields: 'nextPageToken,files(' + fields + ')' }) + (tokn ? '&pageToken=' + encodeURIComponent(tokn) : ''));
        if (!r.ok) throw httpErr(r);
        var j = await r.json(); out = out.concat(j.files || []); tokn = j.nextPageToken || '';
      } while (tokn);
      return out;
    })();
  }
  async function gColId(col, create) {
    var root = ls('cd.gfid'); if (!root) { var e = new Error('No Google Drive folder chosen'); e.status = 0; throw e; }
    if (gcols[col]) return gcols[col];
    (await gq("'" + root + "' in parents and mimeType='" + GFOLDER + "' and trashed=false", 'id,name')).forEach(function (f) { if (!gcols[f.name]) gcols[f.name] = f.id; });
    if (!gcols[col] && create) {
      var r = await gfetch('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: col, mimeType: GFOLDER, parents: [root] }) });
      if (!r.ok) throw httpErr(r); gcols[col] = (await r.json()).id;
    }
    lset('cd.gcols', JSON.stringify(gcols));
    return gcols[col] || null;
  }
  async function gFind(col, id, itemId) {
    if (itemId) return itemId;
    var cid = await gColId(col, false); if (!cid) return null;
    var f = await gq("name='" + id + ".json' and '" + cid + "' in parents and trashed=false", 'id');
    return f.length ? f[0].id : null;
  }
  var ST = {
    list: async function (col) {
      if (PROV === 'google') {
        var cid = await gColId(col, false); if (!cid) return [];
        return (await gq("'" + cid + "' in parents and trashed=false", 'id,name,version')).filter(function (f) { return /\.json$/.test(f.name || ''); })
          .map(function (f) { return { id: f.name.slice(0, -5), itemId: f.id, etag: 'v' + f.version }; });
      }
      var out = [], url = APP + ':/' + enc(base() + col) + ':/children?$select=id,name,eTag&$top=200';
      while (url) {
        var r = await gfetch(url);
        if (r.status === 404) return out;
        if (!r.ok) throw httpErr(r);
        var j = await r.json();
        (j.value || []).forEach(function (it) { if (it.name && /\.json$/.test(it.name)) out.push({ id: it.name.slice(0, -5), itemId: it.id, etag: it.eTag }); });
        url = j['@odata.nextLink'] || null;
      }
      return out;
    },
    read: async function (col, id, itemId) {
      var r = PROV === 'google' ? await gfetch('/drive/v3/files/' + encodeURIComponent(itemId) + '?alt=media')
        : await gfetch(itemId ? '/me/drive/items/' + encodeURIComponent(itemId) + '/content' : docPath(col, id) + ':/content');
      if (!r.ok) throw httpErr(r);
      return r.json();
    },
    meta: async function (col, id) {
      if (PROV === 'google') {
        var fid = await gFind(col, id, null); if (!fid) return null;
        var g = await gfetch('/drive/v3/files/' + encodeURIComponent(fid) + '?fields=id,version,trashed');
        if (g.status === 404) return null; if (!g.ok) throw httpErr(g);
        var gj = await g.json(); return gj.trashed ? null : { id: gj.id, eTag: 'v' + gj.version };
      }
      var m = await gfetch(docPath(col, id));
      if (m.status === 404) return null; if (!m.ok) throw httpErr(m);
      var mj = await m.json(); return { id: mj.id, eTag: mj.eTag };
    },
    /* returns {status:200, eTag, id}, or {status:412} when someone else changed it first */
    put: async function (col, id, data, etag, itemId) {
      if (PROV === 'google') {
        var cid = await gColId(col, true), fid = await gFind(col, id, itemId);
        if (fid && etag) {
          var g = await gfetch('/drive/v3/files/' + encodeURIComponent(fid) + '?fields=version,trashed');
          if (g.status === 404) fid = null;
          else { if (!g.ok) throw httpErr(g); var gv = await g.json(); if (gv.trashed) fid = null; else if ('v' + gv.version !== etag) return { status: 412 }; }
        }
        var r;
        if (fid) r = await gfetch(GAPI + '/upload/drive/v3/files/' + encodeURIComponent(fid) + '?uploadType=media&fields=id,version', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        else {
          var bnd = 'cd' + rand(12), body = '--' + bnd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: id + '.json', parents: [cid], mimeType: 'application/json' }) +
            '\r\n--' + bnd + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(data) + '\r\n--' + bnd + '--';
          r = await gfetch(GAPI + '/upload/drive/v3/files?uploadType=multipart&fields=id,version', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bnd }, body: body });
        }
        if (r.status === 404 && fid) return ST.put(col, id, data, null, null);
        if (!r.ok) throw httpErr(r);
        var rj = await r.json(); return { status: 200, eTag: 'v' + rj.version, id: rj.id };
      }
      var h = { 'Content-Type': 'application/json' }; if (etag) h['If-Match'] = etag;
      var m = await gfetch(docPath(col, id) + ':/content', { method: 'PUT', headers: h, body: JSON.stringify(data) });
      if (m.status === 412 || m.status === 400) return { status: m.status };
      if (!m.ok) throw httpErr(m);
      var mj = await m.json(); return { status: 200, eTag: mj.eTag, id: mj.id };
    },
    del: async function (col, id, itemId) {
      if (PROV === 'google') {
        var fid = await gFind(col, id, itemId); if (!fid) return;
        var r = await gfetch('/drive/v3/files/' + encodeURIComponent(fid), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
        if (!r.ok && r.status !== 404) throw httpErr(r); return;
      }
      var rd = await gfetch(docPath(col, id), { method: 'DELETE' });
      if (!rd.ok && rd.status !== 404) throw httpErr(rd);
    },
    folderUrl: async function () {
      if (PROV === 'google') return ls('cd.gfid') ? 'https://drive.google.com/drive/folders/' + encodeURIComponent(ls('cd.gfid')) : '';
      var r = await gfetch(FOLDER() ? APP + ':/' + enc(FOLDER()) : APP); if (!r.ok) return ''; return (await r.json()).webUrl || '';
    }
  };

  /* ---------- status text ---------- */
  var st = { offline: false, busy: '', last: 0, err: '' };
  function pending() { return Object.keys(dirty).length; }
  function setState() {
    var el = $('syncState'); if (!el) return;
    var txt, col = '#58697A';
    if (!tok()) txt = 'Not signed in';
    else if (st.busy) txt = st.busy;
    else if (st.err) { txt = st.err + (pending() ? ' · ' + pending() + ' waiting' : ''); col = '#A3261F'; }
    else if (st.offline) { txt = 'Offline' + (pending() ? ' · ' + pending() + ' change' + (pending() > 1 ? 's' : '') + ' waiting' : ''); col = '#8A5A00'; }
    else if (pending()) txt = 'Saving…';
    else { txt = st.last ? 'Saved to ' + SNAME() + ' ' + new Date(st.last).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Connected'; col = '#0A6B50'; }
    el.textContent = txt; el.style.color = col;
  }

  /* ---------- writing (local first, then OneDrive) ---------- */
  function localWrite(col, id, data, kind, patch) {
    var cur = mem[col][id];
    mem[col][id] = { data: data, etag: cur ? cur.etag : null, itemId: cur ? cur.itemId : null };
    persistDoc(col, id);
    var k = col + '/' + id, d = dirty[k];
    var nd = { k: k, col: col, id: id, kind: (kind === 'set' || (d && d.kind === 'set')) ? 'set' : 'patch', patch: kind === 'set' ? {} : Object.assign({}, d && d.patch || {}, patch || {}), v: ++vctr };
    dirty[k] = nd; idbPut('dirty', nd); notify(col); scheduleFlush(); setState();
  }
  function localDelete(col, id) {
    if (col === 'appointments' && mem[col][id] && mem[col][id].data && mem[col][id].data.calId) { var cd = calDelList(); cd.push(mem[col][id].data.calId); setCalDel(cd); calSchedule(2000); }
    var oldItem = mem[col][id] ? mem[col][id].itemId : null;
    delete mem[col][id]; idbDel('docs', col + '/' + id);
    var k = col + '/' + id, nd = { k: k, col: col, id: id, kind: 'del', patch: {}, v: ++vctr, itemId: oldItem };
    dirty[k] = nd; idbPut('dirty', nd); notify(col); scheduleFlush(); setState();
  }
  function clearDirty(d) { delete dirty[d.k]; idbDel('dirty', d.k); }
  var flushing = false, flushTimer = null;
  function scheduleFlush(ms) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms == null ? 800 : ms); }
  async function resolveConflict(d) {
    var meta = await ST.meta(d.col, d.id);
    if (!meta) { var r0 = await ST.put(d.col, d.id, mem[d.col][d.id].data, null, null); if (r0.status !== 200) throw httpErr(r0); mem[d.col][d.id].etag = r0.eTag; mem[d.col][d.id].itemId = r0.id; persistDoc(d.col, d.id); clearDirty(d); return; }
    var remote = await ST.read(d.col, d.id, meta.id);
    var merged = d.kind === 'set' ? mem[d.col][d.id].data : Object.assign({}, remote, d.patch);
    var r = await ST.put(d.col, d.id, merged, meta.eTag, meta.id);
    if (r.status !== 200) throw httpErr(r);
    mem[d.col][d.id] = { data: merged, etag: r.eTag, itemId: r.id }; persistDoc(d.col, d.id); clearDirty(d); notify(d.col);
    toast('Combined changes made on another device');
  }
  async function pushOne(d) {
    if (d.kind === 'del') { await ST.del(d.col, d.id, d.itemId || null); clearDirty(d); return; }
    var doc = mem[d.col][d.id]; if (!doc) { clearDirty(d); return; }
    var v = d.v, r = await ST.put(d.col, d.id, doc.data, doc.etag, doc.itemId);
    if (r.status === 412) return resolveConflict(d);
    if (r.status === 400 && doc.etag) { r = await ST.put(d.col, d.id, doc.data, null, doc.itemId); }
    if (r.status !== 200) throw httpErr(r);
    doc.etag = r.eTag; doc.itemId = r.id; persistDoc(d.col, d.id);
    if (dirty[d.k] && dirty[d.k].v === v) clearDirty(d);
  }
  async function flush() {
    if (flushing || !tok()) return;
    flushing = true;
    try {
      var keys = Object.keys(dirty);
      for (var i = 0; i < keys.length; i++) { if (dirty[keys[i]]) await pushOne(dirty[keys[i]]); }
      st.offline = false; st.err = ''; st.last = Date.now();
      flushing = false; setState();
      if (pending()) scheduleFlush(300);
    } catch (e) {
      flushing = false; handleErr(e);
      if (!e.auth) scheduleFlush(30000);
    }
  }
  function handleErr(e) {
    if (e && e.auth) { st.err = e.renew ? 'Reconnect Google Drive to sync' : 'Sign-in needed'; setState(); return; }
    if (e instanceof TypeError || (e && /Failed to fetch|NetworkError|Load failed/i.test(e.message))) { st.offline = true; st.err = ''; }
    else { st.err = 'Sync problem (' + (e && e.message || 'unknown') + ')'; st.offline = false; }
    setState();
  }

  /* ---------- reading (delta by eTag) ---------- */
  function listRemote(col) { return ST.list(col); }
  var pulling = false, firstPullDone = false;
  var fpRes; window.CD_firstPull = new Promise(function (r) { fpRes = r; });
  async function pull() {
    if (pulling || !tok()) return;
    pulling = true;
    try {
      var todo = [], removed = {};
      for (var ci = 0; ci < COLS.length; ci++) {
        var col = COLS[ci], remote = await listRemote(col), seen = {};
        remote.forEach(function (it) {
          seen[it.id] = 1;
          var loc = mem[col][it.id];
          if (dirty[col + '/' + it.id]) return;
          if (!loc || loc.etag !== it.etag) todo.push({ col: col, it: it });
        });
        Object.keys(mem[col]).forEach(function (id) { if (!seen[id] && !dirty[col + '/' + id] && mem[col][id].etag) { delete mem[col][id]; idbDel('docs', col + '/' + id); removed[col] = 1; } });
      }
      var total = todo.length, done = 0, touched = {}, big = total > 20;
      if (big) showLoading('Loading your records from ' + SNAME() + '… 0 of ' + total);
      var idx = 0;
      async function worker() {
        while (idx < todo.length) {
          var w = todo[idx++];
          var data = await ST.read(w.col, w.it.id, w.it.itemId);
          if (!dirty[w.col + '/' + w.it.id]) { mem[w.col][w.it.id] = { data: data, etag: w.it.etag, itemId: w.it.itemId }; persistDoc(w.col, w.it.id); touched[w.col] = 1; }
          done++; if (big && done % 5 === 0) showLoading('Loading your records from ' + SNAME() + '… ' + done + ' of ' + total);
        }
      }
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      hideLoading();
      COLS.forEach(function (c) { if (touched[c] || removed[c]) notify(c); });
      if (!firstPullDone) {
        firstPullDone = true; fpRes();
      }
      st.offline = false; st.err = ''; st.last = Date.now();
    } catch (e) { hideLoading(); handleErr(e); fpRes(); }
    pulling = false; setState();
  }

  function showLoading(txt) {
    var o = $('mdLoad');
    if (!o) { o = document.createElement('div'); o.id = 'mdLoad'; o.style.cssText = 'position:fixed;inset:0;z-index:150;background:rgba(237,240,241,.96);display:flex;align-items:center;justify-content:center;font:16px system-ui,sans-serif;color:#101C26;text-align:center;padding:20px'; document.body.appendChild(o); }
    o.textContent = txt;
  }
  function hideLoading() { var o = $('mdLoad'); if (o) o.remove(); }

  /* ---------- Outlook calendar reminders (opt-in, 15 minutes before) ---------- */
  var CAL_MIN = 15, calBusy = false, calTimer = null, calAgain = false;
  function calOn() { return PROV === 'ms' && ls('cd.cal') === '1'; }
  function calDelList() { try { return JSON.parse(ls('cd.caldel') || '[]'); } catch (e) { return []; } }
  function setCalDel(a) { lset('cd.caldel', JSON.stringify(a)); }
  function calHash(a) { return JSON.stringify([a.who, a.type, a.date, a.time, a.dur, a.mode, a.where]); }
  function calWall(date, time, plusMin) {
    var d = date.split('-'), t = time.split(':');
    return new Date(Date.UTC(+d[0], +d[1] - 1, +d[2], +t[0], (+t[1] || 0) + plusMin)).toISOString().slice(0, 19);
  }
  function calBody(a) {
    return {
      subject: (TR().apptSubject || 'Appointment') + ': ' + (a.who || ''),
      start: { dateTime: calWall(a.date, a.time, 0), timeZone: 'Europe/London' },
      end: { dateTime: calWall(a.date, a.time, +a.dur || 30), timeZone: 'Europe/London' },
      location: { displayName: a.where || '' },
      body: { contentType: 'text', content: [a.type, a.mode].filter(Boolean).join(' · ') },
      isReminderOn: true, reminderMinutesBeforeStart: CAL_MIN, showAs: 'busy'
    };
  }
  function calSchedule(ms) { if (!calOn()) return; clearTimeout(calTimer); calTimer = setTimeout(calSync, ms == null ? 2000 : ms); }
  function calPerm() { var e = new Error('perm'); e.cal = true; return e; }
  async function calSync() {
    if (!calOn() || !tok() || st.offline) return;
    if (calBusy) { calAgain = true; return; }
    calBusy = true; var changed = false;
    try {
      var keep = [], dels = calDelList();
      for (var i = 0; i < dels.length; i++) {
        var rd = await gfetch('/me/events/' + encodeURIComponent(dels[i]), { method: 'DELETE' });
        if (rd.status === 401 || rd.status === 403) throw calPerm();
        if (!(rd.ok || rd.status === 404)) keep.push(dels[i]);
      }
      if (dels.length) setCalDel(keep);
      var y = new Date(Date.now() - 86400000), floor = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      var ids = Object.keys(mem.appointments);
      for (var j = 0; j < ids.length; j++) {
        var id = ids[j], rec = mem.appointments[id], a = rec && rec.data; if (!a) continue;
        var ref = collection('appointments').doc(id);
        var want = (a.status || 'booked') === 'booked' && a.date && a.time && a.date >= floor;
        if (!want) {
          if (a.calId) {
            var rx = await gfetch('/me/events/' + encodeURIComponent(a.calId), { method: 'DELETE' });
            if (rx.status === 401 || rx.status === 403) throw calPerm();
            if (rx.ok || rx.status === 404) { await ref.update({ calId: '', calH: '' }); changed = true; }
          }
          continue;
        }
        var h = calHash(a);
        if (a.calId && a.calH === h) continue;
        var r = null;
        if (a.calId) {
          r = await gfetch('/me/events/' + encodeURIComponent(a.calId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(calBody(a)) });
          if (r.status === 404) r = null;
        }
        if (!r) {
          var b = calBody(a); b.transactionId = id;
          r = await gfetch('/me/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
        }
        if (r.status === 401 || r.status === 403) throw calPerm();
        if (r.ok) { var jj = await r.json().catch(function () { return {}; }); await ref.update({ calId: jj.id || a.calId || '', calH: h }); changed = true; }
      }
    } catch (e) {
      if (e && e.cal) { lset('cd.cal', null); toast('Calendar reminders stopped: permission was not given. Turn them on again in Settings.'); }
    } finally {
      calBusy = false;
      if (changed || calAgain) { calAgain = false; calSchedule(3000); }
    }
  }

  /* ---------- PDF / CSV record backup ---------- */
  function bkStage(c) { var t = TR(), m = { lost: 'Closed lost' }; (t.stages || []).forEach(function (x) { m[x.id] = x.label; }); return m[c.stage] || c.stage || ''; }
  var BK_INV = { 'Spouse / partner': 'Spouse / partner', 'Parent': 'Child', 'Child': 'Parent', 'Grandparent': 'Grandchild', 'Grandchild': 'Grandparent', 'Sibling': 'Sibling', 'Other relative': 'Other relative', 'Friend': 'Friend', 'Colleague': 'Colleague', 'Business partner': 'Business partner', 'Employer': 'Employee', 'Employee': 'Employer', 'Referred by': 'Referred client', 'Referred client': 'Referred by', 'Other': 'Other' };
  var bkRunning = false, bkTimer = null;
  function bkCfg() { var c = {}; try { c = JSON.parse(ls('cd.bk') || '{}'); } catch (e) {} return Object.assign({ auto: true, last: 0, tried: 0, res: {} }, c); }
  function bkSave(c) { lset('cd.bk', JSON.stringify(c)); }
  function bkNames(c) { var a = (c.applicants || []).map(function (x) { return x.name; }).filter(Boolean); return a.length ? a.join(' & ') : 'Unnamed client'; }
  function bkDate(s) { if (!s) return ''; var p = String(s).split('-'); if (p.length !== 3) return String(s); var d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? String(s) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function bkTs(t) { return t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function bkGbp(n) { if (n == null || n === '') return ''; n = +n; return isNaN(n) ? '' : '£' + n.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }); }
  function bkCases() {
    var all = Object.keys(mem.cases).map(function (id) { var d = clone(mem.cases[id].data || {}); d.id = id; return d; });
    all.sort(function (a, b) { return String(a.clientNo || 'zzz').localeCompare(String(b.clientNo || 'zzz'), 'en', { numeric: true }) || bkNames(a).localeCompare(bkNames(b)); });
    return all;
  }
  function bkConn(c, all) {
    var out = [], seen = {};
    function add(o, rel) { if (!o || o.id === c.id) return; var k = bkNames(o).toLowerCase(); if (seen[k]) return; seen[k] = 1; out.push(bkNames(o) + ' (' + rel + ')'); }
    var by = {}; all.forEach(function (x) { by[x.id] = x; });
    (c.links || []).forEach(function (l) { add(by[l.cid], l.rel); });
    all.forEach(function (x) { (x.links || []).forEach(function (l) { if (l.cid === c.id) add(x, BK_INV[l.rel] || l.rel); }); });
    return out;
  }
  function bkCell(v) { if (v == null) return ''; if (typeof v === 'number') return String(v); v = String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
  function bkAuto(c, f) { var s = bkFv(c, f.auto.from); if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return ''; var p = s.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    if (f.auto.m) { var eom = f.auto.eom && d.getDate() === new Date(p[0], p[1], 0).getDate(), day = d.getDate(); d = new Date(p[0], p[1] - 1 + f.auto.m, 1); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(eom ? last : Math.min(day, last)); }
    if (f.auto.d) d.setDate(d.getDate() + f.auto.d);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function bkFv(c, k) { var v = c[k]; if (v !== '' && v != null) return v; var f = (TR().byKey || {})[k]; return f && f.auto ? bkAuto(c, f) : ''; }
  function bkFmt(c, f) { var v = bkFv(c, f.k); if (v === '' || v == null) return ''; if (f.t === 'money') return bkGbp(v); if (f.t === 'date') return bkDate(v); if (f.t === 'sel') { var o = (f.o || []).filter(function (x) { return Array.isArray(x) && x[0] === v; })[0]; return o ? o[1] : String(v); } return String(v); }
  function bkLabel(f) { return f.l.replace(/\s*\((?=[^)]*\s)[^)]*\)$/, ''); }
  function bkTasks(c, openOnly) { return (c.tasks || []).filter(function (t) { return !openOnly || !t.done; }).map(function (t) { return (t.done ? '[done] ' : '') + (t.pri ? '[high] ' : '') + (t.text || '') + (t.due ? ' (due ' + bkDate(t.due) + (t.time ? ' ' + t.time : '') + ')' : ''); }); }
  function bkLog(arr) { return (arr || []).slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).map(function (n) { return bkTs(n.ts) + ': ' + String(n.text || '').replace(/\s+/g, ' ').trim(); }); }
  function bkCsv(all) {
    function q(v) { return '"' + bkCell(v).replace(/"/g, '""') + '"'; }
    var t = TR(), fl = t.fields || [], xl = t.extraLog;
    var head = ['client number', 'names', 'dates of birth', 'phones', 'emails', 'addresses', 'stage', 'type'].concat(fl.map(bkLabel)).concat(t.securities ? ['other security addresses'] : []).concat(['connected clients', 'open tasks', 'notes', 'quotes and invoices', 'tenancies']).concat(xl ? [xl.title.toLowerCase()] : []).concat(['OneDrive folder']);
    var rows = [head.map(q).join(',')];
    all.forEach(function (c) {
      var ap = c.applicants || [];
      var r = [c.clientNo, bkNames(c), ap.map(function (a) { return a.dob ? bkDate(a.dob) : ''; }).join(' | '), ap.map(function (a) { return a.phone || ''; }).join(' | '), ap.map(function (a) { return a.email || ''; }).join(' | '), ap.map(function (a) { return a.address || ''; }).join(' | '),
        bkStage(c), c.type].concat(fl.map(function (f) { return bkFmt(c, f); }))
        .concat(t.securities ? [(c.securities || []).map(function (s) { return s.address || ''; }).filter(Boolean).join(' | ')] : [])
        .concat([bkConn(c, all).join('; '), bkTasks(c, true).join(' | '), bkLog(c.notes).join(' | '), (c.docs || []).map(function (d) { return (d.kind === 'quote' ? 'Quote ' : 'Invoice ') + (d.number || '') + ' ' + bkGbp(d.total) + ' ' + (d.status || 'draft'); }).join(' | '), (c.tenancies || []).map(function (tn) { return ((tn.status || 'current') === 'ended' ? '[past] ' : '') + (tn.people || []).map(function (p) { return p.name; }).filter(Boolean).join(' & ') + (tn.rent ? ' ' + bkGbp(tn.rent) + ' ' + (tn.rentFreq || '') : '') + (tn.tenancyStart ? ' from ' + bkDate(tn.tenancyStart) : ''); }).join(' | ')]).concat(xl ? [bkLog(c.protection).join(' | ')] : []).concat([c.oneDriveLink]);
      rows.push(r.map(q).join(','));
    });
    return '\ufeff' + rows.join('\r\n') + '\r\n';
  }
  /* minimal PDF writer: text only, Helvetica, A4 */
  function pdfStr(s) {
    var o = '';
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), t;
      if (c === 0x2013 || c === 0x2014 || c === 0x2212) t = '-';
      else if (c === 0x2018 || c === 0x2019) t = "'";
      else if (c === 0x201c || c === 0x201d) t = '"';
      else if (c === 0x2026) t = '...';
      else if (c === 0x20ac) t = '\\200';
      else if (c === 0x2022) t = '\\225';
      else if (c === 0x28 || c === 0x29 || c === 0x5c) t = '\\' + s.charAt(i);
      else if (c < 32) t = ' ';
      else if (c > 126 && c < 256) t = '\\' + ('00' + c.toString(8)).slice(-3);
      else if (c > 255) t = '?';
      else t = s.charAt(i);
      o += t;
    }
    return o;
  }
  function pdfWrap(text, max) {
    var out = [], words = String(text == null ? '' : text).split(/\s+/), line = '';
    words.forEach(function (w) {
      while (w.length > max) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, max)); w = w.slice(max); }
      if (!line) line = w; else if ((line + ' ' + w).length <= max) line += ' ' + w; else { out.push(line); line = w; }
    });
    if (line || !out.length) out.push(line);
    return out;
  }
  function pdfBuild(items, footer, pw) {
    var W = 595, H = 842, ML = 42, TOP = 800, BOT = 54, pages = [[]], y = TOP;
    function newPage() { pages.push([]); y = TOP; }
    items.forEach(function (it) {
      if (it.pb) { if (pages[pages.length - 1].length) newPage(); return; }
      var sz = it.sz || 9, lh = Math.round(sz * 1.38 * 10) / 10, ind = it.ind || 0;
      var max = Math.floor((W - 2 * ML - ind) / (sz * (it.b ? 0.58 : 0.53)));
      pdfWrap(it.t, max).forEach(function (ln, k) {
        if (y - lh < BOT) newPage();
        pages[pages.length - 1].push({ t: ln, x: ML + ind + (k && it.hang ? it.hang : 0), y: y, b: it.b, sz: sz });
        y -= lh;
      });
      y -= it.gap || 0;
    });
    var out = '%PDF-1.4\n', offs = [], n = pages.length, enc = pw ? pdfEncInit(pw) : null;
    function obj(i, body) { offs[i] = out.length; out += i + ' 0 obj\n' + body + '\nendobj\n'; }
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    var kids = pages.map(function (p, i) { return (5 + 2 * i) + ' 0 R'; }).join(' ');
    obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    pages.forEach(function (p, i) {
      var cs = '';
      p.forEach(function (l) { cs += 'BT /' + (l.b ? 'F2' : 'F1') + ' ' + l.sz + ' Tf 1 0 0 1 ' + l.x + ' ' + l.y.toFixed(1) + ' Tm (' + pdfStr(l.t) + ') Tj ET\n'; });
      cs += 'BT /F1 8 Tf 1 0 0 1 ' + ML + ' 30 Tm (' + pdfStr(footer + '  |  page ' + (i + 1) + ' of ' + n) + ') Tj ET\n';
      obj(5 + 2 * i, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + 2 * i) + ' 0 R >>');
      if (enc) { var eb = pdfObjEnc(enc, 6 + 2 * i, strB(cs)), es = ''; for (var q = 0; q < eb.length; q++) es += String.fromCharCode(eb[q]); cs = es; }
      obj(6 + 2 * i, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    });
    var total = 5 + 2 * n;
    if (enc) { obj(total, '<< /Filter /Standard /V 4 /R 4 /Length 128 /CF << /StdCF << /CFM /AESV2 /AuthEvent /DocOpen /Length 16 >> >> /StmF /StdCF /StrF /StdCF /O <' + enc.O + '> /U <' + enc.U + '> /P -4 >>'); total++; }
    var xref = out.length;
    out += 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var k = 1; k < total; k++) out += ('0000000000' + offs[k]).slice(-10) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + total + ' /Root 1 0 R' + (enc ? ' /Encrypt ' + (total - 1) + ' 0 R /ID [<' + enc.id + '><' + enc.id + '>]' : '') + ' >>\nstartxref\n' + xref + '\n%%EOF\n';
    var u = new Uint8Array(out.length); for (var m = 0; m < out.length; m++) u[m] = out.charCodeAt(m) & 255;
    return u;
  }
  /* ---------- password protection for backups: AES, MD5, RC4, encrypted PDF, AES-256 ZIP ---------- */
  var AES_S = null;
  function aesInit() {
    if (AES_S) return;
    var s = new Uint8Array(256), p = 1, q = 1, rot = function (x, n) { return ((x << n) | (x >> (8 - n))) & 255; };
    do {
      p = (p ^ (p << 1) ^ ((p & 0x80) ? 0x11b : 0)) & 255;
      q ^= q << 1; q &= 255; q ^= q << 2; q &= 255; q ^= q << 4; q &= 255; if (q & 0x80) q ^= 0x09;
      s[p] = (q ^ rot(q, 1) ^ rot(q, 2) ^ rot(q, 3) ^ rot(q, 4) ^ 0x63) & 255;
    } while (p !== 1);
    s[0] = 0x63; AES_S = s;
  }
  function aesKey(key) {
    aesInit();
    var nk = key.length / 4, nr = nk + 6, w = new Uint8Array(16 * (nr + 1)), i, t = new Uint8Array(4), rc = 1, k;
    w.set(key);
    for (i = nk; i < 4 * (nr + 1); i++) {
      t[0] = w[4 * i - 4]; t[1] = w[4 * i - 3]; t[2] = w[4 * i - 2]; t[3] = w[4 * i - 1];
      if (i % nk === 0) {
        var x = t[0]; t[0] = AES_S[t[1]] ^ rc; t[1] = AES_S[t[2]]; t[2] = AES_S[t[3]]; t[3] = AES_S[x];
        rc = ((rc << 1) ^ ((rc & 0x80) ? 0x11b : 0)) & 255;
      } else if (nk > 6 && i % nk === 4) { t[0] = AES_S[t[0]]; t[1] = AES_S[t[1]]; t[2] = AES_S[t[2]]; t[3] = AES_S[t[3]]; }
      for (k = 0; k < 4; k++) w[4 * i + k] = w[4 * (i - nk) + k] ^ t[k];
    }
    return { w: w, nr: nr };
  }
  function aesBlock(K, inp) {
    var s = new Uint8Array(16), t = new Uint8Array(16), r, i, xt = function (x) { return ((x << 1) ^ ((x & 0x80) ? 0x1b : 0)) & 255; };
    for (i = 0; i < 16; i++) s[i] = inp[i] ^ K.w[i];
    for (r = 1; r <= K.nr; r++) {
      for (i = 0; i < 16; i++) t[i] = AES_S[s[i]];
      s[0] = t[0]; s[1] = t[5]; s[2] = t[10]; s[3] = t[15]; s[4] = t[4]; s[5] = t[9]; s[6] = t[14]; s[7] = t[3];
      s[8] = t[8]; s[9] = t[13]; s[10] = t[2]; s[11] = t[7]; s[12] = t[12]; s[13] = t[1]; s[14] = t[6]; s[15] = t[11];
      if (r < K.nr) {
        for (i = 0; i < 16; i += 4) {
          var a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3], x = a0 ^ a1 ^ a2 ^ a3;
          s[i] = a0 ^ x ^ xt(a0 ^ a1); s[i + 1] = a1 ^ x ^ xt(a1 ^ a2); s[i + 2] = a2 ^ x ^ xt(a2 ^ a3); s[i + 3] = a3 ^ x ^ xt(a3 ^ a0);
        }
      }
      for (i = 0; i < 16; i++) s[i] ^= K.w[16 * r + i];
    }
    return s;
  }
  function aesCbcPad(keyBytes, data) {
    var K = aesKey(keyBytes), iv = crypto.getRandomValues(new Uint8Array(16)), n = data.length, pad = 16 - (n % 16), tot = n + pad;
    var out = new Uint8Array(16 + tot), prev = iv, blk = new Uint8Array(16), i, j;
    out.set(iv);
    for (i = 0; i < tot; i += 16) {
      for (j = 0; j < 16; j++) blk[j] = (i + j < n ? data[i + j] : pad) ^ prev[j];
      prev = aesBlock(K, blk); out.set(prev, 16 + i);
    }
    return out;
  }
  function aesCtrLE(keyBytes, data) {
    var K = aesKey(keyBytes), out = new Uint8Array(data.length), ctr = new Uint8Array(16), i, j, ks;
    for (i = 0; i < data.length; i += 16) {
      for (j = 0; j < 16; j++) { ctr[j] = (ctr[j] + 1) & 255; if (ctr[j]) break; }
      ks = aesBlock(K, ctr);
      for (j = 0; j < 16 && i + j < data.length; j++) out[i + j] = data[i + j] ^ ks[j];
    }
    return out;
  }
  function md5(b) {
    var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21], K = [], i, j;
    for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    var n = b.length, tot = (((n + 8) >> 6) + 1) * 64, m = new Uint8Array(tot);
    m.set(b); m[n] = 0x80;
    var bl = n * 8; m[tot - 8] = bl & 255; m[tot - 7] = (bl >>> 8) & 255; m[tot - 6] = (bl >>> 16) & 255; m[tot - 5] = (bl >>> 24) & 255;
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (var o = 0; o < tot; o += 64) {
      var M = [];
      for (i = 0; i < 16; i++) M[i] = m[o + 4 * i] | (m[o + 4 * i + 1] << 8) | (m[o + 4 * i + 2] << 16) | (m[o + 4 * i + 3] << 24);
      var A = a0, B = b0, C = c0, D = d0, F, g;
      for (i = 0; i < 64; i++) {
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) | 0; A = D; D = C; C = B; B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    var out = new Uint8Array(16), v = [a0, b0, c0, d0];
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) out[4 * i + j] = (v[i] >>> (8 * j)) & 255;
    return out;
  }
  function rc4(key, data) {
    var s = [], i, j = 0, t, out = new Uint8Array(data.length);
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; }
    i = 0; j = 0;
    for (var k = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; out[k] = data[k] ^ s[(s[i] + s[j]) & 255]; }
    return out;
  }
  var PDF_PAD = [0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A];
  function catB() { var n = 0, i, k = 0, a; for (i = 0; i < arguments.length; i++) n += arguments[i].length; a = new Uint8Array(n); for (i = 0; i < arguments.length; i++) { a.set(arguments[i], k); k += arguments[i].length; } return a; }
  function hexB(u) { var h = ''; for (var i = 0; i < u.length; i++) h += ('0' + u[i].toString(16)).slice(-2); return h; }
  function strB(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
  function pdfEncInit(pw) {
    var pb = strB(String(pw)).slice(0, 32), pad = new Uint8Array(32), i, r;
    pad.set(pb); pad.set(PDF_PAD.slice(0, 32 - pb.length), pb.length);
    var h = md5(pad); for (i = 0; i < 50; i++) h = md5(h);
    var ok = h.slice(0, 16), O = rc4(ok, pad);
    for (i = 1; i <= 19; i++) { var kk = ok.map(function (x) { return x ^ i; }); O = rc4(kk, O); }
    var P = new Uint8Array([0xFC, 0xFF, 0xFF, 0xFF]), id = crypto.getRandomValues(new Uint8Array(16));
    var key = md5(catB(pad, O, P, id)); for (i = 0; i < 50; i++) key = md5(key.slice(0, 16)); key = key.slice(0, 16);
    var U = rc4(key, md5(catB(new Uint8Array(PDF_PAD), id)));
    for (i = 1; i <= 19; i++) { var k2 = key.map(function (x) { return x ^ i; }); U = rc4(k2, U); }
    U = catB(U, new Uint8Array(16));
    return { key: key, O: hexB(O), U: hexB(U), id: hexB(id) };
  }
  function pdfObjEnc(enc, num, bytes) {
    var k = md5(catB(enc.key, new Uint8Array([num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0]), strB('sAlT')));
    return aesCbcPad(k.slice(0, 16), bytes);
  }
  var CRC_T = null;
  function crc32(b) {
    if (!CRC_T) { CRC_T = []; for (var n = 0, c; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
    var c2 = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c2 = CRC_T[(c2 ^ b[i]) & 255] ^ (c2 >>> 8);
    return (c2 ^ 0xFFFFFFFF) >>> 0;
  }
  async function zipAesEntry(pw, data) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), pk = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    var km = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 1000, hash: 'SHA-1' }, pk, 528));
    var ek = km.slice(0, 32), hk = km.slice(32, 64), pv = km.slice(64, 66), ct = aesCtrLE(ek, data);
    var hm = await crypto.subtle.importKey('raw', hk, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    var mac = new Uint8Array(await crypto.subtle.sign('HMAC', hm, ct)).slice(0, 10);
    return catB(salt, pv, ct, mac);
  }
  async function bkZip(entries, pw) {
    var now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    var parts = [], central = [], off = 0;
    var u16 = function (v) { return new Uint8Array([v & 255, (v >> 8) & 255]); }, u32 = function (v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); };
    var extra = catB(u16(0x9901), u16(7), u16(2), strB('AE'), new Uint8Array([3]), u16(0));
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i], nm = strB(e.name), body = await zipAesEntry(pw, e.data);
      var lh = catB(u32(0x04034b50), u16(51), u16(0x0801), u16(99), u16(dt), u16(dd), u32(0), u32(body.length), u32(e.data.length), u16(nm.length), u16(extra.length), nm, extra);
      parts.push(lh, body);
      central.push(catB(u32(0x02014b50), u16(51), u16(51), u16(0x0801), u16(99), u16(dt), u16(dd), u32(0), u32(body.length), u32(e.data.length), u16(nm.length), u16(extra.length), u16(0), u16(0), u16(0), u32(0), u32(off), nm, extra));
      off += lh.length + body.length;
    }
    var cd = catB.apply(null, central), end = catB(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(off), u16(0));
    return catB.apply(null, parts.concat([cd, end]));
  }

  function bkPw() { return ls('cd.bkpw') || ''; }
  function waNorm(v) {
    var d = String(v || '').replace(/[^\d+]/g, ''), plus = d.charAt(0) === '+'; d = d.replace(/\D/g, '');
    if (!plus && d.indexOf('00') === 0) d = d.slice(2); else if (!plus && d.charAt(0) === '0') d = '44' + d.slice(1);
    return d.length >= 10 && d.length <= 15 ? d : '';
  }
  function waShow(n) { return n.length > 6 ? n.slice(0, 4) + '\u2022\u2022\u2022\u2022\u2022' + n.slice(-3) : n; }
  function bkPdf(all, stamp, pw) {
    var it = [];
    it.push({ t: '' + APPN + ' - record backup', b: 1, sz: 18, gap: 6 });
    it.push({ t: 'Created ' + stamp + '. ' + all.length + ' case' + (all.length === 1 ? '' : 's') + '.', sz: 10, gap: 10 });
    it.push({ t: 'Contents', b: 1, sz: 11, gap: 2 });
    all.forEach(function (c) { it.push({ t: (c.clientNo || '-') + '   ' + bkNames(c) + '   (' + (bkStage(c) || '') + (c.type ? ', ' + c.type : '') + ')', sz: 9 }); });
    all.forEach(function (c) {
      var ap = c.applicants || [];
      it.push({ pb: 1 });
      it.push({ t: (c.clientNo ? c.clientNo + '   ' : '') + bkNames(c), b: 1, sz: 14, gap: 2 });
      it.push({ t: [bkStage(c), c.type, c.repayment].filter(Boolean).join('  |  '), sz: 10, gap: 6 });
      it.push({ t: (TR().person || ['', 'People'])[1], b: 1, sz: 10.5, gap: 1 });
      ap.forEach(function (a, i) {
        it.push({ t: (i + 1) + '. ' + (a.name || '') + (a.dob ? '   DOB ' + bkDate(a.dob) : ''), ind: 6 });
        var ct = [a.phone, a.email].filter(Boolean).join('   '); if (ct) it.push({ t: ct, ind: 16 });
        if (a.address) it.push({ t: 'Address: ' + a.address, ind: 16 });
      });
      var conn = bkConn(c, all);
      it.push({ t: 'Connected clients', b: 1, sz: 10.5, gap: 1 }); it.push({ t: conn.length ? conn.join('; ') : 'None', ind: 6 });
      var tt = TR();
      (tt.sections || []).forEach(function (sec) {
        var rows = sec.fields.map(function (f) { var v = bkFmt(c, f); return v ? bkLabel(f) + ': ' + v : ''; }).filter(Boolean);
        if (!rows.length) return; it.push({ t: sec.title, b: 1, sz: 10.5, gap: 1 }); rows.forEach(function (r) { it.push({ t: r, ind: 6 }); });
      });
      if ((c.securities || []).length) { it.push({ t: 'Security addresses', b: 1, sz: 10.5, gap: 1 }); }
      (c.securities || []).forEach(function (s, i) { if (s.address) it.push({ t: 'Security ' + (i + 1) + ': ' + s.address + (s.lender ? '  |  ' + s.lender : '') + (s.product ? '  |  ' + s.product : '') + (s.loanAmount ? '  |  ' + bkGbp(s.loanAmount) : '') + (s.fixedUntil ? '  |  deal ends ' + bkDate(s.fixedUntil) : ''), ind: 6 }); });
      if ((c.tenancies || []).length) { it.push({ t: 'Tenants', b: 1, sz: 10.5, gap: 1 }); c.tenancies.forEach(function (tn) { var nm = (tn.people || []).map(function (p) { return [p.name, p.phone, p.email].filter(Boolean).join(', '); }).join('; '); it.push({ t: ((tn.status || 'current') === 'ended' ? '[past] ' : '') + nm + (tn.rent ? '  |  rent ' + bkGbp(tn.rent) + ' ' + (tn.rentFreq || '') : '') + (tn.tenancyStart ? '  |  from ' + bkDate(tn.tenancyStart) : '') + (tn.moveOut ? ' to ' + bkDate(tn.moveOut) : '') + (tn.deposit ? '  |  deposit ' + bkGbp(tn.deposit) + (tn.depositScheme ? ' (' + tn.depositScheme + ')' : '') : ''), ind: 6 }); }); }
      var dcs = (c.docs || []).map(function (d) { return (d.kind === 'quote' ? 'Quote ' : 'Invoice ') + (d.number || '') + '  |  ' + bkDate(d.date) + '  |  ' + bkGbp(d.total) + '  |  ' + (d.status || 'draft') + (d.paidDate ? ' ' + bkDate(d.paidDate) : ''); });
      if (dcs.length) { it.push({ t: 'Quotes and invoices', b: 1, sz: 10.5, gap: 1 }); dcs.forEach(function (t) { it.push({ t: t, ind: 6 }); }); }
      var ts = bkTasks(c, false);
      it.push({ t: 'Tasks', b: 1, sz: 10.5, gap: 1 }); if (!ts.length) it.push({ t: 'None', ind: 6 }); ts.forEach(function (t) { it.push({ t: '- ' + t, ind: 6, hang: 8 }); });
      var ns = bkLog(c.notes);
      it.push({ t: 'Notes', b: 1, sz: 10.5, gap: 1 }); if (!ns.length) it.push({ t: 'None', ind: 6 }); ns.forEach(function (t) { it.push({ t: t, ind: 6, gap: 2 }); });
      var ps = bkLog(c.protection);
      if (tt.extraLog || ps.length) { it.push({ t: (tt.extraLog || { title: 'Extra notes' }).title, b: 1, sz: 10.5, gap: 1 }); if (!ps.length) it.push({ t: 'None', ind: 6 }); ps.forEach(function (t) { it.push({ t: t, ind: 6, gap: 2 }); }); }
    });
    return pdfBuild(it, '' + APPN + ' backup ' + stamp, pw);
  }
  function bkIdb() { return new Promise(function (res) { try { var q = indexedDB.open('cd-bk', 1); q.onupgradeneeded = function () { q.result.createObjectStore('h'); }; q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  var bkDirMem = {};
  var BK_FILE = APPF + '-Backup.zip';
  async function bkGetDir(slot) {
    if (bkDirMem[slot]) return bkDirMem[slot]; var d = await bkIdb(); if (!d) return null;
    return new Promise(function (res) { try { var r = d.transaction('h').objectStore('h').get(slot); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } });
  }
  async function bkPutDir(slot, h) {
    if (h) bkDirMem[slot] = h; else delete bkDirMem[slot];
    var d = await bkIdb(); if (!d) return;
    return new Promise(function (res) { try { var t = d.transaction('h', 'readwrite'); if (h) t.objectStore('h').put(h, slot); else t.objectStore('h').delete(slot); t.oncomplete = function () { res(); }; t.onerror = function () { res(); }; } catch (e) { res(); } });
  }
  function bkCanPick() { return typeof window.showDirectoryPicker === 'function'; }
  async function bkPerm(slot, interactive) {
    var h = await bkGetDir(slot); if (!h) return { none: true };
    var p = 'prompt'; try { p = await h.queryPermission({ mode: 'readwrite' }); } catch (e) {}
    if (p !== 'granted') {
      if (!interactive) return { ok: false, msg: 'Needs your permission. Open PDF/CSV Case Backup and press Back up now.' };
      try { p = await h.requestPermission({ mode: 'readwrite' }); } catch (e) { p = 'denied'; }
      if (p !== 'granted') return { ok: false, msg: 'Permission to the folder was not given.' };
    }
    return { ok: true, h: h };
  }
  async function bkWrite(g, blob) {
    if (!g || g.none) return null; if (!g.ok) return g;
    try { var fh = await g.h.getFileHandle(BK_FILE, { create: true }); var w = await fh.createWritable(); await w.write(blob); await w.close(); return { ok: true, msg: 'Saved in ' + g.h.name }; }
    catch (e) { return { ok: false, msg: 'Could not write to the folder (' + (e && e.name || 'error') + ').' }; }
  }
  async function bkRun(interactive) {
    if (bkRunning) return null;
    if (!bkPw()) return { nopw: true };
    var pick = bkCanPick(), g1 = null, g2 = null;
    if (pick) {
      g1 = await bkPerm('dir', interactive); g2 = await bkPerm('dir2', interactive);
      if (g1.none && g2.none) return { nofolder: true };
    } else if (!interactive) return { nofolder: true };
    bkRunning = true;
    try {
      var all = bkCases(), d = new Date(), pad = function (n) { return ('0' + n).slice(-2); };
      var day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      var stamp = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      var pw = bkPw();
      var zipBytes = await bkZip([
        { name: APPF + '-' + TR().noun[1] + '-' + day + '.pdf', data: bkPdf(all, stamp, pw) },
        { name: APPF + '-' + TR().noun[1] + '-' + day + '.csv', data: new TextEncoder().encode(bkCsv(all)) }
      ], pw);
      var blob = new Blob([zipBytes], { type: 'application/zip' });
      var res = { at: Date.now(), count: all.length };
      if (pick) { res.l1 = await bkWrite(g1, blob); res.l2 = await bkWrite(g2, blob); }
      else {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = BK_FILE; document.body.appendChild(a); a.click();
        await sleep(400); a.remove(); (function (u) { setTimeout(function () { URL.revokeObjectURL(u); }, 20000); })(a.href);
        res.l1 = { ok: true, msg: 'Downloaded to this device (check your Downloads).' };
      }
      var cfg = bkCfg(); cfg.tried = Date.now();
      var bad = [res.l1, res.l2].some(function (x) { return x && !x.ok; });
      if (!bad) cfg.last = Date.now();
      cfg.res = res; bkSave(cfg);
      return res;
    } finally { bkRunning = false; }
  }
  function bkTick() {
    var cfg = bkCfg();
    if (!cfg.auto || !bkPw() || !tok() || !Object.keys(mem.cases).length) return;
    var now = Date.now();
    if (now - cfg.last < 86400000) return;
    if (now - cfg.tried < 3600000) return;
    bkRun(false).then(function () { var m = $('bkMsg'); if (m) bkPaint(); }).catch(function () {});
  }
  function bkStart() { setTimeout(bkTick, 20000); clearInterval(bkTimer); bkTimer = setInterval(bkTick, 600000); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(bkTick, 3000); }); }
  function bkPaint() {
    var cfg = bkCfg(), el = $('bkStatus'); if (!el) return;
    var r = cfg.res || {}, f = function (d) { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }, h = '';
    h += cfg.last ? 'Last successful backup: ' + f(cfg.last) + '.' : 'No backup yet.';
    if (r.at) {
      h += '<br>Last attempt ' + f(r.at) + ' (' + (r.count || 0) + ' records):';
      if (r.l1) h += '<br>' + (r.l1.ok ? '\u2713' : '\u2717') + ' Location 1: ' + esc(r.l1.msg);
      if (r.l2) h += '<br>' + (r.l2.ok ? '\u2713' : '\u2717') + ' Location 2: ' + esc(r.l2.msg);
    }
    el.innerHTML = h;
  }
  function reFresh() { return Date.now() - (+ls('cd.reauthOk') || 0) < 600000; }
  window.CD_reFresh = function () { return reFresh(); };
  window.CD_reGate = function (n) { return reGate(n); };
  function reGate(next) {
    if (reFresh()) return true;
    if (PROV === 'google') { pwGate(next); return false; }
    if (confirm('To change this, Microsoft will ask for your account password again to confirm it is you. Continue?')) { lset('cd.reauth', '1'); lset('cd.reauthNext', next); startLogin(true); }
    return false;
  }
  function profGet() { try { return JSON.parse(ls('cd.profile') || '{}') || {}; } catch (e) { return {}; } }
  function waNum() { return profGet().phone || ls('cd.bkwa') || ''; }
  function openProfile(setup) {
    if (setup !== true) setup = false;
    var ov = document.createElement('div'); ov.id = 'mdProf';
    ov.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(ov);
    var inp = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #D4DBDF;border-radius:8px;font:inherit;margin:4px 0 10px';
    function draw(msg) {
      var p = profGet();
      if (setup && !p.name && mem.settings.profile && mem.settings.profile.data) { var sp = mem.settings.profile.data; p = { name: sp.name || '', role: sp.role || '', biz: sp.biz || '', reg: sp.reg || '', phone: '', email: sp.email || '' }; p._ph = sp.phone || ''; }
      var ph = p.phone || p._ph || ls('cd.bkwa') || '', acc = (tok() || {}).account || {}, lk = !setup && !!(p.name || p.phone || p.biz || p.email) && !reFresh(), dis = lk ? ' disabled' : '', needPw = !pinData();
      ov.innerHTML = '<div style="background:#fff;color:#101C26;width:min(520px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:22px 24px;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,28,38,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:20px">' + (setup ? 'Create your profile' : 'My profile') + '</h2>' + '<button class="btn ghost" data-p="close">Close</button></div>' +
        (setup ? '<p style="margin:12px 0 0;padding:8px 10px;background:#EAF4EF;border-radius:8px;font-size:13px">' + (p._ph ? 'Welcome back. Your details were copied from your other device. Choose an app password for <b>this</b> device (it can be the same as your other one).' : 'Welcome. Add your name, mobile number and email, and choose a strong password. The password locks the app when you are away from it.') + '</p>' : '') +
        '<p id="prTop" role="alert" style="display:none;margin:12px 0 0;padding:8px 10px;background:#fdecea;color:#b3261e;border-radius:8px;font-size:13.5px;font-weight:600"></p>' +
        '<p style="margin:12px 0;color:#58697A;font-size:13px">Your own details. They stay on this device. They sign your marketing and birthday messages, and your mobile number is used to send you your backup password on WhatsApp.</p>' +
        (lk ? '<p style="margin:0 0 10px;padding:8px 10px;background:#FFF6DD;border-radius:8px;font-size:13px">Your profile is locked. To change anything, confirm with your Microsoft account password.</p><button class="btn" data-p="unlock" style="margin-bottom:12px">Unlock to edit</button>' : '') + '<label>Your name <span style="color:#b3261e">*</span></label><input id="prName"' + dis + ' type="text" maxlength="80" value="' + esc(p.name || '') + '" style="' + inp + '">' +
        '<label>Job title or role (for example Gas Safe registered engineer)</label><input id="prRole"' + dis + ' type="text" maxlength="80" value="' + esc(p.role || '') + '" placeholder="' + esc(TR().label || '') + '" style="' + inp + '">' +
        '<label>Business name</label><input id="prBiz"' + dis + ' type="text" maxlength="80" value="' + esc(p.biz || '') + '" style="' + inp + '">' +
        '<label>Registration (optional, for example Gas Safe 123456, NICEIC, ARB, SRA or FCA number)</label><input id="prReg"' + dis + ' type="text" maxlength="80" value="' + esc(p.reg || '') + '" style="' + inp + '">' +
        '<label>Mobile number (WhatsApp) <span style="color:#b3261e">*</span></label>' + (p.phone
          ? '<div style="display:flex;gap:8px;align-items:center;margin:4px 0 10px"><input type="text" disabled value="+' + esc(waShow(p.phone)) + '" style="flex:1;padding:8px 10px;border:1px solid #D4DBDF;border-radius:8px;font:inherit;background:#EDF0F1"><button class="btn ghost" data-p="chg"' + dis + '>Change number</button></div><div id="prChg"></div>'
          : '<input id="prPhone" type="tel" placeholder="e.g. 07700 900123" value="' + esc(ph) + '" style="' + inp + '"><p style="margin:-6px 0 10px;color:#58697A;font-size:12px">Once saved, the number is locked. Changing it later needs your Microsoft account password.</p>') +
        '<label>Email address <span style="color:#b3261e">*</span></label><input id="prMail"' + dis + ' type="email" maxlength="120" value="' + esc(p.email || acc.mail || '') + '" style="' + inp + '">' +
        (needPw ? '<label>App password <span style="color:#b3261e">*</span></label><input id="prPw" type="password" autocomplete="new-password" maxlength="128" style="' + inp + '"><div id="prPwChk" style="margin-top:-6px">' + pwList('', p) + '</div><label>Repeat password <span style="color:#b3261e">*</span></label><input id="prPw2" type="password" autocomplete="new-password" maxlength="128" style="' + inp + '">'
          : '<p style="margin:0 0 10px;font-size:13px"><b>App password:</b> set. <a href="#" data-p="pw">Change password</a></p>') +
        '<p style="margin:4px 0 10px;font-size:13px"><a href="#" data-p="biz"><b>Business details, logo and invoice settings</b></a>: your business address, logo, VAT number and how customers pay you, shown on quotes and invoices.</p>' +
        (setup ? '' : '<p style="margin:4px 0 10px;font-size:13px"></p>') + '<button class="btn" data-p="save"' + dis + '>' + (setup ? 'Create profile' : 'Save profile') + '</button><p id="prMsg" style="min-height:18px;margin:10px 0 0;color:#b3261e">' + esc(msg || '') + '</p></div>';
    }
    draw();
    /* show problems at the top and at the button, and jump to the field, so they are visible above a phone keyboard */
    var say = function (m, fid) {
      var e = $('prMsg'); if (e) e.textContent = m;
      var t = $('prTop'); if (t) { t.textContent = m; t.style.display = m ? 'block' : 'none'; }
      ov.querySelectorAll('input').forEach(function (i) { i.style.borderColor = ''; });
      var f = fid && $(fid), fe = $('prFieldErr'); if (fe) fe.remove();
      if (f && m) { f.style.borderColor = '#b3261e'; fe = document.createElement('div'); fe.id = 'prFieldErr'; fe.setAttribute('role', 'alert'); fe.style.cssText = 'margin:-6px 0 10px;color:#b3261e;font-size:13px;font-weight:600'; fe.textContent = m; f.parentNode.insertBefore(fe, f.nextSibling); try { f.focus({ preventScroll: true }); } catch (x) {} f.scrollIntoView({ block: 'center' }); }
      else if (t && m) t.scrollIntoView({ block: 'start' });
    };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov && !setup) ov.remove(); });
    ov.addEventListener('input', function (e) { if (e.target.id === 'prPw' || e.target.id === 'prName' || e.target.id === 'prMail') { var c = $('prPwChk'), pw = $('prPw'); if (c && pw) c.innerHTML = pwList(pw.value, { name: ($('prName') || {}).value, email: ($('prMail') || {}).value }); } });
    ov.addEventListener('click', async function (e) {
      var b = e.target.closest && e.target.closest('[data-p]'); if (!b) return; b = b.getAttribute('data-p');
      var p = profGet();
      if (b === 'close') { ov.remove(); if (setup) { setupSkipped = true; toast('Profile not finished. The app has no password lock until you finish it in Settings > My profile.'); } }
      else if (b === 'biz') { e.preventDefault(); if (setup) { say('Create your profile first.'); return; } ov.remove(); if (window.CD_openBiz) window.CD_openBiz(); }
      else if (b === 'pw') { e.preventDefault(); ov.remove(); openPin(); }
      else if (b === 'unlock') { reGate('profile'); }
      else if (b === 'save') {
        if (!setup && (p.name || p.phone || p.biz || p.email) && !reGate('profile')) return;
        var nm = (($('prName') || {}).value || '').trim(), mail = (($('prMail') || {}).value || '').trim();
        if (!nm) { say('Add your name.', 'prName'); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { say(mail ? 'That email address does not look right.' : 'Add your email address.', 'prMail'); return; }
        var ph = p.phone || '';
        if (!ph) { var raw = (($('prPhone') || {}).value || '').trim(); if (!raw) { say('Add your mobile number.', 'prPhone'); return; } ph = waNorm(raw); if (!ph) { say('That does not look like a phone number. Use the full number, for example 07700 900123.', 'prPhone'); return; } }
        if (!pinData()) {
          var pw1 = (($('prPw') || {}).value || ''), pw2 = (($('prPw2') || {}).value || '');
          if (!pwOk(pw1, { name: nm, email: mail })) { var miss = pwRules(pw1, { name: nm, email: mail }).filter(function (r) { return !r[0]; }).map(function (r) { return r[1].toLowerCase(); }); say('The password still needs: ' + miss.join('; ') + '.', 'prPw'); return; }
          if (pw1 !== pw2) { say('The two passwords do not match. Type the same password in both boxes.', 'prPw2'); return; }
          try { await pinSet(pw1); } catch (x) { say('This browser cannot store a password here.'); return; }
          markAct();
        }
        var prof = { name: nm, role: (($('prRole') || {}).value || '').trim(), biz: (($('prBiz') || {}).value || '').trim(), reg: (($('prReg') || {}).value || '').trim(), phone: ph, email: mail };
        lset('cd.profile', JSON.stringify(prof));
        try { localWrite('settings', 'profile', Object.assign({}, prof, { updatedAt: Date.now() }), 'set'); } catch (x) {}
        if (setup) { ov.remove(); toast('Profile created. The app now locks after ' + (LOCK_MS / 60000) + ' minutes with no activity.'); return; }
        draw('Profile saved.' + (ph ? ' Your number is now locked and is used in the backup section.' : ''));
      } else if (b === 'chg') {
        var bx = $('prChg'); if (!bx) return;
        if (!reGate('profile')) return;
        bx.innerHTML = '<input id="prNew" type="tel" placeholder="New mobile number" style="' + inp + '"><button class="btn" data-p="chgok">Change number</button>';
      } else if (b === 'chgok') {
        if (!reGate('profile')) return;
        var nn = waNorm(($('prNew') || {}).value); if (!nn) { say('That does not look like a phone number.'); return; }
        p.phone = nn; lset('cd.profile', JSON.stringify(p)); draw('Number changed and locked.');
      }
    });
  }
  async function openBackup() {
    ['cd.bkq', 'cd.bkrec', 'cd.bkhint', 'cd.bkwa'].forEach(function (k) { if (k !== 'cd.bkwa' || profGet().phone) lset(k, null); });
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(ov);
    var names = { dir: '', dir2: '' }, pick = bkCanPick(), editPw = false;
    if (pick) { var h1 = await bkGetDir('dir'), h2 = await bkGetDir('dir2'); names.dir = h1 ? h1.name : ''; names.dir2 = h2 ? h2.name : ''; }
    var box = 'padding:8px 10px;border:1px solid #D4DBDF;border-radius:8px;font:inherit;flex:1;min-width:150px';
    function loc(slot, label, opt) {
      return '<div style="display:flex;gap:8px;align-items:center;margin:6px 0;flex-wrap:wrap"><div style="flex:1;min-width:180px"><b>' + label + '</b><br><span style="color:#58697A;font-size:13px">' + (names[slot] ? 'Folder: <b>' + esc(names[slot]) + '</b>' : (opt ? 'Optional' : 'Not chosen yet')) + '</span></div>' +
        '<button class="btn ghost sm" data-b="pick" data-slot="' + slot + '">' + (names[slot] ? 'Change' : 'Choose folder') + '</button>' + (opt && names[slot] ? '<button class="btn ghost sm" data-b="unpick" data-slot="' + slot + '">Remove</button>' : '') + '</div>';
    }
    function draw() {
      var c = bkCfg(), hasPw = !!bkPw(), num = waNum(), editing = !hasPw || editPw, dis = editing ? '' : ' disabled', dstyle = editing ? '' : ';background:#EDF0F1;color:#8a98a3';
      ov.innerHTML = '<div style="background:#fff;color:#101C26;width:min(560px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:22px 24px;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,28,38,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:20px">PDF/CSV Case Backup</h2><button class="btn ghost" data-b="close">Close</button></div>' +
        '<p style="margin:12px 0;color:#58697A">Saves every record as a PDF and a CSV inside one password-protected ZIP file. Each new backup replaces the previous one.</p>' +
        '<h3 style="margin:14px 0 4px;font-size:15px">1. Where to save</h3>' +
        (pick ? loc('dir', 'Location 1', false) + loc('dir2', 'Location 2', true) : '<p style="margin:4px 0;color:#58697A;font-size:13px">This browser cannot save to a chosen folder (phones and some browsers). Back up now downloads the ZIP file to this device instead.</p>') +
        '<h3 style="margin:16px 0 4px;font-size:15px">2. Backup password</h3>' +
        '<p style="margin:4px 0 8px;color:#58697A;font-size:13px">' + (hasPw ? (editing ? 'Type the new password twice, then press Save password.' : 'A password is saved. You need it to open the ZIP and the PDF inside. Press Change password to set a new one.') : 'Choose a password of at least 8 characters. You need it to open the backup.') + ' It is kept on this device so automatic backups can run. If you lose it the backup cannot be opened.</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px"><input id="bkPw"' + dis + ' type="password" autocomplete="new-password" placeholder="' + (hasPw ? (editing ? 'New password' : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022') : 'Password') + '" style="' + box + dstyle + '"><input id="bkPw2"' + dis + ' type="password" autocomplete="new-password" placeholder="Confirm password" style="' + box + dstyle + '"></div>' +
        '<div style="margin-top:8px;display:flex;gap:8px"><button class="btn" data-b="' + (editing ? 'pw' : 'pwedit') + '">' + (editing ? 'Save password' : 'Change password') + '</button>' + (hasPw && editing ? '<button class="btn ghost" data-b="pwcancel">Cancel</button>' : '') + '</div>' +
        '<h3 style="margin:16px 0 4px;font-size:15px">3. Back up</h3>' +
        '<label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input type="checkbox" id="bkAuto"' + (c.auto ? ' checked' : '') + ' style="margin-top:3px"><span>Back up automatically every 24 hours<br><span style="color:#58697A;font-size:13px">Runs while the app is open. If it was closed, it runs the next time you open it.</span></span></label>' +
        '<div style="margin:12px 0 8px"><button class="btn" data-b="run">Back up now</button></div>' +
        '<p id="bkStatus" style="margin:8px 0;font-size:13px;color:#2b3b47"></p>' +
        (hasPw ? '<h3 style="margin:16px 0 4px;font-size:15px">Forgot the password?</h3>' + (num ? '<p style="margin:4px 0 8px;color:#58697A;font-size:13px">Sends it to the mobile number in <a href="#" data-b="profile">My profile</a>: <b>+' + esc(waShow(num)) + '</b>. WhatsApp opens with the message ready and you press Send.</p><button class="btn ghost" data-b="wasend">Send password reminder to my WhatsApp</button>' : '<p style="margin:4px 0 8px;color:#58697A;font-size:13px">Add your mobile number in <a href="#" data-b="profile">My profile</a> and a reminder button will appear here.</p>') : '') +
        '<p id="bkMsg" style="min-height:18px;margin:10px 0 0"></p></div>';
      bkPaint();
    }
    draw();
    var say = function (m) { var e = $('bkMsg'); if (e) e.textContent = m; };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    ov.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'bkAuto') { var c = bkCfg(); c.auto = e.target.checked; bkSave(c); say('Saved.'); }
    });
    ov.addEventListener('click', async function (e) {
      var el = e.target.closest && e.target.closest('[data-b]'); if (!el) return; var b = el.getAttribute('data-b'), slot = el.getAttribute('data-slot');
      if (b === 'close') ov.remove();
      else if (b === 'profile') { e.preventDefault(); ov.remove(); openProfile(); }
      else if (b === 'pick') {
        try { var h = await window.showDirectoryPicker({ mode: 'readwrite' }); await bkPutDir(slot, h); names[slot] = h.name; draw(); say('Folder chosen.'); }
        catch (x) { if (!x || x.name !== 'AbortError') say('Could not choose that folder.'); }
      } else if (b === 'unpick') { await bkPutDir(slot, null); names[slot] = ''; draw(); say('Location removed.'); }
      else if (b === 'pwedit') { editPw = true; draw(); var f = $('bkPw'); if (f) f.focus(); }
      else if (b === 'pwcancel') { editPw = false; draw(); }
      else if (b === 'pw') {
        var pv = ($('bkPw') || {}).value || '', pv2 = ($('bkPw2') || {}).value || '';
        if (pv.length < 8) { say('The password needs at least 8 characters.'); return; }
        if (/[^\x20-\x7E]/.test(pv)) { say('Please use letters, numbers and ordinary symbols only.'); return; }
        if (pv !== pv2) { say('The two passwords do not match. Please type them again.'); return; }
        lset('cd.bkpw', pv); editPw = false; draw(); say('Password saved. Remember it: you need it to open your backups.');
      } else if (b === 'wasend') {
        var wn = waNum(); if (!wn || !bkPw()) return;
        window.open('https://wa.me/' + wn + '?text=' + encodeURIComponent(APPN + ' backup password: ' + bkPw()), '_blank', 'noopener');
        say('WhatsApp should open. Tap Send to keep the message in your chat.');
      } else if (b === 'run') {
        if (!bkPw()) { say('Set a backup password first.'); return; }
        if (pick && !names.dir && !names.dir2) { say('Choose a folder for Location 1 first.'); return; }
        say('Backing up…');
        var r = await bkRun(true); bkPaint();
        if (r && r.nopw) say('Set a backup password first.');
        else if (r && r.nofolder) say('Choose a folder for Location 1 first.');
        else if (r) say(((!r.l1 || r.l1.ok) && (!r.l2 || r.l2.ok)) ? 'Backup finished.' : 'Backup finished with a problem. See below.');
      }
    });
  }

  /* ---------- collections ---------- */
  function collection(col) {
    return {
      onSnapshot: function (cb) { subs[col].push(cb); try { cb(snap(col)); } catch (e) { console.error(e); } return function () { subs[col] = subs[col].filter(function (x) { return x !== cb; }); }; },
      doc: function (id) {
        id = safeId(id || genId());
        return {
          id: id,
          set: function (data) { var cu = mem[col][id]; data = clone(data); if (col === 'appointments' && cu && cu.data && cu.data.calId && data.calId == null) { data.calId = cu.data.calId; data.calH = cu.data.calH; } localWrite(col, id, data, 'set'); return Promise.resolve(); },
          update: function (patch) {
            var cur = mem[col][id], diff = {};
            Object.keys(patch).forEach(function (k) { if (!cur || JSON.stringify(cur.data[k]) !== JSON.stringify(patch[k])) diff[k] = clone({ v: patch[k] }).v; });
            if (!Object.keys(diff).length) return Promise.resolve();
            localWrite(col, id, Object.assign(cur ? clone(cur.data) : {}, clone(diff)), 'patch', diff); return Promise.resolve();
          },
          delete: function () { localDelete(col, id); return Promise.resolve(); },
          get: function () { var c = mem[col][id]; return Promise.resolve(c ? { id: id, exists: true, data: function () { return clone(c.data); } } : { id: id, exists: false }); }
        };
      }
    };
  }

  /* ---------- sign-in screen ---------- */
  var readyRes; var ready = new Promise(function (r) { readyRes = r; });
  function overlay(html) {
    var o = $('mdSign');
    if (!o) { o = document.createElement('div'); o.id = 'mdSign'; o.style.cssText = 'position:fixed;inset:0;z-index:300;background:#EDF0F1;display:flex;align-items:center;justify-content:center;padding:16px;font:15px system-ui,"Segoe UI",sans-serif;color:#101C26'; document.body.appendChild(o); }
    o.innerHTML = html; return o;
  }
  function showSignIn(msg) {
    if (!msg) { try { if (localStorage.getItem('cd.idleMsg')) { localStorage.removeItem('cd.idleMsg'); msg = 'You were signed out after ' + idleLabel() + ' of inactivity. Sign in again to continue.'; } } catch (e) {} }
    var msOk = !!CFG.clientId && !/PASTE/i.test(CFG.clientId), gOk = !!CFG.googleClientId && !/PASTE/i.test(CFG.googleClientId);
    var bs = 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:12px 14px;border-radius:10px;font:600 15px system-ui;cursor:pointer;text-align:left;margin-top:10px;';
    var o = overlay('<div style="width:min(440px,100%);background:#fff;border:1px solid #D4DBDF;border-radius:12px;padding:28px;box-shadow:0 8px 30px rgba(16,28,38,.12)">' +
      '<div style="font-weight:700;font-size:20px;margin-bottom:6px">&#9670; ' + APPN + '</div>' +
      '<p style="color:#58697A;margin:0 0 8px;font-size:14px;line-height:1.45">Choose where your records are kept. They are saved in your own account, in a folder named after your business, and nowhere else.</p>' +
      (msOk ? '<button id="mdGo" style="' + bs + 'border:0;background:#0A6B50;color:#fff">Microsoft account<span style="font:400 13px system-ui;opacity:.9">Outlook, Hotmail or Microsoft 365. Saved in OneDrive.</span></button>' : '') +
      (gOk ? '<button id="mdGoG" style="' + bs + 'border:1px solid #2f4a40;background:#fff;color:#101C26">Google account<span style="font:400 13px system-ui;color:#58697A">Gmail or Google Workspace. Saved in Google Drive.</span></button>' : '') +
      (!msOk && !gOk ? '<p style="color:#A3261F;font-size:14px">This copy has not been set up yet (no Microsoft or Google app ID).</p>' : '') +
      '<p style="color:#58697A;font-size:12px;margin:12px 0 0">You can only use one account per device at a time. Logging out removes the records from this device; they stay in your account. <a href="privacy.html" target="_blank" rel="noopener" style="color:#0A6B50">Privacy policy</a></p>' +
      '<div id="mdErr" style="color:#A3261F;font-size:13px;margin-top:12px;min-height:16px">' + esc(msg || '') + '</div></div>');
    var b = o.querySelector('#mdGo'); if (b) b.onclick = function () { b.disabled = true; lset('cd.prov', 'ms'); startLogin(); };
    var bg = o.querySelector('#mdGoG'); if (bg) bg.onclick = function () { bg.disabled = true; gStart(); };
  }
  function sessionExpired() { showSignIn('Your sign-in has expired. Please sign in again. Your unsaved changes are kept on this device.'); }

  /* ---------- account / settings ---------- */
  async function openAccount() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(ov);
    var t = tok() || {};
    function render(msg) {
      var acc = t.account || {};
      ov.innerHTML = '<div style="background:#fff;color:#101C26;width:min(560px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:22px 24px;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,28,38,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:20px">Settings</h2><button class="btn ghost" data-a="close">Close</button></div>' +
        '<p style="margin:14px 0 4px"><b>Signed in with your ' + (PROV === 'google' ? 'Google' : 'Microsoft') + ' account</b><br>' + esc(acc.name || '') + ' ' + esc(acc.mail || '') + '</p>' +
        '<p style="margin:6px 0 0;color:#1b5e20;font-size:13px">' + esc((($('syncState') || {}).textContent || '').trim()) + '</p>' +
        '<p style="margin:10px 0 0;color:#58697A;font-size:12px">App version: ' + esc(window.MD_BUILD || 'unknown') + ' &middot; <a href="#" data-a="guide">Quick guide</a> &middot; <a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a></p><p style="margin:10px 0;color:#58697A">Records are saved in your ' + SNAME() + ', in the folder <b>' + esc(rootLabel()) + '</b> (<a href="#" data-a="folder">open it</a>). ' + esc(pending() ? pending() + ' change(s) are waiting to upload.' : 'Everything is uploaded.') + '</p>' + (PROV === 'google' ? '<p style="margin:0 0 10px;color:#58697A;font-size:12.5px">Google asks you to confirm access about once an hour; a yellow bar appears when it does. Changes wait safely on this device until you reconnect.</p>' : '') +
        '<h3 style="margin:18px 0 6px;font-size:15px">Emailing invoices</h3>' + (PROV === 'google' ? '<p style="margin:0 0 8px;color:#58697A">With a Google account, invoices and reports open in your email app (or use Share PDF on a phone) so you attach the PDF yourself. Sending straight from the app with the PDF attached works with Microsoft accounts.</p>' : '<p style="margin:0 0 8px;color:#58697A">' + (ls('cd.mail') === '1' ? 'On. Invoices are emailed from your own Outlook with the PDF attached, and a copy goes to your Sent folder.' : 'Off. Turn it on to email invoices from your own Outlook with the PDF attached. Microsoft will ask you to allow it once.') + '</p><button class="btn ghost" data-a="' + (ls('cd.mail') === '1' ? 'mailoff' : 'mailon') + '">' + (ls('cd.mail') === '1' ? 'Turn off' : 'Turn on emailing') + '</button>') +
        '<h3 style="margin:18px 0 6px;font-size:15px">Business details</h3><p style="margin:0 0 8px;color:#58697A">Logo, address, VAT and payment details for your quotes and invoices.</p><button class="btn ghost" data-a="biz">Business details and logo</button>' + (TR().tenancyMode ? '<h3 style="margin:18px 0 6px;font-size:15px">Your accountant</h3><p style="margin:0 0 8px;color:#58697A">Name, phone, email and address, used for the rent and expenses report.</p><button class="btn ghost" data-a="acc">Your accountant</button>' : '') +
        ((window.CD_TRADES || {}).only ? '' : '<h3 style="margin:18px 0 6px;font-size:15px">Your trade</h3><p style="margin:0 0 8px;color:#58697A">' + esc(TR().label || '') + '. This sets the fields, stages and reminders on your records.</p><button class="btn ghost" data-a="trade">Change trade</button>') +
        '<h3 style="margin:18px 0 6px;font-size:15px">My profile</h3><p style="margin:0 0 8px;color:#58697A">' + (profGet().name ? esc(profGet().name) + (profGet().biz ? ' &middot; ' + esc(profGet().biz) : '') : 'Add your name, business, mobile number and email.') + '</p><button class="btn" data-a="profile">' + (profGet().name || profGet().phone ? 'Edit profile' : 'Set up profile') + '</button>' +
        '<h3 style="margin:18px 0 6px;font-size:15px">Security</h3>' + (pinData() ? '<p style="margin:0 0 8px;color:#1b5e20">App password is on. The app locks after ' + (LOCK_MS / 60000) + ' minutes with no activity.</p><button class="btn ghost" data-a="pin">Change app password</button>' : '<p style="margin:0 0 8px;color:#b3261e;background:#fdecea;border-radius:6px;padding:8px 10px"><b>Warning:</b> no app password is set. Anyone who picks up this device while you are signed in can see your clients.</p><button class="btn" data-a="pin">Set app password</button>') +
        '<h3 style="margin:18px 0 6px;font-size:15px">Sync</h3><div style="margin:0 0 6px"><button class="btn" data-a="sync">Sync now</button></div>' +
        '<h3 style="margin:18px 0 6px;font-size:15px">PDF/CSV Record Backup</h3><p style="margin:0 0 8px;color:#58697A">Saves all records as a password-protected ZIP (PDF and CSV) to the folders you choose, with an automatic backup every 24 hours.</p><button class="btn" data-a="pdfbk" style="background:#2f4a40;border-color:#2f4a40;color:#fff">PDF/CSV Record Backup</button>' +
        '<h3 style="margin:18px 0 6px;font-size:15px">Import a backup file</h3><p style="margin:0 0 8px;color:#58697A">Loads records from a ' + APPN + ' backup (.json). Records that already exist are not overwritten.</p>' +
        '<input type="file" id="mdImp" accept=".json,application/json" style="max-width:100%">' +
        '<h3 style="margin:18px 0 6px;font-size:15px">Restore from backup</h3><p style="margin:0 0 8px;color:#58697A">Use this if something was changed or deleted by mistake. Records in the backup file replace the matching records here.</p><input type="file" id="mdRes" accept=".json,application/json" style="max-width:100%">' +
        '<h3 style="margin:18px 0 6px;font-size:15px">Calendar reminders</h3>' + (PROV === 'google' ? '<p style="margin:0 0 8px;color:#58697A">Adding appointments to your calendar is available with Microsoft (Outlook) accounts. Your appointments are still kept and reminded in the app.</p>' : (calOn()
          ? '<p style="margin:0 0 8px;color:#1b5e20">On. Booked appointments are added to your Outlook calendar with a ' + CAL_MIN + '-minute reminder.</p><button class="btn ghost" data-a="caloff">Turn off</button>'
          : '<p style="margin:0 0 8px;color:#58697A">Adds each booked appointment to your Outlook calendar with a ' + CAL_MIN + '-minute reminder, so your phone alerts you even when this app is closed. You will be asked to approve calendar access once.</p><button class="btn" data-a="calon">Turn on</button>') +
        '<p style="margin:8px 0 0;color:#58697A;font-size:12px">Only the name, time, type, method and place go to the calendar, never your notes. On your phone, use the Outlook app or add this Microsoft account to your phone calendar, and allow notifications.</p>') +
        '<h3 style="margin:18px 0 6px;font-size:15px">Log out</h3><p style="margin:0 0 8px;color:#58697A">Removes the records from this device. They stay safe in your ' + SNAME() + '.</p><button class="btn" data-a="out">Log out</button>' +
        '<p style="margin-top:14px;min-height:18px" id="mdAccMsg">' + esc(msg || '') + '</p></div>';
    }
    render('');
    var say = function (m) { var e = $('mdAccMsg'); if (e) e.textContent = m; };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    ov.addEventListener('change', async function (e) {
      var isRes = e.target.id === 'mdRes';
      if ((e.target.id !== 'mdImp' && !isRes) || !e.target.files[0]) return;
      if (isRes && !confirm('Restore from this backup? Records in the file replace the matching records here with the backup version. Records not in the file are left alone.')) { e.target.value = ''; return; }
      try {
        var p = JSON.parse(await e.target.files[0].text()), n = 0, skipped = 0;
        COLS.forEach(function (col) {
          (p[col] || []).forEach(function (row) {
            var id = safeId(row.id || genId()); if (mem[col][id] && !isRes) { skipped++; return; }
            var d = clone(row); delete d.id; localWrite(col, id, d, 'set'); n++;
          });
        });
        say((isRes ? 'Restored ' : 'Imported ') + n + ' item(s)' + (skipped ? ', skipped ' + skipped + ' that already exist' : '') + '. Uploading to ' + SNAME() + '…');
        flush();
      } catch (x) { say('That file could not be read as a backup.'); }
    });
    ov.addEventListener('click', async function (e) {
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return; a = a.getAttribute('data-a');
      if (a === 'close') ov.remove();
      else if (a === 'backup') { var bb = $('backupBtn'); if (bb) bb.click(); }
      else if (a === 'sync') { say('Syncing…'); await flush(); await pull(); say(st.err || (st.offline ? 'Offline. Will retry.' : 'Up to date.')); }
      else if (a === 'folder') { e.preventDefault(); try { var u = await ST.folderUrl(); if (u) window.open(u, '_blank', 'noopener'); else say('Folder not created yet.'); } catch (x) { say('Could not reach ' + SNAME() + '.'); } }
      else if (a === 'calon') { lset('cd.calwant', '1'); startLogin(); }
      else if (a === 'caloff') { lset('cd.cal', null); render('Calendar reminders turned off. Events already in Outlook stay there.'); }
      else if (a === 'pdfbk') { ov.remove(); openBackup(); }
      else if (a === 'profile') { ov.remove(); openProfile(); }
      else if (a === 'biz') { ov.remove(); if (window.CD_openBiz) window.CD_openBiz(); }
      else if (a === 'acc') { ov.remove(); if (window.CD_openAcc) window.CD_openAcc(); }
      else if (a === 'mailon') { lset('cd.mailwant', '1'); startLogin(); }
      else if (a === 'mailoff') { lset('cd.mail', null); ov.remove(); toast('Emailing invoices is off.'); }
      else if (a === 'trade') { ov.remove(); if (window.CD_openTrade) window.CD_openTrade(); }
      else if (a === 'pin') { ov.remove(); openPin(); }
      else if (a === 'guide') { e.preventDefault(); openGuide(); }
      else if (a === 'out') { ov.remove(); signOut(); }
    });
  }
  async function signOut() {
    if (pending()) { try { await flush(); } catch (e) {} }
    var msg = pending()
      ? pending() + ' change(s) have not reached ' + SNAME() + ' yet and will be lost. Log out anyway?'
      : 'Log out? Records are removed from this device and load again when you sign in. Signing in again also loads the latest version of the app.';
    if (!confirm(msg)) return;
    await wipeAndReload(false);
  }
  async function wipeAndReload(auto) {
    try { if (window.caches) { var ks = await caches.keys(); await Promise.all(ks.map(function (k) { return caches.delete(k); })); } } catch (e) {}
    try { if (navigator.serviceWorker) { var rg = await navigator.serviceWorker.getRegistrations(); await Promise.all(rg.map(function (r) { return r.unregister(); })); } } catch (e) {}
    await idbClearAll(); setTok(null);
    ['cd.pkce', 'cd.reauthOk', 'cd.folder', 'cd.gfid', 'cd.gcols', 'cd.owner', 'cd.prov', 'cd.gstate', 'cd.cal', 'cd.mail', 'cd.caldel'].forEach(function (k) { lset(k, null); });
    if (auto) { try { localStorage.setItem('cd.idleMsg', '1'); } catch (e) {} }
    location.replace(location.pathname + '?fresh=' + Date.now());
  }
  /* ---------- automatic log out after a period with no activity (default 2 hours) ---------- */
  var IDLE_MS = Math.max(0.05, +(CFG.idleMinutes || 120)) * 60000, idleBusy = false, lastW = 0;
  function idleLabel() { var m = IDLE_MS / 60000; return m >= 60 ? (m / 60 === 1 ? '1 hour' : (m / 60) + ' hours') : m + ' minutes'; }
  function markAct() { if (locked) return; try { localStorage.setItem('cd.act', String(Date.now())); } catch (e) {} }
  function lastAct() { var v = 0; try { v = +localStorage.getItem('cd.act') || 0; } catch (e) {} return v || Date.now(); }
  function isIdle() { return Date.now() - lastAct() >= IDLE_MS; }
  async function autoSignOut() {
    if (pending()) { try { await flush(); } catch (e) {} }
    if (pending()) {
      setTok(null);
      showSignIn('You were signed out after ' + idleLabel() + ' of inactivity. Changes not yet saved to ' + SNAME() + ' are kept on this device and upload when you sign in.');
      return;
    }
    await wipeAndReload(true);
  }

  /* ---------- PIN screen lock (auto-locks after 15 minutes with no activity, only when a PIN is set) ---------- */
  var locked = false, LOCK_MS = Math.max(0.05, +(CFG.lockMinutes || 15)) * 60000, pinFails = 0;
  function pwRules(pw, p) {
    pw = String(pw || ''); p = p || {}; var low = pw.toLowerCase();
    var bits = [String(p.name || '').toLowerCase().split(/\s+/), String(p.email || '').toLowerCase().split('@')[0]].join(',').split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3; });
    var common = /^(password|passw0rd|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|football|abc123|123456)/i;
    return [[pw.length >= 10, 'At least 10 characters'], [/[a-z]/.test(pw), 'A lower-case letter'], [/[A-Z]/.test(pw), 'An upper-case letter'], [/\d/.test(pw), 'A number'], [/[^A-Za-z0-9]/.test(pw), 'A symbol, such as ! ? # or %'],
      [!!pw && !bits.some(function (w) { return low.indexOf(w) > -1; }) && !common.test(pw), 'Not your name, email or a common password']];
  }
  function pwOk(pw, p) { return pwRules(pw, p).every(function (r) { return r[0]; }); }
  function pwList(pw, p) { return '<ul style="list-style:none;padding:0;margin:2px 0 10px;font-size:12.5px">' + pwRules(pw, p).map(function (r) { return '<li style="color:' + (r[0] ? '#1b5e20' : '#8a4b00') + '">' + (r[0] ? '✓ ' : '○ ') + r[1] + '</li>'; }).join('') + '</ul>'; }
  window.CD_pwOk = pwOk;
  function pinData() { try { return JSON.parse(ls('cd.pin') || 'null'); } catch (e) { return null; } }
  function b64(buf) { var a = new Uint8Array(buf), s2 = ''; for (var i = 0; i < a.length; i++) s2 += String.fromCharCode(a[i]); return btoa(s2); }
  function unb64(t) { var s2 = atob(t), a = new Uint8Array(s2.length); for (var i = 0; i < s2.length; i++) a[i] = s2.charCodeAt(i); return a; }
  async function pinHash(pin, salt) {
    var k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, k, 256));
  }
  async function pinSet(pin) { var salt = crypto.getRandomValues(new Uint8Array(16)); lset('cd.pin', JSON.stringify({ kind: 'pw', s: b64(salt), h: await pinHash(pin, salt) })); }
  async function pinCheck(pin) { var d = pinData(); if (!d) return true; return (await pinHash(pin, unb64(d.s))) === d.h; }
  function lockDue() { return !!pinData() && Date.now() - lastAct() >= LOCK_MS; }
  function lockNow() {
    if (locked || !pinData()) return;
    locked = true; lset('cd.locked', '1'); pinFails = 0;
    var ov = document.createElement('div'); ov.id = 'mdLock';
    ov.style.cssText = 'position:fixed;inset:0;z-index:400;background:#0f1f1a;color:#fff;display:flex;align-items:center;justify-content:center;padding:16px;font:15px system-ui,sans-serif';
    ov.innerHTML = '<form style="width:min(340px,100%);text-align:center" autocomplete="off"><div style="font-size:40px">🔒</div><h2 style="margin:8px 0 4px;font-size:22px">' + APPN + ' is locked</h2><p style="margin:0 0 16px;color:#b9c8c0;font-size:13px">Enter your app password to carry on.</p>' +
      '<input id="mdLockPin" type="password" autocomplete="current-password" maxlength="128" aria-label="App password" style="width:100%;box-sizing:border-box;padding:12px;font-size:18px;text-align:center;border-radius:8px;border:1px solid #3d5a4e;background:#fff;color:#101C26">' +
      '<button type="submit" id="mdLockGo" style="width:100%;margin-top:12px;padding:12px;font-size:16px;border:0;border-radius:8px;background:#2f8f6b;color:#fff;cursor:pointer">Unlock</button>' +
      '<p id="mdLockMsg" style="min-height:20px;margin:10px 0 0;color:#ffb4a8;font-size:13px"></p><button type="button" id="mdLockOut" style="background:none;border:0;color:#b9c8c0;text-decoration:underline;cursor:pointer;font-size:13px">Forgot your password? Log out</button></form>';
    document.body.appendChild(ov);
    var app = $('app'); if (app) { try { app.inert = true; } catch (e) {} }
    var inp = $('mdLockPin'), msg = $('mdLockMsg'); setTimeout(function () { inp.focus(); }, 30);
    var autoSeq = 0;
    inp.addEventListener('input', async function () {
      var v = inp.value.trim(), my = ++autoSeq;
      if (pinData().kind === 'pw' || v.length < 4 || v.length > 8) return;
      var ok = false; try { ok = await pinCheck(v); } catch (x) { ok = false; }
      if (ok && my === autoSeq && !$('mdLock') === false) unlock();
    });
    ov.querySelector('form').addEventListener('submit', async function (e) {
      e.preventDefault(); var v = inp.value.trim(); if (!v) return;
      var ok = false; try { ok = await pinCheck(v); } catch (x) { ok = false; }
      if (ok) { unlock(); return; }
      pinFails++; inp.value = '';
      if (pinFails >= 5) { msg.textContent = 'Too many wrong attempts. Logging out…'; autoSignOut(); return; }
      msg.textContent = 'Wrong password. ' + (5 - pinFails) + ' attempt' + (5 - pinFails === 1 ? '' : 's') + ' left.'; inp.focus();
    });
    $('mdLockOut').addEventListener('click', function () { signOut(); });
  }
  function unlock() {
    locked = false; lset('cd.locked', null); markAct();
    var ov = $('mdLock'); if (ov) ov.remove();
    var app = $('app'); if (app) { try { app.inert = false; } catch (e) {} }
  }
  function checkLock() { if (!locked && tok() && lockDue()) lockNow(); }
  function startLockWatch() {
    if (pinData() && (ls('cd.locked') === '1' || lockDue())) lockNow();
    setInterval(checkLock, Math.min(15000, LOCK_MS / 2));
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkLock(); });
    window.addEventListener('focus', checkLock); window.addEventListener('pageshow', checkLock);
  }


  function openGuide() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:260;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:#fff;color:#101C26;width:min(520px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:22px 24px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,28,38,.3)"><h2 style="margin:0 0 10px;font-size:20px">Quick guide</h2>' +
      (TR().id === 'landlord' ? '<ul style="margin:0 0 12px;padding-left:20px"><li><b>Properties</b> (home page): press <b>Add property</b>, then add the tenants, rent and certificates. Everything saves by itself to your own OneDrive or Google Drive.</li><li><b>Rent</b>: mark each rent as due or paid at the top of the property page, and create a rent invoice from there.</li><li><b>Expenses</b>: add them on the property page. <b>Generate documents</b> (left menu) makes the income and expenses report for your accountant.</li><li><b>Reminders</b>: gas safety, EICR, EPC, deposit protection, insurance and overdue rent.</li><li><b>Settings</b>: app password, backup to PDF/CSV, restore.</li></ul>' : '') +
      '<ul style="margin:0 0 12px;padding-left:20px' + (TR().id === 'landlord' ? ';display:none' : '') + '"><li><b>Tasks</b> (home page): tick things off. Tap a task to change its date or edit it.</li><li><b>Add client</b> opens a new client. Everything saves by itself to your OneDrive.</li><li><b>Tools</b> (left bar): Notebook, Marketing and Settings, plus tools for your trade.</li><li><b>Reminders</b> (right of the home page): key dates coming up, such as services, deadlines and renewals.</li><li><b>Settings</b>: change your app password, sync, back up to PDF/CSV, restore, calendar reminders.</li></ul>' +
      '<p style="margin:0 0 6px"><b>Please do not record</b> NI numbers, bank or sort-code details, passport numbers, income and expenditure, health or lifestyle answers, immigration share codes or benefit amounts.</p>' +
      '<p style="margin:0 0 14px;color:#58697A">Keep your own Microsoft login private, and save your Microsoft recovery code somewhere safe.</p><button class="btn" data-g="1">Got it</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if ((e.target.closest && e.target.closest('[data-g]')) || e.target === ov) ov.remove(); });
  }
  function guideMaybe() { if (!tok() || ls('cd.guide')) return false; lset('cd.guide', '1'); openGuide(); return true; }
  var pwWait = 0, setupSkipped = false;
  function pinWarnMaybe() {
    if (!tok() || setupSkipped) return;
    if (!firstPullDone && pwWait++ < 10) { setTimeout(pinWarnMaybe, 1000); return; }
    if (ls('cd.guide') && !$('mdProf') && (!pinData() || !profGet().name)) { openProfile(true); return; }
    if (!ls('cd.guide')) { guideMaybe(); setTimeout(pinWarnMaybe, 1500); }
  }
  function openPin() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(ov);
    var inS = 'width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #c9d3da;border-radius:6px;font-size:15px;margin:4px 0 6px';
    function draw(msg, good) {
      var has = !!pinData(), mins = LOCK_MS / 60000;
      ov.innerHTML = '<div style="background:#fff;color:#101C26;width:min(460px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:22px 24px;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,28,38,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:20px">' + (has ? 'Change app password' : 'Set app password') + '</h2><button class="btn ghost" data-p="close">Close</button></div>' +
        '<p style="margin:12px 0;color:#58697A">The app locks itself after ' + mins + ' minutes with no activity. You unlock it with this password.</p>' +
        (has ? '<label>Current password<input id="pnCur" type="password" autocomplete="current-password" maxlength="128" style="' + inS + '"></label>' : '') +
        '<label>New password<input id="pnNew" type="password" autocomplete="new-password" maxlength="128" style="' + inS + '"></label><div id="pnChk">' + pwList('', profGet()) + '</div>' +
        '<label>Repeat new password<input id="pnNew2" type="password" autocomplete="new-password" maxlength="128" style="' + inS + '"></label>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"><button class="btn" data-p="save">' + (has ? 'Change password' : 'Set password') + '</button>' + (has ? '<button class="btn ghost" data-p="lock">Lock now</button>' : '') + '</div>' +
        '<p id="pnMsg" style="min-height:18px;margin:12px 0 0;color:' + (good ? '#1b5e20' : '#b3261e') + '">' + esc(msg || '') + '</p>' +
        '<p style="margin:8px 0 0;color:#58697A;font-size:12px">This password locks the app on this device. It is stored here only as a scrambled code, never in your online storage. If you forget it, log out and sign in again with Microsoft, then set a new one.</p></div>';
    }
    draw('');
    ov.addEventListener('input', function (e) { if (e.target.id === 'pnNew') { var c = $('pnChk'); if (c) c.innerHTML = pwList(e.target.value, profGet()); } });
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    ov.addEventListener('click', async function (e) {
      var b = e.target.closest && e.target.closest('[data-p]'); if (!b) return; var a = b.getAttribute('data-p');
      if (a === 'close') { ov.remove(); return; }
      if (a === 'lock') { ov.remove(); lockNow(); return; }
      var cur = $('pnCur'), has = !!pinData();
      if (has) { var okc = false; try { okc = await pinCheck(cur ? cur.value : ''); } catch (x) {} if (!okc) { draw('Current password is wrong.'); return; } }
      if (a === 'save') {
        var n1 = $('pnNew').value, n2 = $('pnNew2').value;
        if (!pwOk(n1, profGet())) { draw('The new password is not strong enough. See the checklist.'); return; }
        if (n1 !== n2) { draw('The two passwords do not match.'); return; }
        try { await pinSet(n1); } catch (x) { draw('This browser cannot store a password here.'); return; }
        markAct(); draw(has ? 'Password changed.' : 'Password set. The app locks after ' + (LOCK_MS / 60000) + ' minutes of no activity.', true);
      }
    });
  }
  function checkIdle() {
    if (idleBusy || !tok() || !isIdle()) return;
    idleBusy = true; autoSignOut().then(function () { idleBusy = false; }, function () { idleBusy = false; });
  }
  function startIdleWatch() {
    var gap = Math.min(5000, IDLE_MS / 4);
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'].forEach(function (ev) {
      window.addEventListener(ev, function () { var n = Date.now(); if (n - lastW > gap) { lastW = n; markAct(); } }, { capture: true, passive: true });
    });
    setInterval(checkIdle, Math.min(30000, IDLE_MS / 2));
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkIdle(); });
    window.addEventListener('focus', checkIdle); window.addEventListener('pageshow', checkIdle);
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#settingsBtn,#logoutBtn'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.id === 'logoutBtn') signOut(); else openAccount();
  }, true);

  /* ---------- downloads (Backup / CSV buttons) ---------- */
  function saveFile(o) {
    return new Promise(function (res) {
      var blob = new Blob([o.data], { type: /\.csv$/i.test(o.filename) ? 'text/csv' : 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = o.filename; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); res();
    });
  }
  function u8b64(u) { var s = '', i, C = 0x8000; for (i = 0; i < u.length; i += C) s += String.fromCharCode.apply(null, u.subarray(i, i + C)); return btoa(s); }
  window.CD_mail = {
    on: function () { return PROV === 'ms' && ls('cd.mail') === '1'; },
    can: function () { return PROV === 'ms'; },
    enable: function () { if (PROV !== 'ms') { toast('Sending with the PDF attached works with Microsoft accounts. With Google, use Email app or Share PDF.'); return; } lset('cd.mailwant', '1'); startLogin(); },
    off: function () { lset('cd.mail', null); },
    send: async function (o) {
      var msg = { subject: o.subject, body: { contentType: 'Text', content: o.text }, toRecipients: o.to.map(function (a) { return { emailAddress: { address: a } }; }) };
      if (o.bytes) msg.attachments = [{ '@odata.type': '#microsoft.graph.fileAttachment', name: o.name, contentType: 'application/pdf', contentBytes: u8b64(o.bytes) }];
      var r = await gfetch('/me/sendMail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, saveToSentItems: true }) });
      if (r.status === 403) { lset('cd.mail', null); var e = new Error('perm'); e.perm = true; throw e; }
      if (!r.ok) throw httpErr(r);
      return true;
    }
  };
  window.claude = { use: function (name) {
    if (name === 'db') return ready;
    if (name === 'downloads') return Promise.resolve({ save: saveFile });
    return Promise.resolve(null);
  } };

  /* ---------- start ---------- */
  function addSyncBadge() {
    if ($('syncState')) return;
    var b = $('backupBtn'); if (!b) return;
    var s = document.createElement('span'); s.id = 'syncState'; s.style.cssText = 'font-size:12px;white-space:nowrap;margin-right:6px'; b.parentNode.insertBefore(s, b); setState();
  }
  async function loadCache() {
    (await idbAll('docs')).forEach(function (r) { if (mem[r.col]) mem[r.col][r.id] = { data: r.data, etag: r.etag, itemId: r.itemId }; });
    (await idbAll('dirty')).forEach(function (d) { dirty[d.k] = d; vctr = Math.max(vctr, d.v || 0); });
  }
  /* Keep each account's records apart: if a different account signs in on this device, clear what the last one left here. */
  async function ownerCheck(prov, mail) {
    var cur = prov + ':' + String(mail || '').toLowerCase(), prev = ls('cd.owner');
    if (prev && prev !== cur) {
      if (pending() && !confirm('This device still has ' + pending() + ' unsaved change(s) from ' + prev.split(':').slice(1).join(':') + '. Signing in as ' + (mail || 'a different account') + ' removes them from this device so the two accounts are kept apart. Continue?')) {
        setTok(null); throw new Error('Sign in with ' + prev.split(':').slice(1).join(':') + ' to upload those changes first.');
      }
      await idbClearAll(); COLS.forEach(function (c) { mem[c] = {}; }); dirty = {};
      ['cd.folder', 'cd.gfid', 'cd.gcols', 'cd.cal', 'cd.mail', 'cd.caldel'].forEach(function (k) { lset(k, null); }); gcols = {};
    }
    lset('cd.owner', cur);
  }
  async function handleRedirect() {
    var hs = location.hash.slice(1);
    if (/(^|&)(access_token|error)=/.test(hs) && ls('cd.gstate')) {
      var gr = gParse(hs); history.replaceState(null, '', location.pathname);
      if (gr.err) { lset('cd.gstate', null); throw new Error(gr.err === 'access_denied' ? 'Google sign-in was cancelled.' : 'Google sign-in failed (' + gr.err + ').'); }
      if (gr.st !== ls('cd.gstate')) throw new Error('Sign-in could not be verified. Please try again.');
      lset('cd.gstate', null);
      if (!/drive\.file/.test(gr.scope)) throw new Error('Google did not give access to Drive. Sign in again and tick the box that lets ' + APPN + ' see and manage the files it creates.');
      var prevG = (tok() || {}).account || {}, wasG = (tok() || {}).prov === 'google';
      lset('cd.prov', 'google'); PROV = 'google';
      setTok({ access: gr.at, exp: Date.now() + gr.exp * 1000, prov: 'google', account: prevG });
      var gu = {}; try { var ur = await gfetch(GAPI + '/oauth2/v3/userinfo'); if (ur.ok) gu = await ur.json(); } catch (e) {}
      var t0 = tok(); t0.account = { name: gu.name || '', mail: gu.email || '' }; setTok(t0);
      await ownerCheck('google', t0.account.mail); markAct();
      if (wasG && prevG.mail && t0.account.mail && prevG.mail.toLowerCase() !== t0.account.mail.toLowerCase()) lset('cd.reauthOk', null);
      return;
    }
    var p = new URLSearchParams(location.search);
    if (p.get('fresh') && !p.get('code') && !p.get('error')) { history.replaceState(null, '', location.pathname); return; }
    if (!p.get('code') && !p.get('error')) { lset('cd.calwant', null); lset('cd.mailwant', null); lset('cd.reauth', null); return; }
    var clean = function () { history.replaceState(null, '', location.pathname); };
    if (p.get('error')) { var m = p.get('error_description') || p.get('error'); lset('cd.calwant', null); lset('cd.mailwant', null); lset('cd.reauth', null); clean(); throw new Error(m); }
    var pk = null; try { pk = JSON.parse(localStorage.getItem('cd.pkce') || 'null'); } catch (e) {}
    var code = p.get('code'), state = p.get('state'); clean();
    if (!pk || pk.st !== state) throw new Error('Sign-in could not be verified. Please try again.');
    var prevAcc = (tok() || {}).account || {};
    var tj = await tokenRequest({ grant_type: 'authorization_code', code: code, redirect_uri: REDIRECT, code_verifier: pk.v });
    if (ls('cd.mailwant') === '1') {
      lset('cd.mailwant', null);
      if (/mail\.send/i.test(tj.scope || '')) { lset('cd.mail', '1'); lset('cd.calnote', 'Emailing from your Outlook is on. Open the invoice and press Email again.'); }
      else lset('cd.calnote', 'Microsoft did not give permission to send email, so emailing is still off.');
    }
    if (ls('cd.calwant') === '1') {
      lset('cd.calwant', null);
      if (/calendars\.readwrite/i.test(tj.scope || '')) { lset('cd.cal', '1'); lset('cd.calnote', 'Calendar reminders are on.'); }
      else lset('cd.calnote', 'Microsoft did not grant calendar access, so reminders are still off.');
    }
    markAct();
    try { localStorage.removeItem('cd.pkce'); } catch (e) {}
    var meMail = '';
    try {
      var me = await (await gfetch('/me?$select=displayName,mail,userPrincipalName')).json();
      var t = tok(); t.account = { name: me.displayName || '', mail: me.mail || me.userPrincipalName || '' }; t.prov = 'ms'; setTok(t); meMail = t.account.mail;
    } catch (e) {}
    lset('cd.prov', 'ms'); PROV = 'ms';
    if (ls('cd.reauth') !== '1') await ownerCheck('ms', meMail);
    if (ls('cd.reauth') === '1') {
      lset('cd.reauth', null);
      var pm = String(prevAcc.mail || '').toLowerCase(), nm = String(meMail || '').toLowerCase();
      if (pm && nm && pm !== nm) { setTok(null); lset('cd.reauthNext', null); throw new Error('That was a different Microsoft account from the one signed in here, so nothing was changed. Please sign in again.'); }
      lset('cd.reauthOk', String(Date.now())); lset('cd.reopen', ls('cd.reauthNext')); lset('cd.reauthNext', null);
    }
  }
  /* ---------- the folder named after the business (created on first sign-in, found again on other devices) ---------- */
  function cleanName(s) { return String(s || '').replace(/[\\\/:*?"<>|#%\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); }
  async function findFolders() {
    if (PROV === 'google') {
      var g = await gq("mimeType='" + GFOLDER + "' and appProperties has { key='cdRoot' and value='1' } and trashed=false", 'id,name,appProperties');
      return { legacy: false, list: g.map(function (f) { return { name: (f.appProperties || {}).cdName || f.name, id: f.id }; }) };
    }
    var r = await gfetch(APP + '/children?$select=name,folder&$top=200');
    if (r.status === 404) return { legacy: false, list: [] };
    if (!r.ok) throw httpErr(r);
    var v = ((await r.json()).value || []).filter(function (x) { return x.folder && x.name; });
    if (v.some(function (x) { return COLS.indexOf(x.name) > -1; })) return { legacy: true, list: [] };
    return { legacy: false, list: v.map(function (x) { return { name: x.name }; }) };
  }
  async function makeFolder(name) {
    if (PROV === 'google') {
      var r = await gfetch('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: gRootName(name), mimeType: GFOLDER, appProperties: { cdRoot: '1', cdName: name } }) });
      if (!r.ok) throw httpErr(r); return { name: name, id: (await r.json()).id };
    }
    /* Personal OneDrive does not accept creating a folder through the special-folder alias, so use the app folder's own id.
       If that is refused too, the folder is simply created by the first save (OneDrive makes missing folders on upload). */
    var a = await gfetch(APP + '?$select=id');
    if (!a.ok) throw httpErr(a);
    var aid = (await a.json()).id;
    if (aid) {
      var m = await gfetch('/me/drive/items/' + encodeURIComponent(aid) + '/children', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) });
      if (!m.ok && m.status !== 409 && m.status !== 400 && m.status !== 403 && m.status !== 501) throw httpErr(m);
      if (m.ok || m.status === 409) return { name: name };
    }
    var p = await gfetch(APP + ':/' + enc(name + '/settings/folder.json') + ':/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, createdAt: Date.now() }) });
    if (!p.ok) throw httpErr(p);
    return { name: name };
  }
  function useFolder(f) {
    lset('cd.folder', f.name); if (PROV === 'google') { lset('cd.gfid', f.id); gcols = {}; lset('cd.gcols', null); }
    var p = profGet(); if (!p.biz && f.name) { p.biz = f.name; lset('cd.profile', JSON.stringify(p)); }
  }
  function askFolder(list) {
    return new Promise(function (res) {
      var acc = (tok() || {}).account || {}, def = cleanName(profGet().biz || profGet().name || acc.name || '');
      var o = overlay('<form id="cdFold" style="width:min(460px,100%);background:#fff;border:1px solid #D4DBDF;border-radius:12px;padding:26px;box-shadow:0 8px 30px rgba(16,28,38,.12)">' +
        '<div style="font-weight:700;font-size:19px;margin-bottom:6px">Your records folder</div>' +
        '<p style="color:#58697A;margin:0 0 12px;font-size:14px;line-height:1.45">Signed in as <b>' + esc(acc.mail || acc.name || '') + '</b>. Your records will be kept in a folder in your ' + SNAME() + '.</p>' +
        (list.length ? '<p style="margin:0 0 6px;font-weight:600">Use a folder you already have</p>' + list.map(function (f, i) { return '<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="radio" name="cdf" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(f.name) + '</label>'; }).join('') +
          '<label style="display:flex;gap:8px;align-items:center;margin:8px 0 4px"><input type="radio" name="cdf" value="new"> Create a new folder</label>' : '') +
        '<label style="display:block;margin-top:8px;font-size:13px;color:#58697A">Your business name, or your own name if you work under it<input id="cdFoldName" value="' + esc(def) + '" maxlength="60" style="display:block;width:100%;margin-top:4px;padding:10px;border:1px solid #D4DBDF;border-radius:8px;font:15px system-ui;box-sizing:border-box"></label>' +
        '<p id="cdFoldWhere" style="font-size:12.5px;color:#58697A;margin:8px 0 0"></p>' +
        '<button type="submit" style="width:100%;margin-top:14px;padding:12px;border:0;border-radius:8px;background:#0A6B50;color:#fff;font:600 15px system-ui;cursor:pointer">Continue</button>' +
        '<div id="cdFoldMsg" style="color:#A3261F;font-size:13px;margin-top:10px;min-height:16px"></div></form>');
      var nm = o.querySelector('#cdFoldName'), wh = o.querySelector('#cdFoldWhere');
      function sel() { var c = o.querySelector('input[name=cdf]:checked'); return c ? c.value : 'new'; }
      function upd() { var n = cleanName(nm.value), useNew = sel() === 'new'; nm.parentNode.style.display = useNew ? '' : 'none'; wh.textContent = useNew ? 'Folder: ' + (PROV === 'google' ? 'Google Drive \u203a My Drive \u203a ' + gRootName(n || '\u2026') : 'OneDrive \u203a Apps \u203a ' + APPN + ' \u203a ' + (n || '\u2026')) : ''; }
      o.addEventListener('input', upd); o.addEventListener('change', upd); upd();
      o.querySelector('form').addEventListener('submit', async function (e) {
        e.preventDefault(); var msg = o.querySelector('#cdFoldMsg'), btn = o.querySelector('button[type=submit]'), v = sel();
        if (v !== 'new') { useFolder(list[+v]); res(); return; }
        var n = cleanName(nm.value); if (n.length < 2) { msg.textContent = 'Type a name of at least 2 letters.'; return; }
        if (list.some(function (f) { return f.name.toLowerCase() === n.toLowerCase(); })) { msg.textContent = 'You already have a folder with that name. Choose it above, or type a different name.'; return; }
        btn.disabled = true; msg.textContent = '';
        try { useFolder(await makeFolder(n)); res(); } catch (x) { btn.disabled = false; msg.textContent = 'Could not create the folder (' + (x.message || 'error') + '). Check your connection and try again.'; }
      });
    });
  }
  async function ensureWorkspace() {
    if (FOLDER() !== null && (PROV !== 'google' || ls('cd.gfid'))) return;
    var f = await findFolders();
    if (f.legacy) { lset('cd.folder', ''); return; }
    if (f.list.length === 1) { useFolder(f.list[0]); return; }
    await askFolder(f.list);
  }
  function reopenTarget(ro) { if (ro === 'profile') openProfile(); else if (ro === 'backup') openBackup(); else if (ro === 'pin') openPin(); else if (ro === 'biz' && window.CD_openBiz) window.CD_openBiz(); }
  /* Google accounts confirm sensitive changes with the app password (Google cannot be asked to re-check the account password). */
  function pwGate(next) {
    if (!pinData()) { lset('cd.reauthOk', String(Date.now())); reopenTarget(next); return; }
    var ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:260;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<form style="background:#fff;width:min(380px,100%);border-radius:12px;padding:22px;font:14px system-ui,sans-serif;color:#101C26"><h3 style="margin:0 0 8px">Confirm it is you</h3><p style="margin:0 0 10px;color:#58697A">Type your app password to change this.</p><input id="cdPg" type="password" autocomplete="current-password" style="width:100%;padding:10px;border:1px solid #D4DBDF;border-radius:8px;box-sizing:border-box"><div id="cdPgMsg" style="color:#A3261F;min-height:16px;margin:8px 0"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" id="cdPgX">Cancel</button><button class="btn" type="submit">Confirm</button></div></form>';
    document.body.appendChild(ov); setTimeout(function () { var i = $('cdPg'); if (i) i.focus(); }, 30);
    $('cdPgX').onclick = function () { ov.remove(); };
    ov.querySelector('form').addEventListener('submit', async function (e) {
      e.preventDefault(); if (await pinCheck($('cdPg').value)) { ov.remove(); lset('cd.reauthOk', String(Date.now())); reopenTarget(next); } else $('cdPgMsg').textContent = 'That password is not right.';
    });
  }
  /* One-time move: cases kept on this device are uploaded to the app's own OneDrive folder. */
  function migrateToAppFolder() {
    var done = null; try { done = localStorage.getItem('cd.loc2'); } catch (e) {}
    if (done) return;
    COLS.forEach(function (col) {
      Object.keys(mem[col]).forEach(function (id) {
        var d = mem[col][id]; d.etag = null; d.itemId = null; persistDoc(col, id);
        var k = col + '/' + id; if (!dirty[k]) { var nd = { k: k, col: col, id: id, kind: 'set', patch: {}, v: ++vctr }; dirty[k] = nd; idbPut('dirty', nd); }
      });
    });
    try { localStorage.setItem('cd.loc2', '1'); } catch (e) {}
  }
  async function boot() {
    addSyncBadge();
    await openIdb(); await loadCache();
    try { await handleRedirect(); } catch (e) { showSignIn(e.message); return; }
    if (!tok()) { showSignIn(''); return; }
    if (isIdle()) { await autoSignOut(); return; }
    if (FOLDER() === null || (PROV === 'google' && !ls('cd.gfid'))) {
      try { await ensureWorkspace(); }
      catch (e) {
        if (e && e.renew) { await new Promise(function (r) { window.CD_gAfter = r; gBanner('Google needs you to confirm access before your folder can be opened.'); }); await ensureWorkspace(); }
        else { showSignIn('Could not open your ' + SNAME() + ' folder (' + (e && e.message || 'error') + '). Check your connection and sign in again.'); setTok(null); return; }
      }
    }
    startIdleWatch(); startLockWatch(); setTimeout(pinWarnMaybe, 2500);
    var o = $('mdSign'); if (o) o.remove();
    readyRes({ collection: collection });
    setState();
    flush(); pull();
    subs.appointments.push(function () { calSchedule(2000); }); calSchedule(5000); bkStart();
    var ro = ls('cd.reopen'); if (ro) { lset('cd.reopen', null); setTimeout(function () { toast('Confirmed. You can now make your changes.'); reopenTarget(ro); }, 1800); }
    var cn = ls('cd.calnote'); if (cn) { lset('cd.calnote', null); setTimeout(function () { toast(cn); }, 1500); }
    setInterval(function () { if (document.visibilityState === 'visible') { flush(); pull(); calSchedule(3000); } }, 60000);
    window.addEventListener('online', function () { st.offline = false; flush(); pull(); });
    window.addEventListener('offline', function () { st.offline = true; setState(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); else pull(); });
    window.addEventListener('pagehide', function () { flush(); });
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
  boot();
})();
