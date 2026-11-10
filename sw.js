/* Keeps the app available offline. Your case data is never stored here.
   Online: always fetches the newest files. Offline: uses the saved copy.
   Hosts such as Cloudflare Pages shorten addresses (home.html -> /home), so saved copies are stored without the
   "moved" step and can be found under either address. */
var CACHE = 'client-desk-v3';
var FILES = ['./', 'index.html', 'home.html', 'privacy.html', 'styles.css', 'app.js', 'sync.js', 'config.js', 'trades.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
/* a page that arrived after a redirect cannot be shown offline as it is: copy it into a plain response */
function plain(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(function (b) { return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }); });
}
function keyOf(u) { u = new URL(u, self.location.href); u.search = ''; u.hash = ''; return u.href; }
function save(c, req, res) {
  return plain(res).then(function (p) {
    var keys = [keyOf(req.url || req)];
    if (res.redirected && res.url) keys.push(keyOf(res.url));
    return Promise.all(keys.map(function (k) { return c.put(k, p.clone()); }));
  });
}
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      var req = new Request(f, { cache: 'reload' });
      return fetch(req).then(function (res) { if (!res.ok) throw new Error(f + ' ' + res.status); return save(c, req, res); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
/* offline: the page itself, the same page with or without .html, then the app's start page */
function offline(r) {
  var u = new URL(r.url), alt = /\.html$/.test(u.pathname) ? u.pathname.replace(/\.html$/, '') : (/\/$/.test(u.pathname) ? '' : u.pathname + '.html');
  var tries = [keyOf(r.url)]; if (alt) tries.push(new URL(alt, u).href);
  if (r.mode === 'navigate') tries.push(keyOf('./'), keyOf('index.html'));
  return caches.open(CACHE).then(function (c) {
    return tries.reduce(function (p, k) { return p.then(function (hit) { return hit || c.match(k); }); }, Promise.resolve(null));
  }).then(function (hit) { return hit ? plain(hit) : Response.error(); });
}
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /version\.json$/.test(u.pathname) || /^\/(api|admin)\//.test(u.pathname)) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var cp = res.clone(); caches.open(CACHE).then(function (c) { save(c, r, cp); }); }
    return res;
  }).catch(function () { return offline(r); }));
});
