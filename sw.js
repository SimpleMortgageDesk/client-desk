/* Keeps the app available offline. Your case data is never stored here.
   Online: always fetches the newest files. Offline: uses the saved copy.
   Hosts such as Cloudflare Pages shorten addresses (home.html -> /home), so saved copies are stored without the
   "moved" step and can be found under either address. */
var CACHE = 'client-desk-v7';
var FILES = [
  './',
  'index.html',
  'home.html',
  'privacy.html',
  'styles.css',
  'sync.js',
  'config.js',
  'trades.js',
  'js/app-core.js',
  'js/app-shell.js',
  'js/app-clients.js',
  'js/app-marketing.js',
  'js/app-tools.js',
  'js/app-events.js',
  'js/app-trade.js',
  'js/app-legal.js',
  'js/app-home.js',
  'js/app-agreements.js',
  'js/app-property.js',
  'js/app-rent.js',
  'js/app-receipts.js',
  'js/app-leases.js',
  'js/app-assets.js',
  'js/app-todo.js',
  'js/app-dates.js',
  'js/app-import.js',
  'js/app-start.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];
/* a page that arrived after a redirect cannot be shown offline as it is: copy it into a plain response */
function plain(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(function (b) {
    return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}
function keyOf(u) {
  u = new URL(u, self.location.href);
  u.search = '';
  u.hash = '';
  return u.href;
}
function save(c, req, res) {
  return plain(res).then(function (p) {
    var keys = [keyOf(req.url || req)];
    if (res.redirected && res.url) keys.push(keyOf(res.url));
    return Promise.all(
      keys.map(function (k) {
        return c.put(k, p.clone());
      })
    );
  });
}
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(function (c) {
        /* the start page names each script and style file with its current ?v= code: keep those exact copies, so the
           very next visit can use them without asking the server */
        return fetch('index.html', { cache: 'reload' })
          .then(function (r) {
            return r.text();
          })
          .catch(function () {
            return '';
          })
          .then(function (html) {
            var ver = {};
            (html.match(/(?:src|href)="[^"]+\.(?:js|css)\?v=[^"]+"/g) || []).forEach(function (m) {
              var u = m.replace(/^(?:src|href)="|"$/g, '');
              ver[keyOf(u)] = new URL(u, self.location.href).href;
            });
            return Promise.all(
              FILES.map(function (f) {
                var full = ver[keyOf(f)],
                  req = new Request(full || f, { cache: 'reload' });
                return fetch(req).then(function (res) {
                  if (!res.ok) throw new Error(f + ' ' + res.status);
                  if (full) c.put(full, res.clone());
                  return save(c, req, res);
                });
              })
            );
          });
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (ks) {
        return Promise.all(
          ks
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});
/* offline: the page itself, the same page with or without .html, then the app's start page */
function offline(r) {
  var u = new URL(r.url),
    alt = /\.html$/.test(u.pathname)
      ? u.pathname.replace(/\.html$/, '')
      : /\/$/.test(u.pathname)
        ? ''
        : u.pathname + '.html';
  var tries = [keyOf(r.url)];
  if (alt) tries.push(new URL(alt, u).href);
  if (r.mode === 'navigate') tries.push(keyOf('./'), keyOf('index.html'));
  return caches
    .open(CACHE)
    .then(function (c) {
      return tries.reduce(function (p, k) {
        return p.then(function (hit) {
          return hit || c.match(k);
        });
      }, Promise.resolve(null));
    })
    .then(function (hit) {
      return hit ? plain(hit) : Response.error();
    });
}
self.addEventListener('fetch', function (e) {
  var r = e.request,
    u = new URL(r.url);
  if (
    r.method !== 'GET' ||
    u.origin !== location.origin ||
    /version\.json$/.test(u.pathname) ||
    /^\/(api|admin)\//.test(u.pathname)
  )
    return;
  /* Our own script and style files carry a code that changes whenever their content changes (?v=...), so a saved copy
     with the same address is always the right one: use it straight away instead of asking the server first. */
  if (/\.(js|css)$/.test(u.pathname) && u.searchParams.get('v') && u.pathname.indexOf('/lib/') !== 0) {
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(r.url).then(function (hit) {
          if (hit) return hit;
          return fetch(r)
            .then(function (res) {
              if (res && res.ok && res.type === 'basic') {
                var cp = res.clone(),
                  cp2 = res.clone();
                c.put(r.url, cp);
                save(c, r, cp2);
                /* drop older copies of the same file */
                c.keys().then(function (ks) {
                  ks.forEach(function (k) {
                    var ku = new URL(k.url);
                    if (ku.pathname === u.pathname && ku.search && k.url !== r.url) c.delete(k);
                  });
                });
              }
              return res;
            })
            .catch(function () {
              return offline(r);
            });
        });
      })
    );
    return;
  }
  e.respondWith(
    fetch(r, { cache: 'no-cache' })
      .then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var cp = res.clone();
          caches.open(CACHE).then(function (c) {
            save(c, r, cp);
          });
        }
        return res;
      })
      .catch(function () {
        return offline(r);
      })
  );
});
