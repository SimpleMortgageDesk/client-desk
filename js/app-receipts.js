'use strict';
/* MySimpleDesk app: Photo scanning and receipts.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- scanning: every photo upload becomes ONE PDF, one page per photo, cropped to the document ---------- */
var scPages = [],
  scOpts = null,
  scWork = false,
  scSeq = 0;
function scIsImg(f) {
  return /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || '');
}
function scCanvas(w, h) {
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
/* decode a photo (turned the right way up) onto a canvas of at most 2400 px */
function scLoad(file) {
  return new Promise(function (res, rej) {
    var fin = function (src, w, h) {
      var k = Math.min(1, 2400 / Math.max(w, h)),
        cv = scCanvas(w * k, h * k),
        cx = cv.getContext('2d');
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(src, 0, 0, cv.width, cv.height);
      res(cv);
    };
    var viaImg = function () {
      var im = new Image(),
        u = URL.createObjectURL(file);
      im.onload = function () {
        URL.revokeObjectURL(u);
        fin(im, im.naturalWidth, im.naturalHeight);
      };
      im.onerror = function () {
        URL.revokeObjectURL(u);
        rej(new Error('decode'));
      };
      im.src = u;
    };
    if (window.createImageBitmap) {
      createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bm) {
        fin(bm, bm.width, bm.height);
        if (bm.close) bm.close();
      }, viaImg);
    } else viaImg();
  });
}
function scBlur(L, w, h) {
  var o = new Float32Array(L.length),
    x,
    y,
    xx,
    yy,
    s,
    c;
  for (y = 0; y < h; y++)
    for (x = 0; x < w; x++) {
      s = 0;
      c = 0;
      for (yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
        for (xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
          s += L[yy * w + xx];
          c++;
        }
      o[y * w + x] = s / c;
    }
  return o;
}
/* grow (max) or shrink (min) a 0/1 mask by r pixels, one direction at a time */
function scMorph(m, w, h, r, max) {
  var a = new Uint8Array(m.length),
    b = new Uint8Array(m.length),
    x,
    y,
    k,
    v;
  for (y = 0; y < h; y++)
    for (x = 0; x < w; x++) {
      v = max ? 0 : 1;
      for (k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
        if (max) {
          if (m[y * w + k]) {
            v = 1;
            break;
          }
        } else if (!m[y * w + k]) {
          v = 0;
          break;
        }
      }
      a[y * w + x] = v;
    }
  for (y = 0; y < h; y++)
    for (x = 0; x < w; x++) {
      v = max ? 0 : 1;
      for (k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
        if (max) {
          if (a[k * w + x]) {
            v = 1;
            break;
          }
        } else if (!a[k * w + x]) {
          v = 0;
          break;
        }
      }
      b[y * w + x] = v;
    }
  return b;
}
function scHull(pts) {
  pts.sort(function (a, b) {
    return a[0] - b[0] || a[1] - b[1];
  });
  var cross = function (o, a, b) {
      return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    },
    lo = [],
    up = [],
    i;
  for (i = 0; i < pts.length; i++) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop();
    lo.push(pts[i]);
  }
  for (i = pts.length - 1; i >= 0; i--) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop();
    up.push(pts[i]);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}
