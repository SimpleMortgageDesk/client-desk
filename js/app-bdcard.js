'use strict';
/* MySimpleDesk app: The animated birthday card.
   A WhatsApp text cannot move, so the card is a short animated picture (a GIF) with confetti, balloons and the person's name.
   It is drawn and put together on this device, then shared into WhatsApp (phones) or saved to attach (computers).
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */

/* ---------- a small GIF writer (fixed 216-colour palette, so flat colours stay clean) ---------- */
function gifLzw(px) {
  var clear = 256,
    eoi = 257,
    next = 258,
    size = 9,
    dict = new Map(),
    out = [],
    cur = 0,
    bits = 0;
  var put = function (code) {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(cur & 255);
      cur >>= 8;
      bits -= 8;
    }
  };
  put(clear);
  var prefix = px[0];
  for (var i = 1; i < px.length; i++) {
    var k = px[i],
      key = prefix * 256 + k,
      hit = dict.get(key);
    if (hit !== undefined) prefix = hit;
    else {
      put(prefix);
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
      if (next >= 4095) {
        put(clear);
        dict.clear();
        next = 258;
        size = 9;
      }
      prefix = k;
    }
  }
  put(prefix);
  put(eoi);
  if (bits > 0) out.push(cur & 255);
  return out;
}
/* frames: ImageData list; delay in hundredths of a second */
function gifEncode(frames, w, h, delay) {
  var b = [];
  var w16 = function (n) {
    b.push(n & 255, (n >> 8) & 255);
  };
  'GIF89a'.split('').forEach(function (c) {
    b.push(c.charCodeAt(0));
  });
  w16(w);
  w16(h);
  b.push(0xf7, 0, 0);
  for (var i = 0; i < 256; i++) {
    if (i < 216) b.push(Math.floor(i / 36) * 51, Math.floor((i % 36) / 6) * 51, (i % 6) * 51);
    else b.push(0, 0, 0);
  }
  b.push(0x21, 0xff, 11);
  'NETSCAPE2.0'.split('').forEach(function (c) {
    b.push(c.charCodeAt(0));
  });
  b.push(3, 1, 0, 0, 0);
  frames.forEach(function (f) {
    var d = f.data,
      px = new Uint8Array(w * h);
    for (var p = 0, q = 0; p < px.length; p++, q += 4)
      px[p] = 36 * Math.round(d[q] / 51) + 6 * Math.round(d[q + 1] / 51) + Math.round(d[q + 2] / 51);
    b.push(0x21, 0xf9, 4, 4);
    w16(delay);
    b.push(0, 0);
    b.push(0x2c);
    w16(0);
    w16(0);
    w16(w);
    w16(h);
    b.push(0, 8);
    var z = gifLzw(px);
    for (var s = 0; s < z.length; s += 255) {
      var n = Math.min(255, z.length - s);
      b.push(n);
      for (var j = 0; j < n; j++) b.push(z[s + j]);
    }
    b.push(0);
  });
  b.push(0x3b);
  return new Blob([new Uint8Array(b)], { type: 'image/gif' });
}

/* ---------- drawing the card ---------- */
var BDC_SIZE = 400,
  BDC_FRAMES = 30,
  BDC_COL = ['#FF6666', '#FFCC00', '#00CC99', '#3399FF', '#9966FF', '#FF99CC'];
