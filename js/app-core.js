'use strict';
/* MySimpleDesk app: Basics: shared settings, helpers, pasted tables, saving, reminders made from record dates, and search filters.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
var T,
  STAGES,
  STAGE_LABEL,
  TYPES,
  AP_TYPES,
  landingDone = false,
  homeMonth;
/* the first page after logging in: the list of properties and cars for landlords and home owners, To do for everyone else */
function landView() {
  return T && T.tenancyMode ? 'assets' : 'todo';
}
/* the site name: "My" is quiet, "Simple" is bold and "Desk" is bold green, so it reads as SimpleDesk */
function brandHtml(an) {
  var m = /^(My)(.+?)(Desk)$/.exec(an || '');
  if (m)
    return (
      '<span class="bn-my">' +
      esc(m[1]) +
      '</span><span class="bn-simple">' +
      esc(m[2]) +
      '</span><span class="bn-desk">' +
      esc(m[3]) +
      '</span>'
    );
  var sp = String(an).lastIndexOf(' '),
    dk = /^(.+)(Desk)$/.exec(an);
  return sp > 0
    ? esc(an.slice(0, sp)) + ' <span class="bn-desk">' + esc(an.slice(sp + 1)) + '</span>'
    : dk
      ? esc(dk[1]) + '<span class="bn-desk">' + esc(dk[2]) + '</span>'
      : esc(an);
}
/* one account can work in up to two trades. Each record is tagged with its trade (c.tr); records with no tag belong to the account's main trade. Only the active trade's records are shown. */
function trOf(c) {
  return c.tr || MAIN_TRADE || T.id;
}
function setCases() {
  cases = casesAll.filter(function (c) {
    return trOf(c) === T.id;
  });
}
function tagTr(d) {
  if (TRADES.length > 1) d.tr = T.id;
  return d;
}
function applyTrade() {
  T = window.CD_T();
  homeMonth = true;
  /* the calendar opens as a month view with the coming up appointments on top, for every trade */ /* each trade has its own colour theme */ document.body.setAttribute(
    'data-theme-trade',
    T.id || ''
  );
  try {
    var tmc = document.querySelector('meta[name="theme-color"]');
    if (tmc) {
      var ac = getComputedStyle(document.body).getPropertyValue('--accent').trim();
      if (ac) tmc.setAttribute('content', ac);
    }
  } catch (e) {}
  STAGES = T.stages;
  STAGE_LABEL = { lost: 'Closed lost' };
  STAGES.forEach(function (s) {
    STAGE_LABEL[s.id] = s.label;
  });
  TYPES = T.types;
  AP_TYPES = T.apptTypes;
  var nb = document.getElementById('newBtn');
  if (nb) nb.style.display = T.tenancyMode ? 'none' : '';
  if (nb)
    nb.textContent =
      T.noun[0] === 'Client' || T.tenancyMode
        ? 'Add ' + T.noun[0].toLowerCase()
        : 'New ' + T.noun[0].toLowerCase();
  var q = document.getElementById('q');
  if (q) q.placeholder = 'Search ' + T.noun[1].toLowerCase();
  var bn = document.getElementById('brandName'),
    an = (window.MD_CONFIG || {}).appName || 'MySimpleDesk';
  if (bn) bn.innerHTML = brandHtml(an);
  document.title = an;
  if (!landingDone && window.CD_tradeChosen && window.CD_tradeChosen()) {
    landingDone = true;
    if (view === 'tasks' || view === undefined) view = landView();
  }
}
function N1() {
  return T.noun[0].toLowerCase();
}
function NS() {
  return T.noun[1].toLowerCase();
}
applyTrade();

var casesAll = [],
  TRADES = [],
  MAIN_TRADE = null,
  USEDTU = null;
var db = null,
  col = null,
  cases = [],
  loaded = false,
  view = view || 'tasks',
  query = '',
  stageFilter = '',
  lenderFilter = '',
  revFilter = '',
  sortBy = (function () {
    try {
      return localStorage.getItem('cd.ui.sortBy') || 'task';
    } catch (e) {
      return 'task';
    }
  })(),
  openId = undefined;
var queues = {};