function scArea(p) {
  var s = 0,
    i,
    j;
  for (i = 0; i < p.length; i++) {
    j = (i + 1) % p.length;
    s += p[i][0] * p[j][1] - p[j][0] * p[i][1];
  }
  return Math.abs(s) / 2;
}
/* reduce a convex outline to its 4 corners by dropping the vertex that matters least, again and again */
function scFour(h) {
  var p = h.slice();
  while (p.length > 4) {
    var mi = 0,
      ma = 1e18,
      i,
      a,
      b,
      c,
      ar;
    for (i = 0; i < p.length; i++) {
      a = p[(i + p.length - 1) % p.length];
      b = p[i];
      c = p[(i + 1) % p.length];
      ar = Math.abs((a[0] - c[0]) * (b[1] - a[1]) - (a[0] - b[0]) * (c[1] - a[1])) / 2;
      if (ar < ma) {
        ma = ar;
        mi = i;
      }
    }
    p.splice(mi, 1);
  }
  return p;
}
/* find the document in a photo: returns its 4 corners (top-left, top-right, bottom-right, bottom-left) in photo pixels, or null when no clear document is found */
function scDetect(src) {
  try {
    var k = Math.min(1, 320 / Math.max(src.width, src.height)),
      w = Math.max(8, Math.round(src.width * k)),
      h = Math.max(8, Math.round(src.height * k)),
      sm = scCanvas(w, h),
      sx = sm.getContext('2d');
    sx.drawImage(src, 0, 0, w, h);
    var d = sx.getImageData(0, 0, w, h).data,
      n = w * h,
      L = new Float32Array(n),
      i;
    for (i = 0; i < n; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    L = scBlur(scBlur(L, w, h), w, h);
    /* paper is brighter than what is behind it: split the brightness at the best threshold (Otsu) */
    var hist = new Array(256).fill(0),
      sum = 0,
      wB = 0,
      sB = 0,
      best = -1,
      thr = 128,
      wF,
      mB,
      mF,
      v,
      gap = 0;
    for (i = 0; i < n; i++) hist[Math.min(255, L[i] | 0)]++;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      wF = n - wB;
      if (!wF) break;
      sB += i * hist[i];
      mB = sB / wB;
      mF = (sum - sB) / wF;
      v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) {
        best = v;
        thr = i;
        gap = mF - mB;
      }
    }
    if (gap < 22) return null;
    var m = new Uint8Array(n);
    for (i = 0; i < n; i++) m[i] = L[i] > thr ? 1 : 0;
    m = scMorph(scMorph(m, w, h, 3, true), w, h, 3, false); /* close the gaps left by printed text */
    var lab = new Int32Array(n),
      q = new Int32Array(n),
      cur = 0,
      bestLab = 0,
      bestN = 0,
      head,
      tail,
      p,
      x,
      y,
      cnt;
    for (i = 0; i < n; i++) {
      if (!m[i] || lab[i]) continue;
      cur++;
      head = 0;
      tail = 0;
      q[tail++] = i;
      lab[i] = cur;
      cnt = 0;
      while (head < tail) {
        p = q[head++];
        cnt++;
        x = p % w;
        y = (p - x) / w;
        if (x > 0 && m[p - 1] && !lab[p - 1]) {
          lab[p - 1] = cur;
          q[tail++] = p - 1;
        }
        if (x < w - 1 && m[p + 1] && !lab[p + 1]) {
          lab[p + 1] = cur;
          q[tail++] = p + 1;
        }
        if (y > 0 && m[p - w] && !lab[p - w]) {
          lab[p - w] = cur;
          q[tail++] = p - w;
        }
        if (y < h - 1 && m[p + w] && !lab[p + w]) {
          lab[p + w] = cur;
          q[tail++] = p + w;
        }
      }
      if (cnt > bestN) {
        bestN = cnt;
        bestLab = cur;
      }
    }
    var frac = bestN / n;
    if (frac < 0.12 || frac > 0.97) return null;
    var edge = [];
    for (i = 0; i < n; i++) {
      if (lab[i] !== bestLab) continue;
      x = i % w;
      y = (i - x) / w;
      if (
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        lab[i - 1] !== bestLab ||
        lab[i + 1] !== bestLab ||
        lab[i - w] !== bestLab ||
        lab[i + w] !== bestLab
      )
        edge.push([x, y]);
    }
    var hull = scHull(edge);
    if (hull.length < 4) return null;
    var quad = scFour(hull),
      ha = scArea(hull),
      qa = scArea(quad);
    if (qa < 0.82 * ha) return null; /* not a straight-sided sheet (crumpled or curved): do not guess */
    /* corners in the order top-left, top-right, bottom-right, bottom-left */
    var ti = 0,
      bs = 1e18;
    for (i = 0; i < 4; i++) {
      if (quad[i][0] + quad[i][1] < bs) {
        bs = quad[i][0] + quad[i][1];
        ti = i;
      }
    }
    quad = [quad[ti], quad[(ti + 1) % 4], quad[(ti + 2) % 4], quad[(ti + 3) % 4]];
    if (
      (quad[1][0] - quad[0][0]) * (quad[3][1] - quad[0][1]) -
        (quad[1][1] - quad[0][1]) * (quad[3][0] - quad[0][0]) <
      0
    )
      quad = [quad[0], quad[3], quad[2], quad[1]];
    var dist = function (a, b) {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
      },
      e = [dist(quad[0], quad[1]), dist(quad[1], quad[2]), dist(quad[2], quad[3]), dist(quad[3], quad[0])];
    if (Math.min.apply(null, e) < 0.15 * Math.max.apply(null, e)) return null;
    if (scArea(quad) > 0.95 * n) return null; /* the whole frame is not a document cut out of a background */
    var cx = 0,
      cy = 0;
    quad.forEach(function (pt) {
      cx += pt[0];
      cy += pt[1];
    });
    cx /= 4;
    cy /= 4;
    return quad.map(function (pt) {
      return [(cx + (pt[0] - cx) * 0.996) / k, (cy + (pt[1] - cy) * 0.996) / k];
    });
  } catch (e) {
    return null;
  }
}
/* solve the 8 numbers that map a rectangle onto the 4 corners (a perspective transform) */
function scSolve(A, b) {
  var n = b.length,
    i,
    j,
    k,
    t,
    f;
  for (i = 0; i < n; i++) {
    A[i].push(b[i]);
  }
  for (i = 0; i < n; i++) {
    k = i;
    for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[k][i])) k = j;
    t = A[i];
    A[i] = A[k];
    A[k] = t;
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (j = i + 1; j < n; j++) {
      f = A[j][i] / A[i][i];
      for (k = i; k <= n; k++) A[j][k] -= f * A[i][k];
    }
  }
  var x = new Array(n);
  for (i = n - 1; i >= 0; i--) {
    t = A[i][n];
    for (j = i + 1; j < n; j++) t -= A[i][j] * x[j];
    x[i] = t / A[i][i];
  }
  return x;
}
function scScale(src, maxSide) {
  var k = Math.min(1, maxSide / Math.max(src.width, src.height)),
    c = scCanvas(src.width * k, src.height * k),
    x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
/* cut the document out of the photo and straighten it */
function scWarp(src, q, maxSide) {
  var dist = function (a, b) {
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    },
    W = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2,
    H = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2,
    k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(2, Math.round(W * k));
  H = Math.max(2, Math.round(H * k));
  var D = [
      [0, 0],
      [W, 0],
      [W, H],
      [0, H]
    ],
    A = [],
    b = [],
    i;
  for (i = 0; i < 4; i++) {
    var u = D[i][0],
      v = D[i][1],
      x = q[i][0],
      y = q[i][1];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  var s = scSolve(A, b);
  if (!s) return scScale(src, maxSide);
  var sw = src.width,
    sh = src.height,
    sd = src.getContext('2d').getImageData(0, 0, sw, sh).data,
    out = scCanvas(W, H),
    ox = out.getContext('2d'),
    od = ox.createImageData(W, H),
    o = od.data,
    xx,
    yy,
    den,
    fx,
    fy,
    x0,
    y0,
    dx,
    dy,
    p0,
    p1,
    p2,
    p3,
    c,
    t;
  for (yy = 0; yy < H; yy++)
    for (xx = 0; xx < W; xx++) {
      den = s[6] * (xx + 0.5) + s[7] * (yy + 0.5) + 1;
      fx = (s[0] * (xx + 0.5) + s[1] * (yy + 0.5) + s[2]) / den - 0.5;
      fy = (s[3] * (xx + 0.5) + s[4] * (yy + 0.5) + s[5]) / den - 0.5;
      if (fx < 0) fx = 0;
      else if (fx > sw - 1.001) fx = sw - 1.001;
      if (fy < 0) fy = 0;
      else if (fy > sh - 1.001) fy = sh - 1.001;
      x0 = fx | 0;
      y0 = fy | 0;
      dx = fx - x0;
      dy = fy - y0;
      p0 = (y0 * sw + x0) * 4;
      p1 = p0 + 4;
      p2 = p0 + sw * 4;
      p3 = p2 + 4;
      t = (yy * W + xx) * 4;
      for (c = 0; c < 3; c++)
        o[t + c] =
          (sd[p0 + c] * (1 - dx) + sd[p1 + c] * dx) * (1 - dy) +
          (sd[p2 + c] * (1 - dx) + sd[p3 + c] * dx) * dy;
      o[t + 3] = 255;
    }
  ox.putImageData(od, 0, 0);
  return out;
}
/* the finished page: cropped (or whole photo), then turned */
function scMake(pg, maxSide) {
  var c = pg.crop && pg.quad ? scWarp(pg.src, pg.quad, maxSide) : scScale(pg.src, maxSide),
    r,
    d,
    x;
  for (r = 0; r < pg.rot; r++) {
    d = scCanvas(c.height, c.width);
    x = d.getContext('2d');
    x.translate(d.width, 0);
    x.rotate(Math.PI / 2);
    x.drawImage(c, 0, 0);
    c = d;
  }
  return c;
}
/* a PDF with one JPEG page per picture; each page has the shape of its picture */
function scPdf(pages) {
  var enc = new TextEncoder(),
    chunks = [],
    off = 0,
    xref = [],
    n = pages.length,
    i;
  var put = function (x) {
    var b = typeof x === 'string' ? enc.encode(x) : x;
    chunks.push(b);
    off += b.length;
  };
  var obj = function (id, fn) {
    xref[id] = off;
    put(id + ' 0 obj\n');
    fn();
    put('\nendobj\n');
  };
  put(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));
  var kids = [];
  for (i = 0; i < n; i++) kids.push(3 + 3 * i + ' 0 R');
  obj(1, function () {
    put('<< /Type /Catalog /Pages 2 0 R >>');
  });
  obj(2, function () {
    put('<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>');
  });
  pages.forEach(function (p, i) {
    var k = 842 / Math.max(p.w, p.h),
      W = (p.w * k).toFixed(2),
      H = (p.h * k).toFixed(2),
      cs = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
    obj(3 + 3 * i, function () {
      put(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
          W +
          ' ' +
          H +
          '] /Resources << /XObject << /Im0 ' +
          (5 + 3 * i) +
          ' 0 R >> >> /Contents ' +
          (4 + 3 * i) +
          ' 0 R >>'
      );
    });
    obj(4 + 3 * i, function () {
      put('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    });
    obj(5 + 3 * i, function () {
      put(
        '<< /Type /XObject /Subtype /Image /Width ' +
          p.w +
          ' /Height ' +
          p.h +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
          p.jpeg.length +
          ' >>\nstream\n'
      );
      put(p.jpeg);
      put('\nendstream');
    });
  });
  var xo = off,
    total = 3 + 3 * n;
  put('xref\n0 ' + total + '\n0000000000 65535 f \n');
  for (i = 1; i < total; i++) put(String(xref[i]).padStart(10, '0') + ' 00000 n \n');
  put('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xo + '\n%%EOF');
  return new Blob(chunks, { type: 'application/pdf' });
}

/* the page sheet: shows each page, lets people crop, turn, reorder, remove or add pages, then saves one PDF */
var scTok = 0,
  scSaving = false;
function scThumb(pg) {
  return scMake(pg, 220).toDataURL('image/jpeg', 0.72);
}
function scReset() {
  scTok++;
  scPages = [];
  scOpts = null;
  scWork = false;
  scSaving = false;
  closeOv('scOv');
}
function scRowHtml(pg, i, n, dis) {
  var st = pg.quad
    ? pg.crop
      ? 'Cropped to the document'
      : 'Whole photo'
    : 'Whole photo (no document found)';
  return (
    '<li data-scp="' +
    pg.id +
    '"><img src="' +
    pg.thumb +
    '" alt="Page ' +
    (i + 1) +
    '"><div class="scrow"><b>Page ' +
    (i + 1) +
    '</b><span class="muted">' +
    st +
    '</span><div class="scbtns">' +
    (pg.quad
      ? '<button type="button" class="btn ghost sm"' +
        dis +
        ' data-scact="crop">' +
        (pg.crop ? 'Use whole photo' : 'Crop to document') +
        '</button>'
      : '') +
    '<button type="button" class="btn ghost sm"' +
    dis +
    ' data-scact="rot">Rotate</button>' +
    (i > 0 ? '<button type="button" class="btn ghost sm"' + dis + ' data-scact="up">Earlier</button>' : '') +
    (i < n - 1
      ? '<button type="button" class="btn ghost sm"' + dis + ' data-scact="down">Later</button>'
      : '') +
    '<button type="button" class="btn ghost sm"' +
    dis +
    ' data-scact="rm">Remove</button></div></div></li>'
  );
}
var scName = '';
function scDraw(msg) {
  var n = scPages.length,
    touch = dzTouch(),
    dis = scWork ? ' disabled' : '';
  overlay(
    'scOv',
    '<div class="dhd"><h2>Save as one PDF</h2></div>' +
      '<p class="muted" style="margin:4px 0 10px">Each photo becomes a page. The app finds the document in each photo and crops it. Add more pages for a longer document, then save.</p>' +
      (scOpts && scOpts.dest
        ? '<p class="scdest"><b>Will be saved to:</b> ' + esc(scOpts.dest) + '</p>'
        : '') +
      (scOpts && scOpts.ask
        ? '<label class="f" style="margin:0 0 10px">' +
          esc(scOpts.ask) +
          ' <span class="muted">(optional, becomes the file name)</span><input id="scName" type="text" maxlength="80" autocomplete="off" placeholder="' +
          esc(scOpts.hint || '') +
          '" value="' +
          esc(scName) +
          '"' +
          (scSaving ? ' disabled' : '') +
          '></label>'
        : '') +
      (msg
        ? '<p class="rcmsg" role="status"><span class="rcspin" aria-hidden="true"></span>' + esc(msg) + '</p>'
        : '') +
      (n
        ? '<ul class="sclist">' +
          scPages
            .map(function (p, i) {
              return scRowHtml(p, i, n, dis);
            })
            .join('') +
          '</ul>'
        : '') +
      '<div class="add" style="margin:8px 0">' +
      (touch
        ? '<button type="button" class="btn ghost"' +
          dis +
          ' data-scadd="camera">Take another photo</button><button type="button" class="btn ghost"' +
          dis +
          ' data-scadd="file">Add from files</button>'
        : '<button type="button" class="btn ghost"' + dis + ' data-scadd="file">Add more photos</button>') +
      '</div>' +
      '<div class="add" style="justify-content:flex-end;margin:6px 0 0"><button type="button" class="btn ghost" data-sccancel="1"' +
      (scSaving ? ' disabled' : '') +
      '>Cancel</button><button type="button" class="btn" data-scsave="1"' +
      (n && !scWork ? '' : ' disabled') +
      '>Save as PDF' +
      (n ? ' · ' + n + ' page' + (n === 1 ? '' : 's') : '') +
      '</button></div>'
  );
}
document.addEventListener('input', function (e) {
  if (e.target && e.target.id === 'scName') scName = e.target.value;
});
function scOpen(o) {
  scTok++;
  scOpts = o;
  scName = o.name || '';
  scPages = [];
  scSaving = false;
  scAdd(o.files, true);
}
function scAdd(files, first) {
  var tok = scTok,
    list = files.slice(0, Math.max(0, 20 - scPages.length)),
    bad = 0,
    last = null,
    only = !!first && list.length === 1;
  if (files.length > list.length) toast('A PDF can have up to 20 pages.');
  scWork = true;
  scDraw('Reading the photo' + (list.length > 1 ? 's' : '') + '…');
  (function next() {
    if (tok !== scTok) return;
    var f = list.shift();
    if (!f) {
      scWork = false;
      if (!scPages.length) {
        var o = scOpts;
        scReset();
        if (o && only && last && o.fallback) {
          toast('This photo could not be turned into a PDF, so it is saved as a picture.');
          o.fallback(last);
        } else toast('Could not read the photo. Try again.');
        return;
      }
      if (bad)
        toast(
          bad +
            ' photo' +
            (bad === 1 ? '' : 's') +
            ' could not be read and ' +
            (bad === 1 ? 'was' : 'were') +
            ' left out.'
        );
      scDraw();
      return;
    }
    last = f;
    scLoad(f).then(
      function (cv) {
        if (tok !== scTok) return;
        var pg = { id: ++scSeq, src: cv, quad: scDetect(cv), rot: 0 };
        pg.crop = !!pg.quad;
        pg.thumb = scThumb(pg);
        scPages.push(pg);
        setTimeout(next, 0);
      },
      function () {
        bad++;
        setTimeout(next, 0);
      }
    );
  })();
}
function scMore(mode) {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.id = 'scFile';
  inp.accept = 'image/*';
  inp.style.display = 'none';
  if (mode === 'camera') inp.setAttribute('capture', 'environment');
  else inp.multiple = true;
  var old = $('#scFile');
  if (old) old.remove();
  document.body.appendChild(inp);
  inp.addEventListener('change', function () {
    var fs = [].slice.call(inp.files || []).filter(scIsImg);
    inp.remove();
    if (fs.length) scAdd(fs, false);
  });
  inp.click();
}
function scSave() {
  if (scWork || scSaving || !scPages.length || !scOpts) return;
  scWork = true;
  scSaving = true;
  scDraw('Making the PDF…');
  var o = scOpts,
    pages = scPages.slice(),
    parts = [],
    chain = Promise.resolve();
  setTimeout(function () {
    pages.forEach(function (pg) {
      chain = chain.then(function () {
        var c = scMake(pg, 2400);
        return new Promise(function (res, rej) {
          c.toBlob(
            function (b) {
              if (!b) {
                rej(new Error('jpeg'));
                return;
              }
              b.arrayBuffer().then(function (ab) {
                parts.push({ w: c.width, h: c.height, jpeg: new Uint8Array(ab) });
                c.width = c.height = 1;
                res();
              }, rej);
            },
            'image/jpeg',
            0.82
          );
        });
      });
    });
    chain
      .then(function () {
        var nm = o.ask ? pfClean(scName, 80) : '',
          f = new File([scPdf(parts)], (nm || 'Scan') + '.pdf', { type: 'application/pdf' }),
          th = pages[0].thumb;
        scReset();
        o.done(f, th, !!nm);
      })
      .catch(function () {
        scWork = false;
        scSaving = false;
        scDraw();
        toast('Could not make the PDF. Try again.');
      });
  }, 60);
}
document.addEventListener('click', function (e) {
  var b =
    e.target && e.target.closest
      ? e.target.closest('[data-scact],[data-scadd],[data-scsave],[data-sccancel]')
      : null;
  if (!b || !b.closest('#scOv')) return;
  e.preventDefault();
  if (b.hasAttribute('data-sccancel')) {
    if (!scSaving) scReset();
    return;
  }
  if (b.hasAttribute('data-scsave')) {
    scSave();
    return;
  }
  if (scWork) return;
  if (b.hasAttribute('data-scadd')) {
    scMore(b.getAttribute('data-scadd'));
    return;
  }
  var li = b.closest('li'),
    id = li && +li.getAttribute('data-scp'),
    i = -1;
  scPages.forEach(function (p, x) {
    if (p.id === id) i = x;
  });
  if (i < 0) return;
  var a = b.getAttribute('data-scact'),
    pg = scPages[i],
    t;
  if (a === 'crop') {
    pg.crop = !pg.crop;
    pg.thumb = scThumb(pg);
  } else if (a === 'rot') {
    pg.rot = (pg.rot + 1) % 4;
    pg.thumb = scThumb(pg);
  } else if (a === 'up' && i > 0) {
    t = scPages[i - 1];
    scPages[i - 1] = pg;
    scPages[i] = t;
  } else if (a === 'down' && i < scPages.length - 1) {
    t = scPages[i + 1];
    scPages[i + 1] = pg;
    scPages[i] = t;
  } else if (a === 'rm') {
    scPages.splice(i, 1);
  }
  scDraw();
});

/* ---------- receipts: photograph or upload a receipt, saved in the property's Receipts folder ---------- */
var rcPend = null,
  rcFor = null,
  rcBusy = false,
  rcMsg = '',
  rcThumb = '',
  rcListOpen = false;
function rcUrl(u) {
  u = String(u || '');
  return /^(https:\/\/|blob:)/.test(u) ? u : '';
}
function rcCase() {
  return exSubj(exCase);
}
function rcBox(c) {
  var touch = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches),
    w = window.CD_files ? window.CD_files.where() : 'file storage';
  return (
    '<div class="rcbox"><div class="rchd"><b>Receipt</b><span class="muted">Photograph it or choose photos. They are saved as one PDF in a folder called Receipts, inside this ' +
    (T.tenancyMode || !T.jobDocs ? 'property' : dzNoun()) +
    "'s folder in your " +
    esc(w) +
    '.</span></div>' +
    '<div class="add" style="margin:8px 0 0">' +
    (touch ? '<button type="button" class="btn" data-rcpick="camera">Take photo of receipt</button>' : '') +
    '<button type="button" class="btn' +
    (touch ? ' ghost' : '') +
    '" data-rcpick="file">Upload receipt</button><button type="button" class="btn ghost" data-rcopen="1" aria-expanded="' +
    (rcListOpen ? 'true' : 'false') +
    '">Open receipt</button></div>' +
    '<div id="rcState" role="status" aria-live="polite">' +
    rcStateHtml() +
    '</div><div id="rcList">' +
    rcListHtml(c) +
    '</div></div>'
  );
}
function rcStateHtml() {
  if (rcBusy)
    return (
      '<p class="rcmsg"><span class="rcspin" aria-hidden="true"></span>' + esc(rcMsg || 'Saving…') + '</p>'
    );
  if (rcPend) {
    var u = rcUrl(rcPend.url);
    return (
      '<div class="rcatt">' +
      (rcThumb ? '<img src="' + rcThumb + '" alt="Photo of the receipt">' : '') +
      '<div><b>Receipt saved</b><span class="muted">' +
      esc(rcPend.name) +
      '</span><span>' +
      (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">Show receipt</a>' : '') +
      '<button type="button" class="rclink" ' +
      (rcPend.id
        ? 'data-rcdel="' + esc(rcPend.id) + '" title="Deletes the receipt file and takes it off your list."'
        : 'data-rcrm="1" title="Removes the link from this expense."') +
      '>Delete</button></span></div></div>'
    );
  }
  return rcMsg ? '<p class="rcmsg err">' + esc(rcMsg) + '</p>' : '';
}
function rcListHtml(c) {
  if (!rcListOpen) return '';
  var rs = ((c && c.receipts) || []).slice().sort(function (a, b) {
      return (b.at || 0) - (a.at || 0);
    }),
    ex = (c && c.expenses) || [];
  if (!rs.length) return '<p class="muted rcnone">No receipts have been uploaded for this property yet.</p>';
  return (
    '<ul class="rclist">' +
    rs
      .map(function (r) {
        var e = ex.filter(function (x) {
            return x.receipt && (x.receipt.fid ? x.receipt.fid === r.fid : x.receipt.url === r.url);
          })[0],
          u = rcUrl(r.url);
        var info = e
          ? esc([e.desc || e.cat, gbp(e.amount)].filter(Boolean).join(' · '))
          : 'Not linked to an expense yet';
        return (
          '<li><div class="rcrow"><b>' +
          esc(r.name) +
          '</b><span class="muted">' +
          (r.at ? 'Added ' + esc(fd(iso(new Date(r.at)))) + ' · ' : '') +
          info +
          '</span></div><div class="rcact">' +
          (u ? '<a class="btn ghost sm" href="' + esc(u) + '" target="_blank" rel="noopener">Open</a>' : '') +
          (!e && !(rcPend && rcPend.id === r.id)
            ? '<button type="button" class="btn ghost sm" data-rcuse="' +
              esc(r.id) +
              '">Use for this expense</button>'
            : '') +
          '<button type="button" class="btn ghost sm danger" data-rcdel="' +
          esc(r.id) +
          '">Delete</button></div></li>'
        );
      })
      .join('') +
    '</ul>'
  );
}
function rcDraw(cc) {
  var s = $('#rcState');
  if (s) s.innerHTML = rcStateHtml();
  var l = $('#rcList');
  if (l) l.innerHTML = rcListHtml(cc || rcCase());
  var o = document.querySelector('[data-rcopen]');
  if (o) o.setAttribute('aria-expanded', rcListOpen ? 'true' : 'false');
}
/* phone photos are large: shrink them to a clear 2400 px JPEG before saving (PDFs and anything that cannot be read are saved as they are) */
function rcPrep(file) {
  return new Promise(function (res) {
    var orig = { blob: file, ext: '' };
    if (!/^image\//.test(file.type || '') || /svg|gif/.test(file.type)) return res(orig);
    var draw = function (src, w, h) {
      try {
        var k = Math.min(1, 2400 / Math.max(w, h)),
          cw = Math.max(1, Math.round(w * k)),
          ch = Math.max(1, Math.round(h * k)),
          cv = document.createElement('canvas');
        cv.width = cw;
        cv.height = ch;
        var cx = cv.getContext('2d');
        cx.fillStyle = '#fff';
        cx.fillRect(0, 0, cw, ch);
        cx.drawImage(src, 0, 0, cw, ch);
        cv.toBlob(
          function (b) {
            res(b && (b.size < file.size || file.size > 1500000) ? { blob: b, ext: '.jpg' } : orig);
          },
          'image/jpeg',
          0.82
        );
      } catch (e) {
        res(orig);
      }
    };
    var viaImg = function () {
      var im = new Image(),
        u = URL.createObjectURL(file);
      im.onload = function () {
        URL.revokeObjectURL(u);
        draw(im, im.naturalWidth, im.naturalHeight);
      };
      im.onerror = function () {
        URL.revokeObjectURL(u);
        res(orig);
      };
      im.src = u;
    };
    if (window.createImageBitmap) {
      createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bm) {
        draw(bm, bm.width, bm.height);
      }, viaImg);
    } else viaImg();
  });
}
function rcPick(mode) {
  var c = rcCase();
  if (!c) return;
  if (!window.CD_files || !window.CD_files.can()) {
    rcMsg = 'Could not reach your file storage. Check you are online, then try again.';
    rcDraw();
    return;
  }
  if (rcBusy) {
    toast('Still saving the last receipt. Try again in a moment.');
    return;
  }
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.id = 'rcFile';
  inp.style.display = 'none';
  if (mode === 'camera') {
    inp.accept = 'image/*';
    inp.setAttribute('capture', 'environment');
  } else {
    inp.accept = 'image/*,application/pdf';
    inp.multiple = true;
  }
  var old = $('#rcFile');
  if (old) old.remove();
  document.body.appendChild(inp);
  var subj = exCase;
  inp.addEventListener('change', function () {
    var files = [].slice.call(inp.files || []);
    inp.remove();
    if (!files.length) return;
    var imgs = files.filter(scIsImg);
    if (imgs.length) {
      if (imgs.length < files.length) toast('Only the photos were used. Upload a PDF on its own.');
      scOpen({
        files: imgs,
        source: mode === 'camera' ? 'camera' : 'file',
        dest: rcDest(subj),
        ask: 'Receipt name',
        hint: 'For example: Boiler repair',
        name: (($('#ex-desc') || {}).value || '').trim(),
        done: function (f, th, named) {
          rcSend(subj, f, th, named);
        },
        fallback: function (f) {
          rcSend(subj, f);
        }
      });
    } else if (files.length > 1) toast('Choose one PDF at a time.');
    else rcSend(subj, files[0]);
  });
  inp.click();
}
function rcDest(caseId) {
  var c = exSubj(caseId),
    home = caseId === HOME_ID,
    w = (window.CD_files && window.CD_files.where && window.CD_files.where()) || 'your storage',
    folder = c
      ? (c.folder && c.folder.name) ||
        (home ? pfClean(String(c.addr1 || '').split(/[\n,]/)[0]) || 'My home' : pfName(c))
      : '';
  return w + ' › ' + (home ? 'Home' : dzRootL()) + ' › ' + folder + ' › Receipts';
}
function rcSend(caseId, file, thumb, named) {
  var c = exSubj(caseId);
  if (!c) return;
  if (!file.size) {
    rcMsg = 'That file is empty.';
    rcDraw();
    return;
  }
  rcBusy = true;
  rcMsg = 'Preparing the photo…';
  rcDraw();
  rcPrep(file)
    .then(function (p) {
      var blob = p.blob,
        ext = p.ext || (/\.[A-Za-z0-9]{1,8}$/.exec(file.name) || [''])[0].toLowerCase() || '.jpg';
      if (blob.size > window.CD_files.max) throw { big: true };
      var d = new Date(),
        z = function (n) {
          return String(n).padStart(2, '0');
        },
        dt = ($('#ex-date') || {}).value || iso(TODAY),
        fname = named
          ? 'Receipt ' +
            dt +
            ' ' +
            pfClean(file.name.replace(/\.[A-Za-z0-9]{1,8}$/, ''), 60) +
            ' ' +
            z(d.getHours()) +
            z(d.getMinutes()) +
            ext
          : 'Receipt ' + dt + ' ' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds()) + ext,
        home = caseId === HOME_ID,
        folder =
          (c.folder && c.folder.name) ||
          (home ? pfClean(String(c.addr1 || '').split(/[\n,]/)[0]) || 'My home' : pfName(c));
      rcMsg = 'Saving to your ' + window.CD_files.where() + '…';
      rcDraw();
      return window.CD_files.upload(folder, fname, blob, 'Receipts', home ? 'Home' : dzRoot()).then(
        function (res) {
          return { res: res, blob: blob };
        }
      );
    })
    .then(function (o) {
      rcBusy = false;
      if (rcThumb) {
        try {
          URL.revokeObjectURL(rcThumb);
        } catch (x) {}
        rcThumb = '';
      }
      if (thumb) rcThumb = thumb;
      else if (/^image\//.test(o.blob.type || '')) {
        try {
          rcThumb = URL.createObjectURL(o.blob);
        } catch (x) {}
      }
      var rec = {
        id: 'r' + uid(),
        name: o.res.name,
        url: o.res.url,
        fid: o.res.id,
        size: o.blob.size,
        at: Date.now()
      };
      rcPend = rec;
      rcMsg = '';
      rcListOpen = false;
      var cur = exSubj(caseId) || c,
        up = { receipts: (cur.receipts || []).concat([rec]) };
      if (o.res.folder && o.res.folder.name && !(cur.folder && cur.folder.url)) up.folder = o.res.folder;
      exPatch(caseId, up);
      rcDraw(Object.assign({}, cur, up));
      if (named) {
        var dsc = $('#ex-desc');
        if (dsc && !dsc.value) dsc.value = file.name.replace(/\.[A-Za-z0-9]{1,8}$/, '');
      }
      toast('Receipt saved. Add the amount, then press Add expense.');
      var a = $('#ex-amt');
      if (a) a.focus();
    })
    .catch(function (e) {
      Promise.resolve(e && e.bodyP)
        .catch(function () {})
        .then(function () {
          rcBusy = false;
          rcMsg = e && e.big ? 'That file is over 50 MB. Choose a smaller one.' : dzErr(e);
          rcDraw();
        });
    });
}
document.addEventListener('click', function (e) {
  var b =
    e.target && e.target.closest
      ? e.target.closest('[data-rcpick],[data-rcrm],[data-rcdel],[data-rcopen],[data-rcuse]')
      : null;
  if (!b || !b.closest('#exOv')) return;
  e.preventDefault();
  if (b.hasAttribute('data-rcpick')) {
    rcPick(b.getAttribute('data-rcpick'));
    return;
  }
  if (b.hasAttribute('data-rcrm')) {
    rcPend = null;
    rcMsg = '';
    rcDraw();
    return;
  }
  if (b.hasAttribute('data-rcdel')) {
    var rid = b.getAttribute('data-rcdel'),
      c0 = rcCase(),
      r0 =
        c0 &&
        (c0.receipts || []).filter(function (x) {
          return x.id === rid;
        })[0];
    if (!r0) {
      rcPend = null;
      rcMsg = '';
      rcDraw();
      return;
    }
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Delete?';
      return;
    }
    toast('Deleting…', true);
    fileDelete(r0.fid).then(function (res) {
      if (res === 'offline' || res === 'fail') {
        toast(delFailMsg(res));
        b.classList.remove('armed');
        b.textContent = 'Delete';
        return;
      }
      var c1 = rcCase() || c0,
        nr = (c1.receipts || []).filter(function (x) {
          return x.id !== rid;
        }),
        ne = (c1.expenses || []).map(function (x) {
          var q = x.receipt;
          return q && (q.id === rid || (q.fid && q.fid === r0.fid) || (q.url && q.url === r0.url))
            ? Object.assign({}, x, { receipt: null })
            : x;
        });
      if (rcPend && rcPend.id === rid) rcPend = null;
      exPatch(exCase, { receipts: nr, expenses: ne });
      toast(delTell(res));
      setTimeout(function () {
        expOpen(exCase, exEdit);
      }, 60);
    });
    return;
  }
  if (b.hasAttribute('data-rcopen')) {
    rcListOpen = !rcListOpen;
    rcDraw();
    return;
  }
  var c = rcCase(),
    r =
      c &&
      (c.receipts || []).filter(function (x) {
        return x.id === b.getAttribute('data-rcuse');
      })[0];
  if (r) {
    if (rcThumb) {
      try {
        URL.revokeObjectURL(rcThumb);
      } catch (x) {}
      rcThumb = '';
    }
    rcPend = Object.assign({}, r);
    rcListOpen = false;
    rcMsg = '';
    rcDraw();
    var a = $('#ex-amt');
    if (a) a.focus();
  }
});
function expOpen(caseId, editId) {
  var c = exSubj(caseId);
  if (!c) return;
  if (caseId !== exCase) editId = null;
  exCase = caseId;
  exEdit = editId || null;
  var ed = exEdit
    ? (c.expenses || []).filter(function (x) {
        return x.id === exEdit;
      })[0] || null
    : null;
  if (!ed) exEdit = null;
  var rk = caseId + ':' + (exEdit || 'new');
  if (rcFor !== rk) {
    rcFor = rk;
    rcPend = ed ? ed.receipt || null : null;
    rcMsg = '';
    rcListOpen = false;
    if (rcThumb) {
      try {
        URL.revokeObjectURL(rcThumb);
      } catch (x) {}
      rcThumb = '';
    }
  }
  var l = expList(c),
    ty = taxYear(iso(TODAY)),
    tyTot = l
      .filter(function (e) {
        return e.date >= ty.from && e.date <= ty.to;
      })
      .reduce(function (a, e) {
        return a + (+e.amount || 0);
      }, 0);
  overlay(
    'exOv',
    '<div class="dhd"><h2>Receipts and expenses · ' +
      esc(caseId === HOME_ID ? 'My residential house · ' + short(c.addr1) : names(c)) +
      '</h2><button type="button" class="btn" data-exclose="1">Save and close</button></div>' +
      '<p class="muted" style="margin:4px 0 10px">Tax year ' +
      ty.label +
      ' so far: <b>' +
      gbp(tyTot) +
      '</b> · ' +
      l.length +
      ' expense' +
      (l.length === 1 ? '' : 's') +
      ' in total. ' +
      (caseId === HOME_ID
        ? 'These are kept apart from your rental properties and are not in the rent and expenses report.'
        : T.tenancyMode
          ? 'These go into the rent and expenses report for your accountant (Reports and agreements).'
          : 'What you spent on this ' + dzNoun() + ', with the receipts.') +
      '</p>' +
      rcBox(c) +
      (ed
        ? '<p style="margin:0 0 6px;font-weight:600">Editing the expense from ' + fd(ed.date) + '</p>'
        : '') +
      '<div class="exadd grid' +
      (ed ? ' editing' : '') +
      '"><label class="f">Date<input id="ex-date" type="date" value="' +
      (ed ? esc(ed.date) : iso(TODAY)) +
      '"></label><label class="f">Category<select id="ex-cat">' +
      exCats(caseId)
        .concat(ed && exCats(caseId).indexOf(ed.cat) < 0 && ed.cat ? [ed.cat] : [])
        .map(function (k) {
          return '<option' + (ed && ed.cat === k ? ' selected' : '') + '>' + esc(k) + '</option>';
        })
        .join('') +
      '</select></label>' +
      '<label class="f">Amount<span class="ig"><i>£</i><input id="ex-amt" type="number" step="any" inputmode="decimal" value="' +
      (ed ? esc(ed.amount) : '') +
      '"></span></label><label class="f">Paid to<input id="ex-to" placeholder="Supplier or tradesperson" value="' +
      (ed ? esc(ed.to || '') : '') +
      '"></label>' +
      '<label class="f wide">Description<input id="ex-desc" placeholder="' +
      (T.tenancyMode
        ? 'For example: boiler repair, annual landlord insurance'
        : 'For example: fan, gasket, flue parts') +
      '" value="' +
      (ed ? esc(ed.desc || '') : '') +
      '"></label></div>' +
      '<div class="add" style="margin:6px 0 12px"><button type="button" class="btn" data-exadd="1">' +
      (ed ? 'Save changes' : 'Add expense') +
      '</button>' +
      (ed ? '<button type="button" class="btn ghost" data-excancel="1">Cancel edit</button>' : '') +
      '<span class="muted" style="font-size:12px;align-self:center">Do not type bank or card numbers here.</span></div>' +
      (l.length
        ? '<div class="tw"><table class="extab"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid to</th><th>Amount</th><th>Receipt</th><th></th></tr></thead><tbody>' +
          l
            .map(function (e) {
              return (
                '<tr><td>' +
                fd(e.date) +
                '</td><td>' +
                esc(e.cat || '') +
                '</td><td>' +
                esc(e.desc || '') +
                '</td><td>' +
                esc(e.to || '') +
                '</td><td class="num">' +
                gbp(e.amount) +
                '</td><td>' +
                (e.receipt && rcUrl(e.receipt.url)
                  ? '<a class="doclink" href="' + esc(e.receipt.url) + '" target="_blank" rel="noopener">Show</a>'
                  : '<span class="muted">—</span>') +
                '</td><td class="exact"><button type="button" class="exed" data-exedit="' +
                esc(e.id) +
                '">Edit</button><button type="button" class="x" data-exdel="' +
                esc(e.id) +
                '" aria-label="Delete expense">×</button></td></tr>'
              );
            })
            .join('') +
          '</tbody></table></div>'
        : '<p class="muted">No receipts or expenses recorded for this property yet.</p>'),
    true
  );
}
/* report */
function gnRange(k) {
  var t = iso(TODAY),
    ty = taxYear(t);
  if (k === 'lasttax') {
    var ly = taxYear(addDays(ty.from, -1));
    return [ly.from, ly.to];
  }
  if (k === 'thistax') return [ty.from, t];
  if (k === 'lastcal') {
    var y = TODAY.getFullYear() - 1;
    return [y + '-01-01', y + '-12-31'];
  }
  if (k === 'thiscal') return [TODAY.getFullYear() + '-01-01', t];
  return null;
}
function ACC() {
  var a = BIZ.accountant || {};
  return {
    name: a.name || '',
    phone: a.phone || '',
    email: a.email || BIZ.accountantEmail || '',
    address: a.address || ''
  };
}
function accOpen(back) {
  var a = ACC();
  overlay(
    'accOv',
    '<div class="dhd"><h2>Your accountant</h2><button type="button" class="btn ghost" data-accclose="1">Close</button></div>' +
      '<p class="muted" style="margin:4px 0 10px">Used for the rent and expenses report: their name and address go on the report, and "Email to my accountant" sends it to this email.</p>' +
      '<div class="grid"><label class="f">Name<input id="acc-name" value="' +
      esc(a.name) +
      '" placeholder="Accountant or firm name"></label>' +
      '<label class="f">Phone<input id="acc-phone" type="tel" value="' +
      esc(a.phone) +
      '"><span class="cl">' +
      plinks(a.phone) +
      '</span></label>' +
      '<label class="f">Email address<input id="acc-email" type="email" value="' +
      esc(a.email) +
      '"><span class="cl">' +
      elinks(a.email) +
      '</span></label>' +
      '<label class="f wide">Address<textarea id="acc-address" rows="3">' +
      esc(a.address) +
      '</textarea></label></div>' +
      '<p id="accMsg" class="muted" style="color:#b42318;min-height:1em"></p><div class="add"><button type="button" class="btn" data-accsave="' +
      (back ? 'gn' : '1') +
      '">Save accountant</button></div>'
  );
}
function accSave(back) {
  var g = function (k) {
      var e = $('#acc-' + k);
      return e ? e.value.trim() : '';
    },
    d = { name: g('name'), phone: g('phone'), email: g('email'), address: g('address') };
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    $('#accMsg').textContent = 'Check the email address.';
    return;
  }
  var nb = Object.assign({}, BIZ, { accountant: d });
  delete nb.accountantEmail;
  BIZ = nb;
  if (setCol)
    write('set-biz', function () {
      return setCol.doc('business').set(nb);
    });
  closeOv('accOv');
  toast('Accountant saved');
  if ($('#gnOv')) {
    gnAccRender();
    gnPreview();
  }
}
window.CD_openAcc = function () {
  accOpen(false);
};
function gnAccRender() {
  var b = $('#gnAcc');
  if (!b) return;
  var a = ACC();
  b.innerHTML =
    a.name || a.email || a.phone
      ? '<div><b>Accountant:</b> ' +
        esc(a.name || '(no name)') +
        (a.address ? '<div class="muted" style="white-space:pre-line">' + esc(a.address) + '</div>' : '') +
        (a.phone ? '<div>' + esc(a.phone) + ' <span class="cl">' + plinks(a.phone) + '</span></div>' : '') +
        (a.email ? '<div>' + esc(a.email) + ' <span class="cl">' + elinks(a.email) + '</span></div>' : '') +
        '</div><button type="button" class="btn ghost sm" data-accedit="1">Edit accountant</button>'
      : '<div class="muted">No accountant saved yet. Add their name, phone, email and address so the report is addressed to them.</div><button type="button" class="btn sm" data-accedit="1">Add your accountant</button>';
}
function gnMort(c, from, to) {
  var pay = +c.mortPayment || 0;
  if (!(pay > 0)) return { rows: [], tot: 0, est: 0 };
  var day = Math.min(31, Math.max(1, Math.round(+c.mortDay || 1))),
    rows = [],
    f = pd(from),
    t = pd(to),
    y = f.getFullYear(),
    m = f.getMonth();
  while (y < t.getFullYear() || (y === t.getFullYear() && m <= t.getMonth())) {
    var last = new Date(y, m + 1, 0).getDate(),
      d = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(Math.min(day, last)).padStart(2, '0');
    if (d >= from && d <= to) rows.push({ date: d, amount: pay });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  var bal = +c.mortBalance || 0,
    rate = +c.mortRate || 0,
    io = c.mortMethod === 'interest-only',
    r = rate / 1200,
    today = iso(TODAY);
  if (bal > 0 && rate > 0) {
    if (io)
      rows.forEach(function (x) {
        x.i = r2(Math.min(bal * r, pay));
      });
    else {
      var past = rows.filter(function (x) {
          return x.date <= today;
        }),
        fut = rows.filter(function (x) {
          return x.date > today;
        }),
        B = bal;
      for (var k = past.length - 1; k >= 0; k--) {
        var Bp = (B + pay) / (1 + r);
        past[k].i = r2(Math.min(Bp * r, pay));
        B = Bp;
      }
      B = bal;
      fut.forEach(function (x) {
        x.i = r2(Math.min(B * r, pay));
        B = B * (1 + r) - pay;
      });
    }
  } else
    rows.forEach(function (x) {
      x.i = io ? pay : null;
    });
  var est = r2(
    rows.reduce(function (a, x) {
      return a + (x.i || 0);
    }, 0)
  );
  return {
    rows: rows,
    tot: r2(pay * rows.length),
    est: est,
    method: c.mortMethod || '',
    rate: rate,
    bal: bal,
    lender: c.btlLender || ''
  };
}
function gnData(from, to, ids) {
  var props = cases
    .filter(function (c) {
      return c.stage !== 'lost' && (!ids || ids.indexOf(c.id) > -1);
    })
    .sort(function (a, b) {
      return names(a).localeCompare(names(b));
    });
  return props.map(function (c) {
    var rent = [];
    tnList(c).forEach(function (tn) {
      (tn.rentLog || []).forEach(function (r) {
        if (r.status !== 'paid') return;
        var d = r.paidDate || r.due;
        if (!d || d < from || d > to) return;
        rent.push({ date: d, due: r.due, who: tnNames(tn), amount: +r.amount || 0 });
      });
    });
    rent.sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    });
    var ex = (c.expenses || [])
      .filter(function (e) {
        return e.date && e.date >= from && e.date <= to;
      })
      .sort(function (a, b) {
        return a.date < b.date ? -1 : 1;
      });
    var rt = rent.reduce(function (a, r) {
        return a + r.amount;
      }, 0),
      et = ex.reduce(function (a, e) {
        return a + (+e.amount || 0);
      }, 0);
    return { c: c, rent: rent, ex: ex, rt: r2(rt), et: r2(et), mo: gnMort(c, from, to) };
  });
}
function gnTotals(rows) {
  var cats = {};
  rows.forEach(function (p) {
    p.ex.forEach(function (e) {
      cats[e.cat || 'Other'] = r2((cats[e.cat || 'Other'] || 0) + (+e.amount || 0));
    });
  });
  var s = function (f) {
      return r2(
        rows.reduce(function (a, p) {
          return a + f(p);
        }, 0)
      );
    },
    rt = s(function (p) {
      return p.rt;
    }),
    et = s(function (p) {
      return p.et;
    }),
    mt = s(function (p) {
      return p.mo.tot;
    }),
    me = s(function (p) {
      return p.mo.est;
    });
  return { rt: rt, et: et, mt: mt, me: me, cats: cats, left: r2(rt - et - mt), net: r2(rt - et - me) };
}
/* the summary at the top of the report: the four totals, then one line for each property */
var GN_NET = 'Net rental income (rent less expenses and mortgage interest)';
function gnSumRows(tt) {
  return [
    ['Total rent received', tt.rt],
    ['Total mortgage interest paid' + (tt.me ? ' (estimated)' : ''), tt.me],
    ['Total expenses', tt.et],
    [GN_NET, tt.net]
  ];
}
function gnNet(p) {
  return r2(p.rt - p.et - p.mo.est);
}
var MORT_NOTE =
  'Mortgage payments are worked out from the monthly payment on each property. Only the interest part of a mortgage counts for tax (as a basic-rate tax credit for individual landlords); capital repayments do not. The interest figure is an estimate from the balance and rate: use your lender’s annual statement for the exact amount.';