function bdcRand(seed) {
  var s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function bdcStar(c, x, y, r, rot) {
  c.beginPath();
  for (var i = 0; i < 10; i++) {
    var a = rot + (i * Math.PI) / 5 - Math.PI / 2,
      rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}
function bdcText(c, s, x, y, size, color, bold) {
  var px = size;
  c.font =
    (bold ? '800 ' : '600 ') + px + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  while (c.measureText(s).width > BDC_SIZE - 40 && px > 16) {
    px -= 2;
    c.font =
      (bold ? '800 ' : '600 ') + px + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  }
  c.fillStyle = color;
  c.fillText(s, x, y);
}
/* one picture of the loop: t runs from 0 to just under 1, and the last picture leads back into the first */
function bdcDraw(c, t, o) {
  var W = BDC_SIZE,
    TAU = Math.PI * 2,
    R = bdcRand(7);
  c.fillStyle = o.isl ? '#003333' : '#FFE6CC';
  c.fillRect(0, 0, W, W);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  var i;
  if (o.isl) {
    /* a crescent and stars */
    c.fillStyle = '#FFCC33';
    c.beginPath();
    c.arc(W / 2, 92, 38, 0, TAU);
    c.fill();
    c.fillStyle = '#003333';
    c.beginPath();
    c.arc(W / 2 + 15, 84, 33, 0, TAU);
    c.fill();
    for (i = 0; i < 26; i++) {
      var sx = R() * W,
        sy0 = R() * W,
        sp = 1 + Math.floor(R() * 2),
        sr = 5 + R() * 6,
        y = (sy0 + sp * t * (W + 30)) % (W + 30);
      c.fillStyle = i % 3 ? '#FFCC33' : '#FFFFFF';
      bdcStar(
        c,
        sx + Math.sin(TAU * (t + i / 26)) * 8,
        y - 15,
        sr * (0.8 + 0.2 * Math.sin(TAU * (t * 2 + i / 7))),
        TAU * t
      );
    }
  } else {
    for (i = 0; i < 44; i++) {
      var x0 = R() * W,
        y0 = R() * (W + 40),
        k = 1 + Math.floor(R() * 2),
        ph = R(),
        yy = (y0 + k * t * (W + 40)) % (W + 40);
      c.save();
      c.translate(x0 + Math.sin(TAU * (t + ph)) * 12, yy - 20);
      c.rotate(TAU * (t * (1 + (i % 2)) + ph));
      c.fillStyle = BDC_COL[i % BDC_COL.length];
      c.fillRect(-5, -8, 10, 16);
      c.restore();
    }
    for (i = 0; i < 5; i++) {
      var bx = 40 + i * 80 + Math.sin(TAU * (t + i / 5)) * 10,
        by = W + 70 - ((i * 0.37 + t) % 1) * (W + 170);
      c.fillStyle = BDC_COL[(i * 2 + 1) % BDC_COL.length];
      c.beginPath();
      c.ellipse(bx, by, 22, 28, 0, 0, TAU);
      c.fill();
      c.strokeStyle = '#666666';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(bx, by + 28);
      c.quadraticCurveTo(bx - 8, by + 55, bx, by + 80);
      c.stroke();
    }
  }
  var pulse = 1 + 0.04 * Math.sin(TAU * t),
    ink = o.isl ? '#FFFFFF' : '#CC3333';
  c.save();
  c.translate(W / 2, 205);
  c.scale(pulse, pulse);
  bdcText(c, 'Happy', 0, -50, 40, o.isl ? '#FFCC33' : '#333333', false);
  bdcText(c, 'Birthday', 0, 5, 68, ink, true);
  bdcText(c, o.name, 0, 70, 46, o.isl ? '#FFCC33' : '#3366CC', true);
  c.restore();
  if (o.sub) bdcText(c, o.sub, W / 2, 330, 22, o.isl ? '#FFFFFF' : '#666666', false);
  if (o.from) bdcText(c, o.from, W / 2, 365, 20, o.isl ? '#CCCCCC' : '#666666', false);
}
/* the card as a GIF, built in the background so the screen stays smooth */
function bdcMake(o) {
  var cv = document.createElement('canvas');
  cv.width = cv.height = BDC_SIZE;
  var c = cv.getContext('2d', { willReadFrequently: true }),
    frames = [],
    n = 0;
  return new Promise(function (res) {
    var step = function () {
      var end = Math.min(BDC_FRAMES, n + 3);
      for (; n < end; n++) {
        bdcDraw(c, n / BDC_FRAMES, o);
        frames.push(c.getImageData(0, 0, BDC_SIZE, BDC_SIZE));
      }
      if (n < BDC_FRAMES) setTimeout(step, 0);
      else res(gifEncode(frames, BDC_SIZE, BDC_SIZE, 10));
    };
    step();
  });
}

/* ---------- the screen: preview, share, save ---------- */
function bdCard(key) {
  var p = bdFind(key);
  if (!p) return;
  var isl = bdMode(p) === 'isl',
    first = bdFirst(p.name),
    me = (typeof profA === 'function' && profA().name) || '',
    o = {
      isl: isl,
      name: first,
      sub: isl ? 'Barakallahu feek' : p.age >= 16 && p.age <= 110 ? 'Wishing you a wonderful day' : '',
      from: me ? 'from ' + me : ''
    };
  var old = document.getElementById('bdcOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'bdcOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:290;background:rgba(8,14,18,.6);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div role="dialog" aria-modal="true" aria-label="Animated birthday card" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(460px,100%);max-height:94vh;overflow:auto;border-radius:14px;padding:18px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
    '<h2 style="margin:0 0 4px;font-size:20px">Animated birthday card</h2>' +
    '<p class="muted" id="bdcMsg" role="status" style="margin:0 0 10px;font-size:13px">Making the card for ' +
    esc(first) +
    '…</p>' +
    '<div id="bdcBox" style="min-height:120px"></div>' +
    '<div id="bdcBtns" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:14px"></div></div>';
  document.body.appendChild(ov);
  var close = function () {
    var im = ov.querySelector('img');
    if (im) URL.revokeObjectURL(im.src);
    ov.remove();
  };
  ov.addEventListener('mousedown', function (e) {
    if (e.target === ov) close();
  });
  bdcMake(o).then(function (blob) {
    if (!document.body.contains(ov)) return;
    var url = URL.createObjectURL(blob),
      file = new File([blob], 'Happy-Birthday-' + bdSlug(p.name) + '.gif', { type: 'image/gif' }),
      can = false;
    try {
      can = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (e) {}
    ov.querySelector('#bdcBox').innerHTML =
      '<img src="' +
      url +
      '" alt="Animated birthday card for ' +
      esc(first) +
      '" style="width:min(320px,100%);height:auto;border-radius:12px">';
    ov.querySelector('#bdcMsg').textContent = can
      ? 'Tap Share, choose WhatsApp, and it goes with your message.'
      : 'Save the card, then attach it in WhatsApp (the paperclip) and send it with your message.';
    ov.querySelector('#bdcBtns').innerHTML =
      (can ? '<button type="button" class="btn" id="bdcShare">Share on WhatsApp</button>' : '') +
      '<button type="button" class="btn' +
      (can ? ' ghost' : '') +
      '" id="bdcSave">Save the card</button><button type="button" class="btn ghost" id="bdcCopy">Copy message</button><button type="button" class="btn ghost" id="bdcClose">Close</button>';
    ov.querySelector('#bdcClose').onclick = close;
    ov.querySelector('#bdcSave').onclick = function () {
      var a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        a.remove();
      }, 1000);
      toast('Card saved as ' + file.name);
    };
    ov.querySelector('#bdcCopy').onclick = function () {
      var tx = bdText(p);
      (navigator.clipboard ? navigator.clipboard.writeText(tx) : Promise.reject()).then(
        function () {
          toast('Message copied');
        },
        function () {
          toast('Could not copy. Use Copy message on the birthday page.');
        }
      );
    };
    var sh = ov.querySelector('#bdcShare');
    if (sh)
      sh.onclick = function () {
        navigator.share({ files: [file], text: bdText(p), title: 'Happy Birthday ' + first }).then(
          function () {
            bdSetSent(p, true);
            close();
          },
          function () {}
        );
      };
  });
}