/* ---------- helpers ---------- */
function $(s, r) {
  return (r || document).querySelector(s);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function num(v) {
  if (v === '' || v == null) return null;
  var n = parseFloat(String(v).replace(/[£,\s]/g, ''));
  return isNaN(n) ? null : n;
}
function money(n) {
  if (n == null || n === '') return '—';
  n = +n;
  return (
    '£' +
    n.toLocaleString('en-GB', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2
    })
  );
}
function pd(iso) {
  if (!iso) return null;
  var p = iso.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
var TODAY = (function () {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
})();
function diff(iso) {
  return Math.round((pd(iso) - TODAY) / 864e5);
}
function iso(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}
function addMonths(s, n) {
  var d = pd(s),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return iso(d);
}
var REVM = 4;
function addDays(s, n) {
  var d = pd(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function fd(s) {
  return s ? pd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
function rel(s) {
  var n = diff(s);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago';
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function lastDay(s) {
  var d = pd(s);
  return d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function autoDate(s, a) {
  var r = s;
  if (a.m) {
    if (a.eom && lastDay(s)) {
      var d = pd(s);
      r = iso(new Date(d.getFullYear(), d.getMonth() + a.m + 1, 0));
    } else r = addMonths(s, a.m);
  }
  if (a.d) r = addDays(r, a.d);
  return r;
}
function autoOf(c, f) {
  var s = fv(c, f.auto.from);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? autoDate(s, f.auto) : '';
}
function fv(c, k) {
  var v = c ? c[k] : null;
  if (v !== '' && v != null) return v;
  var f = T.byKey[k];
  if (f && f.auto && c) return autoOf(c, f);
  return '';
}
function stageOf(c) {
  return c.stage === 'lost' ? 'lost' : STAGE_LABEL[c.stage] && c.stage !== 'lost' ? c.stage : STAGES[0].id;
}
function fmtField(c, k) {
  var f = T.byKey[k],
    v = fv(c, k);
  if (v === '' || v == null) return '';
  if (!f) return String(v);
  if (f.t === 'money') return money(v);
  if (f.t === 'date') return fd(v);
  if (f.t === 'sel') {
    var o = (f.o || []).filter(function (x) {
      return Array.isArray(x) && x[0] === v;
    })[0];
    return o ? o[1] : String(v);
  }
  return String(v);
}
function csvCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  v = String(v);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return v;
}
var protHidden = false,
  protAll = false,
  prDraft = '';

function protFs(c) {
  var ps = (c.protection || []).slice().sort(function (a, b) {
    return b.ts - a.ts;
  });
  var xl = T.extraLog || { title: 'Extra notes', ph: '' };
  return (
    '<fieldset style="margin-top:14px"><legend>' +
    esc(xl.title) +
    ' (' +
    ps.length +
    ')</legend><div class="add" style="margin:0 0 8px"><button type="button" class="btn ghost sm" id="prHide">' +
    (protHidden ? 'Show' : 'Hide') +
    '</button></div>' +
    (protHidden
      ? '<span class="muted">Hidden.</span>'
      : '<label class="f">New note<textarea id="prText" rows="3" placeholder="' +
        esc(xl.ph) +
        '">' +
        esc(prDraft) +
        '</textarea></label><div id="prTblBox">' +
        pendHtml('pr') +
        '</div><div class="add"><button type="button" class="btn ghost" id="prStamp">Insert date and time</button><button type="button" class="btn ghost" id="prAdd">Add note</button></div>' +
        (protAll ? ps : ps.slice(0, 1))
          .map(function (n) {
            return noteItem(n, 'protection', protAll || ps.length < 2 ? '' : ' (latest)', esc);
          })
          .join('') +
        (ps.length > 1
          ? '<button type="button" class="btn ghost sm" id="prAll">' +
            (protAll ? 'Show latest only' : 'Show all ' + ps.length) +
            '</button>'
          : '')) +
    '</fieldset>'
  );
}
function latestNoteCell(c, key) {
  var n = (c[key || 'notes'] || []).slice().sort(function (a, b) {
    return b.ts - a.ts;
  })[0];
  if (!n) return '<span class="muted">—</span>';
  var t = String(n.text || '');
  if (!t && n.table) t = '[Table]';
  if (t.length > 140) t = t.slice(0, 140) + '…';
  t = t.replace(/\s+/g, ' ');
  return (
    '<div class="nl1" title="' +
    esc(stampOf(n.ts) + ' ' + t) +
    '"><span class="muted" style="font-family:var(--mono);font-size:11px">' +
    stampOf(n.ts) +
    '</span> ' +
    esc(t) +
    '</div>'
  );
}
function cno(c) {
  return c.clientNo ? ' <span class="cno">' + esc(c.clientNo) + '</span>' : '';
}
function nextClientNo() {
  var m = 0;
  (casesAll.length ? casesAll : cases).forEach(function (c) {
    var r = /^C(\d+)$/i.exec(c.clientNo || '');
    if (r) m = Math.max(m, +r[1]);
  });
  return 'C' + String(m + 1).padStart(3, '0');
}
/* full property address: line one plus the postcode (not repeated if the postcode is already typed in line one) */
function pcFmt(raw) {
  var v = String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ''),
    m = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/.exec(v);
  return m
    ? m[1] + ' ' + m[2]
    : String(raw || '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}
function paddr(c) {
  var a = String((c && c.propertyAddress) || '').trim(),
    p = String((c && c.postcode) || '').trim();
  if (!p) return a;
  var n = function (x) {
    return x.toUpperCase().replace(/[^A-Z0-9]/g, '');
  };
  return n(a).indexOf(n(p)) > -1 ? a : a ? a + ', ' + p : p;
}
function names(c) {
  if (T && T.tenancyMode) {
    var pa = short(paddr(c));
    return pa || 'Unnamed property';
  }
  if (isSpv(c) && String(c.companyName || '').trim()) return String(c.companyName).trim();
  return pnames(c);
}
/* ---------- mortgage adviser: one client can hold several properties, or borrow through a company (SPV) ---------- */
var dirMode = false;
function isSpv(c) {
  return c.borrowerType === 'spv';
}
function coNo(c) {
  return String(c.companyNumber || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
var PROP_TYPES = [
  ['', 'Not set'],
  ['main', 'Main residence'],
  ['btl', 'Buy to let'],
  ['second', 'Second home'],
  ['holiday', 'Holiday home']
];
function propLabel(v) {
  var o = PROP_TYPES.filter(function (q) {
    return q[0] === v;
  })[0];
  return o && o[0] ? o[1] : '';
}
function spvTag(c) {
  return isSpv(c)
    ? ' <span class="ptag spv" title="' + esc(c.companyName || 'Limited company (SPV)') + '">SPV</span>'
    : '';
}
function propTag(c) {
  var l = propLabel(c.propUse);
  return spvTag(c) + (l ? ' <span class="ptag ' + esc(c.propUse) + '">' + esc(l) + '</span>' : '');
}
/* Same client = same applicant names and dates of birth, in any order. A joint case with a different second person is a different client.
   For a company, every case with the same company number (or name) is one client. */
function clientKey(c) {
  if (isSpv(c)) {
    var cn = coNo(c);
    if (cn) return 'co:' + cn;
    var nm = String(c.companyName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (nm) return 'coname:' + nm;
  }
  var a = (c.applicants || [])
    .map(function (x) {
      return (
        String(x.name || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ') +
        '|' +
        (x.dob || '')
      );
    })
    .filter(function (v) {
      return v !== '|';
    });
  return a.length ? a.sort().join('||') : '#' + c.id;
}
function pnames(c) {
  var a = (c.applicants || [])
    .map(function (x) {
      return x.name;
    })
    .filter(Boolean);
  return a.length ? a.join(' & ') : 'Unnamed client';
}
function remDone(c, r, d) {
  return !!(c.remDone && c.remDone[r.k] === d);
}
/* repeating expiry reminders: first one lead months before the date; each press of "In 30 days" moves it on 30 days; a new date starts again */
function remDue(snoozed, exp, lead) {
  var r0 = addMonths(exp, -lead);
  return /^\d{4}-\d{2}-\d{2}$/.test(snoozed || '') && snoozed >= r0 ? addDays(snoozed, 30) : r0;
}
function reviewItems(c, useStage) {
  var st = stageOf(c),
    out = [];
  T.reminders.forEach(function (r) {
    if (useStage && r.only && r.only.indexOf(st) < 0) return;
    if (
      r.unless &&
      r.unless.some(function (k) {
        return fv(c, k) !== '';
      })
    )
      return;
    var d = fv(c, r.k);
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    var ref = r.ref ? fv(c, r.ref) : '',
      rl = ref
        ? r.refL
          ? '. ' + r.refL + ' ' + (T.byKey[r.ref] && T.byKey[r.ref].t === 'date' ? fd(ref) : ref)
          : ': ' + ref
        : '';
    if (expHas(c, r.k, d)) return;
    if (r.lead) {
      out.push({
        date: remDue(c.remDone && c.remDone[r.k], d, r.lead),
        label: r.l + ' ' + fd(d) + rl,
        key: r.k,
        sec: false,
        rep: 1,
        exp: d
      });
      return;
    }
    if (remDone(c, r, d)) return;
    out.push({ date: d, label: r.l + rl, key: r.k, sec: false });
  });
  return out
    .concat(tnReminders(c))
    .concat(T.tenancyMode ? rlReminders(c).concat(rpReminders(c)) : [])
    .concat(docReminders(c))
    .concat(expItems(c, 'case'))
    .concat(acMtdItems(c));
}
/* accountants: a sole trader in Making Tax Digital for Income Tax gets the next quarterly update worked out (5 Aug, 5 Nov, 5 Feb, 5 May) unless a date is typed in */
function acMtdItems(c) {
  if (!T || T.id !== 'accountant' || c.stMtdQ) return [];
  var m = String(c.stMtd || ''),
    yr = /April (20\d\d)/.exec(m);
  if (!yr && !/voluntar/i.test(m)) return [];
  var min = (yr ? yr[1] : '0000') + '-08-05',
    done = (c.remDone && c.remDone.mtdq) || '',
    y = TODAY.getFullYear(),
    cand = [];
  for (var yy = y - 1; yy <= y + 2; yy++)
    ['02-05', '05-05', '08-05', '11-05'].forEach(function (d) {
      cand.push(yy + '-' + d);
    });
  cand.sort();
  var lim = addDays(iso(TODAY), -30),
    next = cand.filter(function (d) {
      return d >= min && d > done && d >= lim;
    })[0];
  return next ? [{ date: next, label: 'MTD quarterly update due', key: 'mtdq', sec: false }] : [];
}
function reviewOf(c) {
  var r = reviewItems(c)
    .map(function (x) {
      return x.exp || x.date;
    })
    .sort();
  return r[0] || '';
}
function firstName(c) {
  var a =
    (c.applicants || [])
      .map(function (x) {
        return (x.name || '').trim();
      })
      .filter(Boolean)[0] || '';
  return a.replace(/^(mr|mrs|miss|ms|dr)\.?\s+/i, '').toLowerCase();
}
function cnum(c) {
  var m = /(\d+)/.exec(c.clientNo || '');
  return m ? +m[1] : 1e9;
}
function odLink(u) {
  u = String(u || '').trim();
  return /^https?:\/\//i.test(u)
    ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">Open OneDrive folder</a>'
    : '';
}
/* ---------- pasted tables: Excel colours kept, cells editable ---------- */
var ntTable = null,
  prTable = null,
  tblTimer = null;
function safeColor(v) {
  v = String(v || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '';
}
function rgbHex(s) {
  var m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?/.exec(s || '');
  if (!m) return '';
  if (m[4] != null && +m[4] === 0) return '';
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map(function (x) {
        return ('0' + Math.min(255, +x).toString(16)).slice(-2);
      })
      .join('')
  );
}
function lum(h) {
  return (
    (0.299 * parseInt(h.substr(1, 2), 16) +
      0.587 * parseInt(h.substr(3, 2), 16) +
      0.114 * parseInt(h.substr(5, 2), 16)) /
    255
  );
}
function cellStyle(c) {
  var s = [],
    bg = safeColor(c.bg),
    col = safeColor(c.c),
    bd = safeColor(c.bd);
  if (bg) {
    s.push('background:' + bg);
    s.push('color:' + (col || '#101C26'));
  } else if (col && lum(col) > 0.25 && lum(col) < 0.9) {
    s.push('color:' + col);
  }
  if (c.b) s.push('font-weight:700');
  if (c.i) s.push('font-style:italic');
  if (c.a === 'center' || c.a === 'right') s.push('text-align:' + c.a);
  if (bd) s.push('border:1px solid ' + bd);
  return s.join(';');
}
function cellHtml(c, edit) {
  c = c || {};
  var st = cellStyle(c);
  return (
    '<td' +
    (edit ? ' contenteditable="true"' : '') +
    (st ? ' style="' + st + '"' : '') +
    '>' +
    esc(c.v) +
    '</td>'
  );
}
function tblInner(rows, edit) {
  var w = 0;
  rows.forEach(function (r) {
    if (r.length > w) w = r.length;
  });
  return rows
    .map(function (r) {
      var h = '';
      for (var i = 0; i < w; i++) h += cellHtml(r[i], edit);
      return '<tr>' + h + '</tr>';
    })
    .join('');
}
function tblBlock(n, list) {
  var tb = n && n.table;
  if (!tb || !tb.rows || !tb.rows.length) return '';
  return (
    '<div class="tblwrap" data-list="' +
    list +
    '" data-ts="' +
    esc(n.ts) +
    '"><table class="nt xl"><tbody>' +
    tblInner(tb.rows, true) +
    '</tbody></table><div class="tblbar"><button type="button" class="btn ghost sm" data-tb="addrow">Add row</button><button type="button" class="btn ghost sm" data-tb="addcol">Add column</button><button type="button" class="btn ghost sm" data-tb="delrow">Remove last row</button><button type="button" class="btn ghost sm" data-tb="delcol">Remove last column</button>' +
    (list === 'nbtables'
      ? '<button type="button" class="btn danger sm" data-tb="nbdel">Remove table</button>'
      : '') +
    '</div></div>'
  );
}
function pendHtml(k) {
  var tb = k === 'nt' ? ntTable : prTable;
  if (!tb) return '';
  return (
    '<div class="tblpend"><div class="muted" style="margin:6px 0">Table ready: ' +
    tb.rows.length +
    ' rows × ' +
    (tb.rows[0] ? tb.rows[0].length : 0) +
    ' columns. Click Add note to save it. <button type="button" class="btn ghost sm" data-tb="drop' +
    k +
    '">Remove table</button></div><div class="tblwrap"><table class="nt xl"><tbody>' +
    tblInner(tb.rows, false) +
    '</tbody></table></div></div>'
  );
}
function showPend(k) {
  var b = $('#' + k + 'TblBox');
  if (b) b.innerHTML = pendHtml(k);
}
function parseTable(html, cb) {
  var doc = new DOMParser().parseFromString(html, 'text/html'),
    tb = doc.querySelector('table');
  if (!tb) {
    cb(null);
    return;
  }
  doc
    .querySelectorAll('script,link,img,iframe,object,embed,meta,base,form,svg,video,audio')
    .forEach(function (x) {
      x.remove();
    });
  var styles = '';
  doc.querySelectorAll('style').forEach(function (s) {
    styles += s.outerHTML;
  });
  var fr = document.createElement('iframe'),
    done = false;
  fr.setAttribute('sandbox', 'allow-same-origin');
  fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:800px;visibility:hidden;border:0';
  function finish(r) {
    if (done) return;
    done = true;
    try {
      fr.remove();
    } catch (e) {}
    cb(r);
  }
  fr.onload = function () {
    try {
      var d = fr.contentDocument,
        w = fr.contentWindow,
        rows = [],
        width = 0,
        cells = 0,
        cut = false;
      d.querySelectorAll('table tr').forEach(function (tr) {
        if (rows.length >= 200 || cells > 1500) {
          cut = true;
          return;
        }
        var r = [];
        Array.prototype.slice.call(tr.children).forEach(function (td) {
          if (!/^t[dh]$/i.test(td.tagName) || r.length >= 30) return;
          var cs = w.getComputedStyle(td),
            c = { v: (td.textContent || '').replace(/\s+/g, ' ').trim() };
          var bg = rgbHex(cs.backgroundColor);
          if (bg) c.bg = bg;
          var fc = rgbHex(cs.color);
          if (fc && lum(fc) > 0.12) c.c = fc;
          var fw = cs.fontWeight;
          if (fw === 'bold' || +fw >= 600) c.b = 1;
          if (cs.fontStyle === 'italic') c.i = 1;
          if (cs.textAlign === 'center' || cs.textAlign === 'right') c.a = cs.textAlign;
          var bc = '';
          ['Top', 'Right', 'Bottom', 'Left'].forEach(function (sd) {
            if (!bc && cs['border' + sd + 'Style'] !== 'none' && parseFloat(cs['border' + sd + 'Width']) > 0)
              bc = rgbHex(cs['border' + sd + 'Color']) || '#888888';
          });
          if (bc) c.bd = bc;
          r.push(c);
          cells++;
          var span = Math.min(+td.getAttribute('colspan') || 1, 10);
          for (var k = 1; k < span && r.length < 30; k++) {
            var e = { v: '' };
            if (c.bg) e.bg = c.bg;
            if (c.bd) e.bd = c.bd;
            r.push(e);
          }
        });
        if (r.length) {
          rows.push(r);
          if (r.length > width) width = r.length;
        }
      });
      rows.forEach(function (r) {
        while (r.length < width) r.push({ v: '' });
      });
      finish(rows.length ? { rows: rows, cut: cut } : null);
    } catch (e) {
      finish(null);
    }
  };
  setTimeout(function () {
    finish(null);
  }, 4000);
  fr.srcdoc =
    '<!doctype html><html><head><meta charset="utf-8">' +
    styles +
    '</head><body>' +
    tb.outerHTML +
    '</body></html>';
  document.body.appendChild(fr);
}
function readRows(w) {
  var ts = +w.getAttribute('data-ts'),
    list = w.getAttribute('data-list'),
    c =
      list === 'nbtables'
        ? notes.filter(function (x) {
            return x.id === nbShown;
          })[0]
        : currentCase();
  if (!c) return null;
  var arr = (list === 'nbtables' ? c.tables : c[list]) || [],
    idx = -1;
  arr.forEach(function (n, i) {
    if (n.ts === ts) idx = i;
  });
  if (idx < 0 || !arr[idx].table) return null;
  var old = arr[idx].table.rows,
    rows = [];
  w.querySelectorAll('tr').forEach(function (tr, ri) {
    var r = [];
    tr.querySelectorAll('td').forEach(function (td, ci) {
      var o = Object.assign({}, (old[ri] || [])[ci] || {});
      o.v = td.textContent.replace(/ /g, ' ');
      r.push(o);
    });
    rows.push(r);
  });
  return { list: list, idx: idx, arr: arr, rows: rows };
}
function commitTbl(info, rows) {
  var arr = info.arr.map(function (n, i) {
    if (i !== info.idx) return n;
    var m = Object.assign({}, n);
    m.table = { rows: rows };
    return m;
  });
  if (info.list === 'nbtables') {
    nbSetTables(arr);
    return;
  }
  var o = {};
  o[info.list] = arr;
  patch(openId, o);
}
function saveTbl(w) {
  var info = readRows(w);
  if (!info) return;
  if (JSON.stringify(info.rows) === JSON.stringify(info.arr[info.idx].table.rows)) return;
  commitTbl(info, info.rows);
}
function cellTxt(c) {
  c = String(c);
  if (c.length > 1 && c.charAt(0) === '"' && c.charAt(c.length - 1) === '"')
    c = c.slice(1, -1).replace(/""/g, '"');
  return c.trim();
}
function tableHtml(rows) {
  var w = 0;
  rows.forEach(function (r) {
    if (r.length > w) w = r.length;
  });
  function tr(r, tag) {
    var h = '';
    for (var i = 0; i < w; i++) h += '<' + tag + '>' + esc(r[i] == null ? '' : r[i]) + '</' + tag + '>';
    return '<tr>' + h + '</tr>';
  }
  return (
    '<div class="tblwrap"><table class="nt"><thead>' +
    tr(rows[0], 'th') +
    '</thead><tbody>' +
    rows
      .slice(1)
      .map(function (r) {
        return tr(r, 'td');
      })
      .join('') +
    '</tbody></table></div>'
  );
}
function paras(t) {
  var lines = String(t || '')
      .replace(/\r\n?/g, '\n')
      .split('\n'),
    out = [],
    tbl = [],
    k = 0;
  function flush() {
    if (!tbl.length) return;
    out.push(
      '<div class="np np' +
        (k++ % 6) +
        '">' +
        (tbl.length > 1 ? tableHtml(tbl) : esc(tbl[0].join('  '))) +
        '</div>'
    );
    tbl = [];
  }
  lines.forEach(function (l) {
    if (l.indexOf('\t') >= 0) {
      var cells = l.split('\t').map(cellTxt);
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      if (cells.length > 1 || (cells.length === 1 && cells[0])) {
        tbl.push(cells);
        return;
      }
    }
    flush();
    if (l.trim()) out.push('<div class="np np' + (k++ % 6) + '">' + esc(l) + '</div>');
  });
  flush();
  return out.join('');
}
function nextTask(c) {
  var d = (c.tasks || [])
    .filter(function (t) {
      return !t.done && t.due;
    })
    .map(function (t) {
      return t.due;
    })
    .sort();
  return d[0] || '';
}
function taskCell(c) {
  var d = nextTask(c);
  return (
    '<td>' +
    (d ? '<span class="chip ' + tone(d) + '">' + fd(d) + '</span>' : '<span class="muted">—</span>') +
    '</td>'
  );
}
function sortList(l) {
  return l.slice().sort(function (a, b) {
    if (sortBy === 'first') {
      var x = firstName(a),
        y = firstName(b);
      if (!x && y) return 1;
      if (x && !y) return -1;
      return x.localeCompare(y) || cnum(a) - cnum(b);
    }
    if (sortBy === 'review') {
      var ra = reviewOf(a),
        rb = reviewOf(b);
      if (!ra && rb) return 1;
      if (ra && !rb) return -1;
      return ra < rb ? -1 : ra > rb ? 1 : firstName(a).localeCompare(firstName(b));
    }
    if (sortBy === 'task') {
      var ka = nextTask(a),
        kb = nextTask(b);
      if (!ka && kb) return 1;
      if (ka && !kb) return -1;
      return ka < kb ? -1 : ka > kb ? 1 : cnum(a) - cnum(b);
    }
    if (sortBy === 'clientno') return cnum(a) - cnum(b);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}
function short(addr) {
  return (addr || '').split('\n')[0] || '';
}
function ltv(c) {
  return c.loanAmount && (c.propertyValue || c.purchasePrice)
    ? (c.loanAmount / (c.purchasePrice || c.propertyValue)) * 100
    : null;
}
function toast(m, sticky) {
  var t = $('#toast');
  t.textContent = m;
  t.hidden = false;
  clearTimeout(toast.h);
  if (!sticky)
    toast.h = setTimeout(function () {
      t.hidden = true;
    }, 3200);
}

/* ---------- writes (one at a time per document) ---------- */
function write(id, fn) {
  var p = (queues[id] || Promise.resolve()).then(fn).catch(function (e) {
    toast('Not saved: ' + ((e && e.message) || 'try again'));
  });
  queues[id] = p;
  return p;
}
function patch(id, data) {
  if (!col) return Promise.resolve();
  data.updatedAt = Date.now();
  return write(id, function () {
    return col.doc(id).update(data);
  });
}

/* ---------- events / reminders ---------- */
function caseEvents(c) {
  var ev = [],
    n = names(c);
  reviewItems(c, true).forEach(function (r) {
    ev.push({
      date: r.date,
      label: r.label,
      kind: 'review',
      id: c.id,
      who: n + (r.sx ? ' · ' + r.sx : ''),
      key: r.key,
      rep: r.rep,
      exp: r.exp
    });
  });
  (c.tasks || []).forEach(function (t) {
    if (!t.done && t.due)
      ev.push({ date: t.due, label: t.text, kind: 'task', id: c.id, who: n, key: 'task:' + (t.id || '') });
  });
  return ev;
}
function allEvents() {
  var out = [];
  cases.forEach(function (c) {
    if (c.stage !== 'lost') out = out.concat(caseEvents(c));
  });
  out = out.concat(homeEvents(), carEvents());
  return out.sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}
function apEvents() {
  var t = iso(TODAY);
  return appts
    .filter(function (a) {
      return (
        a.date &&
        a.status !== 'cancelled' &&
        a.status !== 'done' &&
        a.status !== 'noshow' &&
        a.date >= addDays(t, -30)
      );
    })
    .map(function (a) {
      return {
        date: a.date,
        label: (a.time ? a.time + ' · ' : '') + (a.title || a.type || a.what || 'Appointment'),
        kind: 'appt',
        id: a.id,
        who: apWho(a),
        key: 'ap:' + a.id
      };
    });
}
function reviewEvents() {
  var out = allEvents().filter(function (e) {
    return e.kind === 'review' || ((T.tenancyMode || T.noTasks) && e.kind === 'task');
  });
  if (T.tenancyMode || T.noTasks) out = out.concat(apEvents());
  out.forEach(function (e) {
    if (e.kind === 'task' && !e.key) e.key = 'task:' + e.label;
  });
  return out.sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}
/* key dates for the Outlook calendar: sync.js turns these into 9am events with a phone alert */
window.CD_keyDates = function () {
  if (!loaded || !db) return null;
  var out = [];
  cases.forEach(function (c) {
    if (c.stage === 'lost') return;
    var n = names(c);
    reviewItems(c, true).forEach(function (r) {
      out.push({ key: c.id + '|' + r.key, date: kdNext(r), title: r.head || r.label, who: n });
    });
    (c.tasks || []).forEach(function (t, i) {
      if (!t.done && t.due)
        out.push({ key: c.id + '|task:' + (t.id || i), date: t.due, title: t.text, who: n });
    });
  });
  homeEvents().forEach(function (e) {
    out.push({ key: 'home|' + e.key, date: kdNext(e), title: e.label, who: 'My residential house' });
  });
  carEvents().forEach(function (e) {
    out.push({ key: 'car|' + e.id.slice(6) + '|' + e.key, date: kdNext(e), title: e.label, who: e.who });
  });
  return out;
};
function kdNext(r) {
  if (!r.rep) return r.date;
  var n = diff(r.date);
  return n >= 0 ? r.date : addDays(r.date, Math.ceil(-n / 30) * 30);
}
function nextEvent(c) {
  var e = caseEvents(c).sort(function (a, b) {
    return a.date < b.date ? -1 : 1;
  });
  var over = e.filter(function (x) {
    return diff(x.date) < 0;
  })[0];
  return (
    over ||
    e.filter(function (x) {
      return diff(x.date) >= 0;
    })[0] ||
    null
  );
}
function tone(date) {
  var n = diff(date);
  return n < 0 ? 'bad' : n <= 7 ? 'warn' : '';
}
function dueCount() {
  return reviewEvents().filter(function (e) {
    return diff(e.date) < 0;
  }).length;
}

/* ---------- filtering ---------- */
function visible() {
  var q = query.trim().toLowerCase();
  return cases.filter(function (c) {
    if (stageFilter === 'lost' && c.stage !== 'lost') return false;
    if (lenderFilter && T.filter && (c[T.filter.k] || '') !== lenderFilter) return false;
    if (stageFilter && stageFilter !== 'lost' && stageOf(c) !== stageFilter) return false;
    if (revFilter) {
      var rv = reviewOf(c);
      if (revFilter === 'none' ? !!rv : rv.slice(0, 7) !== revFilter) return false;
    }
    if (!q) return true;
    var hay = [names(c), c.clientNo, c.type, c.companyName, c.companyNumber, coNo(c)]
      .concat(
        T.fields
          .filter(function (f) {
            return f.t !== 'date' && f.t !== 'money' && f.t !== 'num';
          })
          .map(function (f) {
            return c[f.k] || '';
          })
      )
      .concat(
        (c.applicants || []).map(function (a) {
          return [a.phone, a.email, a.address].join(' ');
        })
      )
      .join(' ')
      .toLowerCase();
    return hay.indexOf(q) > -1;
  });
}