function mLabel(mo) {
  return [
    mo.method === 'interest-only' ? 'Interest only' : mo.method === 'repayment' ? 'Repayment' : '',
    mo.lender,
    mo.rate ? mo.rate + '%' : ''
  ]
    .filter(Boolean)
    .join(' · ');
}
function gnHtml(rows, from, to) {
  var tt = gnTotals(rows),
    fin = tt.cats['Mortgage interest and finance costs'] || 0,
    a = ACC();
  return (
    '<div class="dpage">' +
    (okLogo(BIZ.logo) ? '<img class="dlogo" src="' + BIZ.logo + '" alt="" style="max-height:50px">' : '') +
    '<div class="dbig" style="margin-top:6px">Rent received and expenses</div><div class="muted">' +
    esc(bizName() || profA().name || '') +
    ' · ' +
    fd(from) +
    ' to ' +
    fd(to) +
    '</div>' +
    (a.name
      ? '<div style="margin-top:6px;font-size:12px">Prepared for: <b>' +
        esc(a.name) +
        '</b>' +
        (a.address ? ', ' + esc(a.address.replace(/\n/g, ', ')) : '') +
        '</div>'
      : '') +
    '<h4 style="margin:14px 0 4px;color:#2F4A40">Summary</h4><table class="dsum" style="margin:0;min-width:320px">' +
    gnSumRows(tt)
      .map(function (r, n) {
        return (
          '<tr' +
          (n === 3 ? ' class="dgt"' : '') +
          '><td>' +
          esc(r[0]) +
          '</td><td>' +
          gbp(r[1]) +
          '</td></tr>'
        );
      })
      .join('') +
    '</table>' +
    (tt.mt
      ? '<p class="muted" style="font-size:11px;margin:6px 0 0">Total mortgage payments, interest and capital together: ' +
        gbp(tt.mt) +
        '. Left after expenses and mortgage payments: ' +
        gbp(tt.left) +
        '.</p>'
      : '') +
    (rows.length > 1
      ? '<h4 style="margin:14px 0 4px;color:#2F4A40">Summary by property</h4><table class="dtab"><thead><tr><th>Property</th><th>Rent received</th><th>Mortgage interest</th><th>Expenses</th><th>Net income</th></tr></thead><tbody>' +
        rows
          .map(function (p) {
            return (
              '<tr><td>' +
              esc(names(p.c)) +
              '</td><td>' +
              gbp(p.rt) +
              '</td><td>' +
              gbp(p.mo.est) +
              '</td><td>' +
              gbp(p.et) +
              '</td><td>' +
              gbp(gnNet(p)) +
              '</td></tr>'
            );
          })
          .join('') +
        '<tr><td><b>Total, ' +
        rows.length +
        ' properties</b></td><td><b>' +
        gbp(tt.rt) +
        '</b></td><td><b>' +
        gbp(tt.me) +
        '</b></td><td><b>' +
        gbp(tt.et) +
        '</b></td><td><b>' +
        gbp(tt.net) +
        '</b></td></tr></tbody></table>'
      : '') +
    (tt.mt
      ? '<p class="muted" style="font-size:11px">' +
        esc(MORT_NOTE) +
        (fin
          ? ' You have also entered ' +
            gbp(fin) +
            ' of mortgage interest as an expense, so check it is not counted twice.'
          : '') +
        '</p>'
      : fin
        ? '<p class="muted" style="font-size:11px">Includes ' +
          gbp(fin) +
          ' of mortgage interest and finance costs. For individual landlords these get tax relief as a basic-rate tax credit rather than as an expense, so your accountant will treat them separately.</p>'
        : '') +
    (Object.keys(tt.cats).length
      ? '<h4 style="margin:14px 0 4px;color:#2F4A40">Expenses by category</h4><table class="dkv">' +
        Object.keys(tt.cats)
          .sort()
          .map(function (k) {
            return '<tr><td>' + esc(k) + '</td><td>' + gbp(tt.cats[k]) + '</td></tr>';
          })
          .join('') +
        '</table>'
      : '') +
    rows
      .map(function (p) {
        return (
          '<h4 style="margin:18px 0 4px;color:#2F4A40">' +
          esc(names(p.c)) +
          '</h4>' +
          '<table class="dtab"><thead><tr><th>Rent received</th><th>Tenant</th><th>For rent due</th><th>Amount</th></tr></thead><tbody>' +
          (p.rent.length
            ? p.rent
                .map(function (r) {
                  return (
                    '<tr><td>' +
                    fd(r.date) +
                    '</td><td>' +
                    esc(r.who) +
                    '</td><td>' +
                    fd(r.due) +
                    '</td><td>' +
                    gbp(r.amount) +
                    '</td></tr>'
                  );
                })
                .join('')
            : '<tr><td colspan="4" class="muted">None in this period</td></tr>') +
          '<tr><td colspan="3"><b>Total rent</b></td><td><b>' +
          gbp(p.rt) +
          '</b></td></tr></tbody></table>' +
          '<table class="dtab" style="margin-top:6px"><thead><tr><th>Expense date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>' +
          (p.ex.length
            ? p.ex
                .map(function (e) {
                  return (
                    '<tr><td>' +
                    fd(e.date) +
                    '</td><td>' +
                    esc(e.cat || '') +
                    '</td><td>' +
                    esc(exDesc(e, ' · ')) +
                    '</td><td>' +
                    gbp(e.amount) +
                    '</td></tr>'
                  );
                })
                .join('')
            : '<tr><td colspan="4" class="muted">None in this period</td></tr>') +
          '<tr><td colspan="3"><b>Total expenses</b></td><td><b>' +
          gbp(p.et) +
          '</b></td></tr></tbody></table>' +
          (p.mo.rows.length
            ? '<table class="dtab" style="margin-top:6px"><thead><tr><th>Mortgage payment</th><th>Details</th><th>Interest part</th><th>Amount</th></tr></thead><tbody>' +
              p.mo.rows
                .map(function (r) {
                  return (
                    '<tr><td>' +
                    fd(r.date) +
                    '</td><td>' +
                    esc(mLabel(p.mo)) +
                    '</td><td>' +
                    (r.i == null ? '—' : gbp(r.i)) +
                    '</td><td>' +
                    gbp(r.amount) +
                    '</td></tr>'
                  );
                })
                .join('') +
              '<tr><td colspan="2"><b>Total mortgage payments</b></td><td><b>' +
              (p.mo.est ? gbp(p.mo.est) : '—') +
              '</b></td><td><b>' +
              gbp(p.mo.tot) +
              '</b></td></tr></tbody></table>'
            : '')
        );
      })
      .join('') +
    '<div class="dfoot">Prepared from the records kept in ' +
    esc((window.MD_CONFIG || {}).appName || 'MySimpleDesk') +
    ' on ' +
    fd(iso(TODAY)) +
    '. Check against your bank statements and receipts.</div></div>'
  );
}
function gnPdf(rows, from, to) {
  var P = new Pdf(),
    G = [0.35, 0.41, 0.47],
    A = [0.18, 0.29, 0.25],
    tt = gnTotals(rows),
    a = ACC();
  if (okLogo(BIZ.logo) && BIZ.logoW) {
    var s = Math.min(140 / BIZ.logoW, 45 / BIZ.logoH);
    P.image(BIZ.logo, BIZ.logoW, BIZ.logoH, 40, 36, BIZ.logoW * s, BIZ.logoH * s);
    P.y = 36 + BIZ.logoH * s + 12;
  }
  P.t(40, P.y, 'Rent received and expenses', 18, true, 'l', A);
  P.y += 24;
  P.t(40, P.y, (bizName() || profA().name || '') + '  ·  ' + fd(from) + ' to ' + fd(to), 10, false, 'l', G);
  P.y += 16;
  if (a.name) {
    wrapT(
      'Prepared for: ' + a.name + (a.address ? ', ' + a.address.replace(/\n/g, ', ') : ''),
      515,
      9.5
    ).forEach(function (l) {
      P.t(40, P.y, l, 9.5);
      P.y += 12;
    });
  }
  P.y += 8;
  P.t(40, P.y, 'Summary', 11, true, 'l', A);
  P.y += 16;
  gnSumRows(tt).forEach(function (r, i) {
    var last = i === 3;
    P.t(40, P.y, r[0], 10, last);
    P.t(420, P.y, gbp(r[1]), 10, last, 'r');
    P.y += 15;
  });
  if (tt.mt) {
    wrapT(
      'Total mortgage payments, interest and capital together: ' +
        gbp(tt.mt) +
        '. Left after expenses and mortgage payments: ' +
        gbp(tt.left) +
        '.',
      515,
      8.5
    ).forEach(function (l) {
      P.t(40, P.y, l, 8.5, false, 'l', G);
      P.y += 11;
    });
  }
  if (rows.length > 1) {
    var SX = [325, 405, 470, 549],
      shd = function (p) {
        p.rect(40, p.y, 515, 16, [0.93, 0.95, 0.94]);
        p.t(46, p.y + 4, 'Property', 8.5, true);
        ['Rent received', 'Mortgage interest', 'Expenses', 'Net income'].forEach(function (h, i) {
          p.t(SX[i], p.y + 4, h, 8.5, true, 'r');
        });
        p.y += 20;
      };
    P.y += 8;
    P.need(60);
    P.t(40, P.y, 'Summary by property', 11, true, 'l', A);
    P.y += 16;
    shd(P);
    rows.forEach(function (p) {
      var ls = wrapT(names(p.c), 205, 9),
        h = Math.max(1, ls.length) * 11 + 3;
      P.need(h, shd);
      ls.forEach(function (l, i) {
        P.t(46, P.y + i * 11, l, 9);
      });
      [p.rt, p.mo.est, p.et, gnNet(p)].forEach(function (v, i) {
        P.t(SX[i], P.y, gbp(v), 9, false, 'r');
      });
      P.y += h;
      P.line(40, P.y - 2, 555);
    });
    P.need(16);
    P.t(46, P.y + 2, 'Total, ' + rows.length + ' properties', 9.5, true);
    [tt.rt, tt.me, tt.et, tt.net].forEach(function (v, i) {
      P.t(SX[i], P.y + 2, gbp(v), 9.5, true, 'r');
    });
    P.y += 20;
  }
  var fin = tt.cats['Mortgage interest and finance costs'] || 0,
    note = tt.mt
      ? MORT_NOTE +
        (fin
          ? ' You have also entered ' +
            gbp(fin) +
            ' of mortgage interest as an expense, so check it is not counted twice.'
          : '')
      : fin
        ? 'Includes ' +
          gbp(fin) +
          ' of mortgage interest and finance costs. For individual landlords these get tax relief as a basic-rate tax credit rather than as an expense, so your accountant will treat them separately.'
        : '';
  if (note) {
    P.y += 4;
    wrapT(note, 515, 8.5).forEach(function (l) {
      P.t(40, P.y, l, 8.5, false, 'l', G);
      P.y += 11;
    });
  }
  var cats = Object.keys(tt.cats).sort();
  if (cats.length) {
    P.y += 8;
    P.t(40, P.y, 'Expenses by category', 11, true, 'l', A);
    P.y += 16;
    cats.forEach(function (k) {
      P.need(14);
      P.t(40, P.y, k, 9.5);
      P.t(400, P.y, gbp(tt.cats[k]), 9.5, false, 'r');
      P.y += 13;
    });
  }
  var table = function (head, cols, data, total) {
    var hd = function (p) {
      p.rect(40, p.y, 515, 16, [0.93, 0.95, 0.94]);
      head.forEach(function (h, i) {
        p.t(cols[i][0], p.y + 4, h, 8.5, true, cols[i][1]);
      });
      p.y += 20;
    };
    P.need(40);
    hd(P);
    if (!data.length) {
      P.t(46, P.y, 'None in this period', 9, false, 'l', G);
      P.y += 14;
    }
    data.forEach(function (r) {
      var lines = wrapT(r[2], cols[3][0] - cols[2][0] - 60, 9),
        h = Math.max(1, lines.length) * 11 + 3;
      P.need(h, hd);
      P.t(cols[0][0], P.y, r[0], 9);
      P.t(cols[1][0], P.y, wrapT(r[1], cols[2][0] - cols[1][0] - 8, 9)[0] || '', 9);
      lines.forEach(function (l, i) {
        P.t(cols[2][0], P.y + i * 11, l, 9);
      });
      P.t(cols[3][0], P.y, r[3], 9, false, 'r');
      P.y += h;
      P.line(40, P.y - 2, 555);
    });
    P.need(16);
    P.t(46, P.y + 2, total[0], 9.5, true);
    P.t(cols[3][0], P.y + 2, total[1], 9.5, true, 'r');
    P.y += 20;
  };
  rows.forEach(function (p) {
    P.need(80);
    P.y += 10;
    wrapT(names(p.c), 515, 12, true).forEach(function (l) {
      P.t(40, P.y, l, 12, true, 'l', A);
      P.y += 15;
    });
    P.y += 2;
    table(
      ['Rent received', 'Tenant', 'For rent due', 'Amount'],
      [
        [46, 'l'],
        [120, 'l'],
        [330, 'l'],
        [549, 'r']
      ],
      p.rent.map(function (r) {
        return [fd(r.date), r.who, fd(r.due), gbp(r.amount)];
      }),
      ['Total rent', gbp(p.rt)]
    );
    table(
      ['Expense date', 'Category', 'Description', 'Amount'],
      [
        [46, 'l'],
        [120, 'l'],
        [300, 'l'],
        [549, 'r']
      ],
      p.ex.map(function (e) {
        return [fd(e.date), e.cat || '', exDesc(e, ' · '), gbp(e.amount)];
      }),
      ['Total expenses', gbp(p.et)]
    );
    if (p.mo.rows.length)
      table(
        ['Mortgage payment', 'Details', 'Interest part', 'Amount'],
        [
          [46, 'l'],
          [150, 'l'],
          [420, 'l'],
          [549, 'r']
        ],
        p.mo.rows.map(function (r) {
          return [fd(r.date), mLabel(p.mo), r.i == null ? '-' : gbp(r.i), gbp(r.amount)];
        }),
        [
          'Total mortgage payments' + (p.mo.est ? ' (interest part ' + gbp(p.mo.est) + ')' : ''),
          gbp(p.mo.tot)
        ]
      );
  });
  P.need(30);
  P.y += 6;
  wrapT(
    'Prepared from the records kept in ' +
      ((window.MD_CONFIG || {}).appName || 'MySimpleDesk') +
      ' on ' +
      fd(iso(TODAY)) +
      '. Check against your bank statements and receipts.',
    515,
    8
  ).forEach(function (l) {
    P.t(40, P.y, l, 8, false, 'l', G);
    P.y += 10;
  });
  return P.bytes('Rent received and expenses · ' + fd(from) + ' to ' + fd(to));
}
function gnCsv(rows) {
  var q = function (v) {
      return '"' + csvCell(v).replace(/"/g, '""') + '"';
    },
    out = [
      ['Property', 'Type', 'Date', 'Tenant or category', 'Detail', 'Amount', 'Interest part', 'Receipt link']
        .map(q)
        .join(',')
    ];
  var tt = gnTotals(rows);
  gnSumRows(tt).forEach(function (r) {
    out.push(
      [rows.length > 1 ? 'All properties' : names(rows[0] ? rows[0].c : {}), 'Summary', '', r[0], '', r[1]]
        .map(q)
        .join(',')
    );
  });
  if (rows.length > 1)
    rows.forEach(function (p) {
      [
        ['Rent received', p.rt],
        ['Mortgage interest paid', p.mo.est],
        ['Expenses', p.et],
        ['Net rental income', gnNet(p)]
      ].forEach(function (r) {
        out.push([names(p.c), 'Summary', '', r[0], '', r[1]].map(q).join(','));
      });
    });
  rows.forEach(function (p) {
    p.rent.forEach(function (r) {
      out.push(
        [names(p.c), 'Rent received', r.date, r.who, 'For rent due ' + r.due, r.amount, '', '']
          .map(q)
          .join(',')
      );
    });
    p.ex.forEach(function (e) {
      out.push(
        [
          names(p.c),
          'Expense',
          e.date,
          e.cat || '',
          exDesc(e, ' - '),
          e.amount,
          '',
          (e.receipt && rcUrl(e.receipt.url)) || ''
        ]
          .map(q)
          .join(',')
      );
    });
    p.mo.rows.forEach(function (r) {
      out.push(
        [names(p.c), 'Mortgage payment', r.date, mLabel(p.mo), '', r.amount, r.i == null ? '' : r.i, '']
          .map(q)
          .join(',')
      );
    });
  });
  return '﻿' + out.join('\r\n') + '\r\n';
}
function gnHas(r) {
  return gnData(r[0], r[1]).some(function (p) {
    return p.rent.length || p.ex.length;
  });
}
function gnOpen() {
  var pre = gnHas(gnRange('lasttax')) || !gnHas(gnRange('thistax')) ? 'lasttax' : 'thistax',
    r = gnRange(pre),
    props = cases
      .filter(function (c) {
        return c.stage !== 'lost';
      })
      .sort(function (a, b) {
        return names(a).localeCompare(names(b));
      });
  overlay(
    'gnOv',
    '<div class="dhd"><h2>Reports and agreements</h2><button type="button" class="btn ghost" data-gnclose="1">Close</button></div>' +
      '<div class="gntabs" role="tablist" aria-label="Reports and agreements"><button type="button" role="tab" id="gnt-rep" aria-controls="gnp-rep" aria-selected="true" data-gntab="rep"><b>Rent and expense reports</b><small>For you and your accountant</small></button><button type="button" role="tab" id="gnt-ag" aria-controls="gnp-ag" aria-selected="false" tabindex="-1" data-gntab="ag"><b>Tenancy agreement</b><small>Create or renew an agreement</small></button></div>' +
      '<div id="gnp-rep" role="tabpanel" aria-labelledby="gnt-rep">' +
      '<p class="muted" style="margin:4px 0 10px">A report of rent received, expenses and mortgage payments for your accountant. Choose the dates and properties, then download it as a PDF or a spreadsheet (CSV), or email it.</p>' +
      '<div id="gnAcc" class="gnacc"></div>' +
      '<div class="chips" style="margin:0 0 8px">' +
      [
        ['lasttax', 'Last tax year'],
        ['thistax', 'This tax year so far'],
        ['lastcal', 'Last calendar year'],
        ['thiscal', 'This calendar year']
      ]
        .map(function (x) {
          return (
            '<button type="button" data-gnr="' +
            x[0] +
            '" aria-pressed="' +
            (x[0] === pre) +
            '">' +
            x[1] +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="grid"><label class="f">From<input id="gn-from" type="date" value="' +
      r[0] +
      '"></label><label class="f">To<input id="gn-to" type="date" value="' +
      r[1] +
      '"></label></div>' +
      '<div class="grid"><label class="f wide">Report for<select id="gn-mode"><option value="all">All properties, in one report</option><option value="each">All properties, a separate report for each</option>' +
      props
        .map(function (c) {
          return '<option value="p:' + esc(c.id) + '">' + esc(names(c)) + ' only</option>';
        })
        .join('') +
      '</select></label></div>' +
      '<div class="tacbs" id="gnPick"><b>Properties:</b>' +
      props
        .map(function (c) {
          return (
            '<label class="tacb"><input type="checkbox" data-gnp="' +
            esc(c.id) +
            '" checked> ' +
            esc(names(c)) +
            '</label>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="add" style="margin:10px 0"><button type="button" class="btn ghost" data-gnout="pdf">Download PDF</button><button type="button" class="btn ghost" data-gnout="csv">Download spreadsheet (CSV)</button><button type="button" class="btn ghost" data-gnout="share">Share PDF (phone)</button><button type="button" class="btn" data-gnout="mail">Email to my accountant</button><button type="button" class="btn ghost" data-gnout="print">Print</button></div>' +
      '<div id="gnPrev" class="dcprev" style="position:static;max-height:460px;overflow:auto"></div>' +
      '</div>' +
      '<div id="gnp-ag" role="tabpanel" aria-labelledby="gnt-ag" hidden>' +
      gnAgHtml(props) +
      '</div>',
    true
  );
  gnAccRender();
  gnAgSync();
  gnPreview();
}
/* the two tabs of Reports and agreements */
function gnShowTab(k, focus) {
  ['rep', 'ag'].forEach(function (x) {
    var b = $('#gnt-' + x),
      p = $('#gnp-' + x);
    if (!b || !p) return;
    var on = x === k;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
    p.hidden = !on;
    if (on && focus) b.focus();
  });
  if (k === 'ag') gnAgSync();
}
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-gntab]') : null;
  if (b && b.closest('#gnOv')) {
    e.preventDefault();
    gnShowTab(b.getAttribute('data-gntab'));
  }
});
document.addEventListener('keydown', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-gntab]') : null;
  if (!b || !b.closest('#gnOv')) return;
  var k = e.key,
    cur = b.getAttribute('data-gntab'),
    nx =
      k === 'ArrowRight' || k === 'ArrowLeft'
        ? cur === 'rep'
          ? 'ag'
          : 'rep'
        : k === 'Home'
          ? 'rep'
          : k === 'End'
            ? 'ag'
            : null;
  if (nx) {
    e.preventDefault();
    gnShowTab(nx, true);
  }
});
function gnRead() {
  var from = ($('#gn-from') || {}).value,
    to = ($('#gn-to') || {}).value,
    mode = ($('#gn-mode') || {}).value || 'all',
    ids =
      mode.indexOf('p:') === 0
        ? [mode.slice(2)]
        : Array.prototype.filter
            .call(document.querySelectorAll('[data-gnp]'), function (i) {
              return i.checked;
            })
            .map(function (i) {
              return i.getAttribute('data-gnp');
            });
  var rows = gnData(from, to, ids);
  return {
    from: from,
    to: to,
    ids: ids,
    rows: rows,
    mode: mode,
    each: mode === 'each',
    one: mode !== 'all' && rows.length === 1 ? rows[0].c : null
  };
}
/* the reports to make: one for everything, or one for each property */
function gnParts(g) {
  return g.each
    ? g.rows.map(function (r) {
        return { rows: [r], c: r.c };
      })
    : [{ rows: g.rows, c: g.one }];
}
function gnModeSync() {
  var m = ($('#gn-mode') || {}).value || 'all',
    pk = $('#gnPick');
  if (pk) pk.style.display = m.indexOf('p:') === 0 ? 'none' : '';
}
