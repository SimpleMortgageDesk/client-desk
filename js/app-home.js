'use strict';
/* MySimpleDesk app: The person's own residential property.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- My home: the landlord's own residential property (settings/home). Kept apart from rental properties, rent totals and the accountant report. ---------- */
var HOME_F = [
  [
    'Your home',
    [
      ['addr1', 'Address line one', 'text'],
      ['postcode', 'Postcode', 'text'],
      [
        'ownership',
        'Ownership',
        'sel',
        ['', 'Owned with a mortgage', 'Owned outright', 'Shared ownership', 'Renting']
      ],
      ['ptype', 'Type', 'sel', ['', 'House', 'Flat', 'Bungalow', 'Maisonette', 'Other']],
      ['bedrooms', 'Bedrooms', 'num'],
      ['purchaseDate', 'Bought on', 'date'],
      ['purchasePrice', 'Price paid', 'money'],
      ['value', 'Estimated value now', 'money'],
      ['valueDate', 'Value checked on', 'date']
    ]
  ],
  [
    'Mortgage',
    [
      ['lender', 'Lender', 'text'],
      ['balance', 'Mortgage balance', 'money'],
      ['rate', 'Interest rate (% a year)', 'num'],
      ['payment', 'Monthly payment', 'money'],
      ['method', 'Payment method', 'sel', ['', 'Repayment', 'Interest only', 'Part and part']],
      ['dealType', 'Type of deal', 'sel', ['', 'Fixed rate', 'Tracker', 'Discount', 'Variable (SVR)']],
      ['dealEnd', 'Deal ends', 'date'],
      ['ercEnd', 'Early repayment charge until', 'date'],
      ['termEnd', 'Mortgage term ends', 'date']
    ]
  ],
  [
    'Insurance and bills',
    [
      ['insurer', 'Home insurer', 'text'],
      ['insRenewal', 'Insurance renewal', 'date'],
      ['energy', 'Energy supplier', 'text'],
      ['energyEnd', 'Energy deal ends', 'date'],
      ['councilBand', 'Council tax band', 'sel', ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']]
    ]
  ],
  [
    'Safety and upkeep',
    [
      ['boiler', 'Boiler last serviced', 'date'],
      ['boilerDue', 'Next boiler service (12 months)', 'date', null, { from: 'boiler', m: 12 }],
      ['eicr', 'Electrical check done', 'date'],
      ['eicrDue', 'Next electrical check (every 10 years)', 'date', null, { from: 'eicr', m: 120 }],
      ['epc', 'EPC rating', 'sel', ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G']]
    ]
  ]
];
function homeF(k) {
  var f = null;
  HOME_F.forEach(function (g) {
    g[1].forEach(function (x) {
      if (x[0] === k) f = x;
    });
  });
  return f;
}
function homeV(h, k) {
  h = h || {};
  if (h[k]) return h[k];
  var f = homeF(k);
  if (f && f[4] && h[f[4].from]) return addMonths(h[f[4].from], f[4].m);
  return '';
}
function homeEvents() {
  var h = HOME;
  if (!h || !h.addr1) return [];
  var out = [],
    who = 'My residential house · ' + h.addr1;
  function add(k, exp, label, lead) {
    if (!exp || !/^\d{4}-\d{2}-\d{2}$/.test(exp) || expHas(h, k, exp)) return;
    out.push({
      date: remDue(h.remDone && h.remDone[k], exp, lead),
      label: label + ' ' + fd(exp),
      kind: 'review',
      id: '__home',
      who: who,
      key: k,
      rep: 1,
      exp: exp
    });
  }
  add('dealEnd', homeV(h, 'dealEnd'), 'Mortgage deal ends', 4);
  add('insRenewal', homeV(h, 'insRenewal'), 'Home insurance renewal', 2);
  add('energyEnd', homeV(h, 'energyEnd'), 'Energy deal ends', 2);
  add('boilerDue', homeV(h, 'boilerDue'), 'Boiler service due', 2);
  add('eicrDue', homeV(h, 'eicrDue'), 'Electrical check due', 2);
  expItems(h, 'home').forEach(function (i) {
    out.push({
      date: i.date,
      label: i.label,
      kind: 'review',
      id: '__home',
      who: who + ' · ' + i.sx,
      key: i.key,
      rep: 1,
      exp: i.exp
    });
  });
  return out;
}
/* the home address, in small type, under the My home tab */
function homeLine() {
  var h = HOME;
  return h && h.addr1
    ? [String(h.addr1).trim(), String(h.postcode || '').trim()].filter(Boolean).join(', ')
    : '';
}
function homeSmall(top) {
  var a = homeLine();
  return a
    ? '<small title="' +
        esc(a) +
        '" style="display:block;font-size:11px;font-weight:400;line-height:1.3;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:' +
        (top ? '170px' : '100%') +
        '">' +
        esc(a) +
        '</small>'
    : '';
}
var hfRun = false,
  hfTried = false;
function hfSweep() {
  var h = HOME;
  if (
    hfRun ||
    hfTried ||
    !h ||
    !h.addr1 ||
    (h.folder && h.folder.rc) ||
    !window.CD_files ||
    !window.CD_files.can()
  )
    return;
  hfRun = true;
  hfTried = true;
  var nm = (h.folder && h.folder.name) || pfClean(String(h.addr1).split(/[\n,]/)[0]) || 'My home';
  window.CD_files.folder(nm, 'Home').then(
    function (f) {
      hfRun = false;
      if (f && f.name && HOME && HOME.addr1)
        homeWrite(Object.assign({}, HOME, { folder: Object.assign({}, HOME.folder || {}, f) }));
    },
    function () {
      hfRun = false;
    }
  );
}
function homeWrite(d) {
  d.savedAt = Date.now();
  HOME = d;
  if (setCol)
    write('set-home', function () {
      return setCol.doc('home').set(d);
    });
  if (view === 'cases' || view === 'assets' || view === 'myhome') render();
  renderRem();
  renderNav();
  renderSide();
}
var HOME_DUE = { dealEnd: 1, ercEnd: 1, termEnd: 1, insRenewal: 1, energyEnd: 1, boilerDue: 1, eicrDue: 1 };
function homeRows(h, g) {
  var out = g[1]
    .map(function (x) {
      var k = x[0],
        t = x[2],
        v = homeV(h, k);
      if (k === 'addr1' || k === 'postcode' || v === '' || v == null) return '';
      var val =
        t === 'date'
          ? HOME_DUE[k]
            ? '<span class="chip ' + tone(v) + '">' + esc(fd(v)) + '</span>'
            : esc(fd(v))
          : t === 'money'
            ? esc(money(v))
            : esc(k === 'rate' ? v + '%' : String(v));
      return '<div class="hrow"><span>' + esc(x[1]) + '</span><b>' + val + '</b></div>';
    })
    .join('');
  return out || '<p class="muted" style="margin:0">Nothing added yet. Press View and edit.</p>';
}
function homeCard(pg) {
  var h = HOME,
    hd = pg ? '' : '<h2>My residential house</h2>';
  if (!h || !h.addr1)
    return (
      '<section class="homecard empty"><div class="hch"><div>' +
      hd +
      '<p class="muted">Keep a record of your own home: mortgage and deal end date, insurance, bills, safety checks, and your receipts and expenses. It is kept separate from your ' +
      (T.tenancyMode ? 'rental properties, rent totals and accountant reports.' : 'business records.') +
      '</p></div><button type="button" class="btn" id="homeAdd">Add my home</button></div></section>'
    );
  var bal = +h.balance || 0,
    val = +h.value || 0,
    ltv = bal && val ? Math.round((bal / val) * 1000) / 10 : null,
    eq = val ? val - bal : null;
  var chip = function (d, l) {
    return d ? '<span class="chip ' + tone(d) + '">' + esc(l) + ' ' + fd(d) + '</span>' : '';
  };
  var fact = function (l, v) {
    return v ? '<div class="hf"><span>' + esc(l) + '</span><b>' + v + '</b></div>' : '';
  };
  var ty = taxYear(iso(TODAY)),
    el = expList(h),
    tyTot = el
      .filter(function (e) {
        return e.date >= ty.from && e.date <= ty.to;
      })
      .reduce(function (a, e) {
        return a + (+e.amount || 0);
      }, 0);
  var card = function (t, body, extra) {
    return (
      '<section class="hcard"><div class="hcardhd"><h3>' +
      esc(t) +
      '</h3>' +
      (extra || '') +
      '</div>' +
      body +
      '</section>'
    );
  };
  var expBody = el.length
    ? '<p class="muted" style="margin:0 0 6px;font-size:13px">Tax year ' +
      ty.label +
      ' so far: <b>' +
      gbp(tyTot) +
      '</b> · ' +
      el.length +
      ' item' +
      (el.length === 1 ? '' : 's') +
      '</p>' +
      el
        .slice(0, 4)
        .map(function (e) {
          return (
            '<div class="hrow"><span>' +
            esc(fd(e.date)) +
            ' · ' +
            esc(e.desc || e.cat || '') +
            '</span><b>' +
            esc(gbp(e.amount)) +
            (e.receipt && rcUrl(e.receipt.url)
              ? ' <a class="doclink" href="' +
                esc(e.receipt.url) +
                '" target="_blank" rel="noopener" title="Show receipt">Receipt</a>'
              : '') +
            '</b></div>'
          );
        })
        .join('')
    : '<p class="muted" style="margin:0">No receipts or expenses recorded for your home yet.</p>';
  return (
    '<div class="homepage"><section class="homecard"><div class="hch"><div>' +
    hd +
    '<div class="hadr">' +
    esc(h.addr1) +
    (h.postcode ? ', ' + esc(h.postcode) : '') +
    '</div><div class="muted" style="font-size:13px">' +
    esc([h.ownership, h.ptype, h.bedrooms ? h.bedrooms + ' bed' : ''].filter(Boolean).join(' · ')) +
    '</div></div><div class="add" style="margin:0"><button type="button" class="btn" id="homeExp">Receipts and expenses</button><button type="button" class="btn ghost" id="homeEdit">View and edit</button></div></div>' +
    '<div class="hfacts">' +
    fact('Estimated value', val ? money(val) : '') +
    fact('Mortgage balance', bal ? money(bal) : '') +
    fact('Equity', eq != null && bal ? money(eq) : '') +
    fact('Loan to value', ltv != null ? ltv + '%' : '') +
    fact('Lender', esc(h.lender || '')) +
    fact(
      'Rate',
      h.rate ? esc(h.rate) + '%' + (h.dealType ? ' ' + esc(String(h.dealType).toLowerCase()) : '') : ''
    ) +
    fact('Monthly payment', h.payment ? money(h.payment) : '') +
    '</div>' +
    '<div class="hchips">' +
    chip(homeV(h, 'dealEnd'), 'Deal ends') +
    chip(homeV(h, 'insRenewal'), 'Insurance renewal') +
    chip(homeV(h, 'boilerDue'), 'Boiler service') +
    chip(homeV(h, 'energyEnd'), 'Energy deal ends') +
    '</div>' +
    advBox(homeV(h, 'dealEnd'), 'Mortgage deal on your home') +
    '</section>' +
    '<div class="homegrid">' +
    HOME_F.map(function (g) {
      return card(g[0] === 'Your home' ? 'About your home' : g[0], homeRows(h, g));
    }).join('') +
    card(
      'Documents',
      (h.files || []).length
        ? '<p class="muted" style="margin:0 0 6px;font-size:13px">' +
            (h.files || []).length +
            ' document' +
            ((h.files || []).length === 1 ? '' : 's') +
            ' saved in your ' +
            esc((window.CD_files && window.CD_files.where && window.CD_files.where()) || 'file storage') +
            '</p>' +
            (h.files || [])
              .slice(-3)
              .reverse()
              .map(function (f) {
                return (
                  '<div class="hrow"><span><a class="doclink" href="' +
                  esc(f.url) +
                  '" target="_blank" rel="noopener">' +
                  esc(f.name) +
                  '</a></span></div>'
                );
              })
              .join('')
        : '<p class="muted" style="margin:0">Insurance, boiler and electrical certificates and your mortgage papers. Upload them here and we read the date and remind you.</p>',
      '<button type="button" class="btn ghost sm" data-dsopen="__home">' +
        ((h.files || []).length ? 'Open' : 'Add') +
        '</button>'
    ) +
    card(
      'Receipts and expenses',
      expBody,
      '<button type="button" class="btn ghost sm" data-homeexp="1">Open</button>'
    ) +
    (h.notes ? card('Notes', '<p style="margin:0;white-space:pre-wrap">' + esc(h.notes) + '</p>') : '') +
    '</div></div>'
  );
}
function homeOpen() {
  var h = HOME || {};
  var fld = function (x) {
    var k = x[0],
      l = x[1],
      t = x[2],
      v = h[k] == null ? '' : h[k];
    if (t === 'sel')
      return (
        '<label class="f">' +
        esc(l) +
        '<select id="hm-' +
        k +
        '">' +
        x[3]
          .map(function (o) {
            return (
              '<option value="' +
              esc(o) +
              '"' +
              (o === v ? ' selected' : '') +
              '>' +
              (o === '' ? 'Choose…' : esc(o)) +
              '</option>'
            );
          })
          .join('') +
        '</select></label>'
      );
    if (x[4])
      return (
        '<label class="f">' +
        esc(l) +
        '<input id="hm-' +
        k +
        '" type="date" data-hfrom="' +
        x[4].from +
        '" data-hm="' +
        x[4].m +
        '" data-auto="' +
        (v ? '0' : '1') +
        '" value="' +
        esc(homeV(h, k)) +
        '"></label>'
      );
    var inp =
      '<input id="hm-' +
      k +
      '" type="' +
      (t === 'date' ? 'date' : t === 'text' ? 'text' : 'number" step="any" inputmode="decimal') +
      '" value="' +
      esc(v) +
      '">';
    return (
      '<label class="f">' +
      esc(l) +
      (t === 'money' ? '<span class="ig"><i>£</i>' + inp + '</span>' : inp) +
      '</label>'
    );
  };
  overlay(
    'hmOv',
    '<div class="dhd"><h2>My residential house</h2><button type="button" class="btn ghost" data-hmclose="1">Close</button></div>' +
      '<p class="muted" style="margin:4px 0 12px">Your own home, kept apart from your rental properties. It is saved in your own ' +
      esc(window.CD_files ? window.CD_files.where() : 'storage') +
      '. Do not add account numbers or bank details.</p>' +
      HOME_F.map(function (g) {
        return (
          '<fieldset><legend>' +
          esc(g[0]) +
          '</legend><div class="grid">' +
          g[1].map(fld).join('') +
          '</div></fieldset>'
        );
      }).join('') +
      '<fieldset><legend>Notes</legend><label class="f wide">Notes<textarea id="hm-notes" rows="3">' +
      esc(h.notes || '') +
      '</textarea></label></fieldset>' +
      '<p id="hmMsg" class="muted" role="alert"></p><div class="add" style="justify-content:flex-end">' +
      (HOME && HOME.addr1
        ? '<button type="button" class="btn ghost danger" data-hmdel="1" style="margin-right:auto">Remove my home</button>'
        : '') +
      '<button type="button" class="btn ghost" data-hmclose="1">Cancel</button><button type="button" class="btn" data-hmsave="1">Save</button></div>',
    true
  );
}
function homeSave() {
  var d = Object.assign({}, HOME || {}),
    m = $('#hmMsg');
  delete d.removedAt;
  HOME_F.forEach(function (g) {
    g[1].forEach(function (x) {
      var e = $('#hm-' + x[0]);
      if (!e) return;
      var v = e.value.trim();
      if (x[4]) {
        var src = ($('#hm-' + x[4].from) || {}).value || '';
        if (e.getAttribute('data-auto') === '1' || (src && v === addMonths(src, x[4].m))) {
          d[x[0]] = '';
          return;
        }
      }
      d[x[0]] = x[2] === 'money' || x[2] === 'num' ? (v === '' ? '' : num(v)) : v;
    });
  });
  d.notes = ($('#hm-notes') || {}).value || '';
  if (d.postcode) d.postcode = pcFmt(d.postcode);
  if (!String(d.addr1 || '').trim()) {
    if (m) {
      m.textContent = 'Add address line one.';
      m.style.color = '#b3261e';
    }
    var a = $('#hm-addr1');
    if (a) {
      a.focus();
      a.scrollIntoView({ block: 'center' });
    }
    return;
  }
  homeWrite(d);
  closeOv('hmOv');
  toast('My residential house saved');
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('#homeAdd') || t.closest('#homeEdit')) {
    homeOpen();
    return;
  }
  if (t.closest('#homeExp') || t.closest('[data-homeexp]')) {
    expOpen(HOME_ID);
    return;
  }
  if (t.closest('[data-hmclose]')) {
    closeOv('hmOv');
    return;
  }
  if (t.closest('[data-hmsave]')) {
    homeSave();
    return;
  }
  var dl = t.closest('[data-hmdel]');
  if (dl) {
    if (!dl.classList.contains('armed')) {
      dl.classList.add('armed');
      var nx = ((HOME && HOME.expenses) || []).length;
      dl.textContent = nx
        ? 'Press again to remove. This also removes its ' +
          nx +
          ' expense record' +
          (nx === 1 ? '' : 's') +
          '.'
        : 'Press again to remove';
      return;
    }
    homeWrite({ removedAt: Date.now() });
    closeOv('hmOv');
    toast('My residential house removed');
    return;
  }
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || !t.id || t.id.indexOf('hm-') !== 0) return;
  if (t.hasAttribute('data-hfrom')) t.setAttribute('data-auto', t.value ? '0' : '1');
  document.querySelectorAll('#hmOv [data-hfrom="' + t.id.slice(3) + '"]').forEach(function (dep) {
    if (dep.getAttribute('data-auto') !== '1') return;
    dep.value =
      t.value && /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? addMonths(t.value, +dep.getAttribute('data-hm')) : '';
  });
});

/* --- business details panel (saved to OneDrive, same on every device) --- */
var bizDraftLogo = null;
function openBiz() {
  var locked = BIZ.savedAt && window.CD_reFresh && !window.CD_reFresh(),
    dis = locked ? ' disabled' : '',
    p = profA(),
    b = BIZ;
  bizDraftLogo = null;
  var f = function (k, l, v, ph, type) {
    return (
      '<label class="f">' +
      l +
      '<input id="bz-' +
      k +
      '" type="' +
      (type || 'text') +
      '"' +
      dis +
      ' value="' +
      esc(v == null ? '' : v) +
      '" placeholder="' +
      esc(ph || '') +
      '"></label>'
    );
  };
  var a = function (k, l, v, ph) {
    return (
      '<label class="f wide">' +
      l +
      '<textarea id="bz-' +
      k +
      '" rows="3"' +
      dis +
      ' placeholder="' +
      esc(ph || '') +
      '">' +
      esc(v || '') +
      '</textarea></label>'
    );
  };
  overlay(
    'bzOv',
    '<div class="dhd"><h2>Business details</h2><button type="button" class="btn ghost" data-bzclose="1">Close</button></div>' +
      '<p class="muted" style="margin:4px 0 10px">These appear on your quotes, invoices' +
      (T.id === 'landlord' ? ' and tenancy agreements' : '') +
      '. They are saved in your OneDrive, so every device uses the same details.</p>' +
      (locked
        ? '<p class="dnote">Locked. To change your business or payment details, confirm with your Microsoft account password. This stops anyone else changing where customers pay you.</p><button type="button" class="btn" data-bzunlock="1" style="margin-bottom:10px">Unlock to edit</button>'
        : '') +
      '<div class="bzlogo"><div id="bzLogoBox">' +
      (okLogo(b.logo)
        ? '<img src="' + b.logo + '" alt="Your logo">'
        : '<span class="muted">No logo yet</span>') +
      '</div><div><label class="btn ghost sm' +
      (locked ? ' disabled' : '') +
      '">Upload logo<input type="file" id="bzLogo" accept="image/*" hidden' +
      dis +
      '></label> ' +
      (okLogo(b.logo)
        ? '<button type="button" class="btn ghost sm" data-bzlogodel="1"' + dis + '>Remove logo</button>'
        : '') +
      '<div class="muted" style="font-size:12px;margin-top:4px">PNG or JPG. It is resized to keep your files small.</div></div></div>' +
      '<div class="grid">' +
      f('name', 'Business or trading name', b.name != null ? b.name : p.biz, '') +
      f('owner', 'Your name (shown as the contact)', b.owner != null ? b.owner : p.name, '') +
      a('address', 'Business address', b.address, 'Street, town, postcode') +
      f('phone', 'Phone', b.phone != null ? b.phone : p.phone ? ukPhone(p.phone) : '', '', 'tel') +
      f('email', 'Email', b.email != null ? b.email : p.email, '', 'email') +
      f('web', 'Website', b.web, 'www.example.co.uk') +
      f(
        'reg',
        'Registration (e.g. Gas Safe, NICEIC, ARB, SRA, FCA number)',
        b.reg != null ? b.reg : p.reg,
        ''
      ) +
      f('companyNo', 'Company number (limited companies)', b.companyNo, '') +
      a('regOffice', 'Registered office (if different from the business address)', b.regOffice, '') +
      '<label class="f">VAT registered<select id="bz-vatReg"' +
      dis +
      '><option value="no">No</option><option value="yes"' +
      (b.vatReg === 'yes' ? ' selected' : '') +
      '>Yes</option></select></label>' +
      f('vatNo', 'VAT number', b.vatNo, 'GB123456789') +
      f('vatRate', 'Usual VAT rate (%)', b.vatRate != null ? b.vatRate : 20, '', 'number') +
      a(
        'payDetails',
        'How customers pay you (your own business account, shown on invoices)',
        b.payDetails,
        'For example: Bank transfer to Example Ltd, sort code 00-00-00, account 00000000'
      ) +
      f('payTerms', 'Payment due after (days)', b.payTerms != null ? b.payTerms : 14, '', 'number') +
      f('quoteValid', 'Quotes valid for (days)', b.quoteValid != null ? b.quoteValid : 30, '', 'number') +
      f('invPrefix', 'Invoice number starts with', b.invPrefix != null ? b.invPrefix : 'INV-', '') +
      f('nextInv', 'Next invoice number', b.nextInv || 1001, '', 'number') +
      f('quotePrefix', 'Quote number starts with', b.quotePrefix != null ? b.quotePrefix : 'Q-', '') +
      f('nextQuote', 'Next quote number', b.nextQuote || 1001, '', 'number') +
      a(
        'terms',
        'Notes printed at the bottom of every quote and invoice',
        b.terms != null ? b.terms : 'Thank you for your business.',
        ''
      ) +
      '</div><div class="mkact"><button type="button" class="btn" data-bzsave="1"' +
      dis +
      '>Save business details</button><button type="button" class="btn ghost" data-bzclose="1">Cancel</button></div><p id="bzMsg" class="muted" style="min-height:18px"></p>'
  );
}
window.CD_openBiz = openBiz;
function logoLoad(file, cb) {
  var fr = new FileReader();
  fr.onload = function () {
    var im = new Image();
    im.onload = function () {
      var s = Math.min(1, 600 / im.width, 300 / im.height),
        w = Math.max(1, Math.round(im.width * s)),
        h = Math.max(1, Math.round(im.height * s)),
        cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      var x = cv.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, w, h);
      x.drawImage(im, 0, 0, w, h);
      cb({ src: cv.toDataURL('image/jpeg', 0.88), w: w, h: h });
    };
    im.onerror = function () {
      cb(null);
    };
    im.src = fr.result;
  };
  fr.onerror = function () {
    cb(null);
  };
  fr.readAsDataURL(file);
}
/* ---------- payment accounts (up to two) shown on invoices ---------- */
function payAccs() {
  var o = [];
  if (String(BIZ.payDetails || '').trim())
    o.push({ n: 1, label: BIZ.payLabel || 'Account 1', text: BIZ.payDetails });
  if (String(BIZ.payDetails2 || '').trim())
    o.push({ n: 2, label: BIZ.payLabel2 || 'Account 2', text: BIZ.payDetails2 });
  return o;
}
function payFor(d) {
  var a = payAccs();
  if (!a.length) return '';
  var pick =
    a.filter(function (x) {
      return d && x.n === +d.payAcc;
    })[0] || a[0];
  return pick.text;
}
/* "Edit invoice details" in Settings: up to two payment accounts, invoice numbering and payment terms */
function openInv() {
  if (BIZ.savedAt && window.CD_reGate && !window.CD_reGate('inv')) return;
  var b = BIZ,
    f = function (id, l, v, ph, type) {
      return (
        '<label class="f">' +
        l +
        '<input id="iv-' +
        id +
        '" type="' +
        (type || 'text') +
        '" value="' +
        esc(v == null ? '' : v) +
        '" placeholder="' +
        esc(ph || '') +
        '"></label>'
      );
    },
    a = function (id, l, v, ph) {
      return (
        '<label class="f wide">' +
        l +
        '<textarea id="iv-' +
        id +
        '" rows="3" placeholder="' +
        esc(ph || '') +
        '">' +
        esc(v || '') +
        '</textarea></label>'
      );
    };
  overlay(
    'ivOv',
    '<div class="dhd"><h2>Invoice details</h2><button type="button" class="btn ghost" data-ivclose="1">Close</button></div>' +
      '<p class="muted" style="margin:6px 0 12px">Add up to two bank accounts. When you make an invoice you choose which one it shows. Only add your own business account details, never a customer\'s.</p>' +
      '<div class="grid">' +
      f('label', 'Account 1 name (for you)', b.payLabel, 'For example: Business account') +
      a(
        'pay',
        'Account 1 details shown on invoices',
        b.payDetails,
        'For example: Bank transfer to Example Ltd, sort code 00-00-00, account 00000000'
      ) +
      f('label2', 'Account 2 name (for you)', b.payLabel2, 'For example: Client account') +
      a('pay2', 'Account 2 details shown on invoices (optional)', b.payDetails2, '') +
      f('prefix', 'Invoice number starts with', b.invPrefix != null ? b.invPrefix : 'INV-') +
      f('next', 'Next invoice number', b.nextInv || 1001, '', 'number') +
      f('terms', 'Payment due after (days)', b.payTerms != null ? b.payTerms : 14, '', 'number') +
      '</div><div class="mkact"><button type="button" class="btn" data-ivsave="1">Save invoice details</button><button type="button" class="btn ghost" data-ivclose="1">Cancel</button></div><p id="ivMsg" class="muted" style="min-height:18px"></p>',
    true
  );
}
window.CD_openInv = openInv;
function ivSummary() {
  var n = payAccs().length;
  return (
    n +
    ' bank account' +
    (n === 1 ? '' : 's') +
    ' saved, next invoice number ' +
    esc((BIZ.invPrefix != null ? BIZ.invPrefix : 'INV-') + (BIZ.nextInv || 1001)) +
    '.'
  );
}
window.CD_invSummary = ivSummary;
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('[data-ivclose]')) return closeOv('ivOv');
  if (!t.closest('[data-ivsave]')) return;
  var g = function (k) {
      var x = $('#iv-' + k);
      return x ? x.value.trim() : '';
    },
    n = function (k, d) {
      var v = parseFloat(g(k));
      return isNaN(v) ? d : v;
    };
  if (!g('pay') && g('pay2')) {
    $('#ivMsg').textContent = 'Put your main account in Account 1. Account 2 is the spare.';
    return;
  }
  var d = Object.assign({}, BIZ, {
    payLabel: g('label'),
    payDetails: g('pay'),
    payLabel2: g('label2'),
    payDetails2: g('pay2'),
    invPrefix: g('prefix'),
    nextInv: Math.max(1, Math.round(n('next', 1001))),
    payTerms: Math.max(0, Math.round(n('terms', 14))),
    savedAt: Date.now()
  });
  BIZ = d;
  write('set-biz', function () {
    return setCol.doc('business').set(d);
  });
  closeOv('ivOv');
  toast('Invoice details saved');
  if ($('#dcOv')) dcRender();
  if (view === 'invoices') render();
});
function bizSave() {
  if (BIZ.savedAt && window.CD_reGate && !window.CD_reGate('biz')) return;
  var g = function (k) {
      var e = $('#bz-' + k);
      return e ? e.value.trim() : '';
    },
    n = function (k, d) {
      var v = parseFloat(g(k));
      return isNaN(v) ? d : v;
    };
  var d = Object.assign({}, BIZ, {
    name: g('name'),
    owner: g('owner'),
    address: g('address'),
    phone: g('phone'),
    email: g('email'),
    web: g('web'),
    reg: g('reg'),
    companyNo: g('companyNo'),
    regOffice: g('regOffice'),
    vatReg: g('vatReg'),
    vatNo: g('vatNo'),
    vatRate: n('vatRate', 20),
    payDetails: g('payDetails'),
    payTerms: Math.max(0, Math.round(n('payTerms', 14))),
    quoteValid: Math.max(0, Math.round(n('quoteValid', 30))),
    invPrefix: g('invPrefix'),
    nextInv: Math.max(1, Math.round(n('nextInv', 1001))),
    quotePrefix: g('quotePrefix'),
    nextQuote: Math.max(1, Math.round(n('nextQuote', 1001))),
    terms: g('terms'),
    savedAt: Date.now()
  });
  if (bizDraftLogo === 'del') {
    delete d.logo;
    delete d.logoW;
    delete d.logoH;
  } else if (bizDraftLogo) {
    d.logo = bizDraftLogo.src;
    d.logoW = bizDraftLogo.w;
    d.logoH = bizDraftLogo.h;
  }
  if (d.vatReg === 'yes' && !d.vatNo) {
    var m = $('#bzMsg');
    if (m) m.textContent = 'Add your VAT number, or set VAT registered to No.';
    return;
  }
  BIZ = d;
  write('set-biz', function () {
    return setCol.doc('business').set(d);
  });
  closeOv('bzOv');
  toast('Business details saved');
  if ($('#dcOv')) dcRender();
  if (view === 'invoices') render();
}
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t || t.id !== 'bzLogo' || !t.files || !t.files[0]) return;
  logoLoad(t.files[0], function (r) {
    if (!r) {
      toast('That file could not be read as a picture');
      return;
    }
    bizDraftLogo = r;
    var b = $('#bzLogoBox');
    if (b) b.innerHTML = '<img src="' + r.src + '" alt="Your logo">';
  });
});

/* --- tiny PDF writer: A4, Helvetica, JPEG logo --- */
var mCtx = null;
function tw(s, size, bold) {
  if (!mCtx) mCtx = document.createElement('canvas').getContext('2d');
  mCtx.font = (bold ? 'bold ' : '') + '100px Helvetica, Arial, "Liberation Sans", sans-serif';
  return (mCtx.measureText(String(s)).width / 100) * size;
}
function pStr(s) {
  var o = '';
  s = String(s == null ? '' : s);
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i),
      t;
    if (c === 0x2013 || c === 0x2014) t = '-';
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
function wrapT(s, max, size, bold) {
  var out = [];
  String(s == null ? '' : s)
    .split('\n')
    .forEach(function (par) {
      var words = par.split(/\s+/),
        line = '';
      if (!par.trim()) {
        out.push('');
        return;
      }
      words.forEach(function (w) {
        if (!w) return;
        var t = line ? line + ' ' + w : w;
        if (tw(t, size, bold) <= max || !line) line = t;
        else {
          out.push(line);
          line = w;
        }
        while (tw(line, size, bold) > max && line.length > 1) {
          var k = line.length;
          while (k > 1 && tw(line.slice(0, k), size, bold) > max) k--;
          out.push(line.slice(0, k));
          line = line.slice(k);
        }
      });
      if (line) out.push(line);
    });
  return out;
}
function Pdf() {
  this.pages = [];
  this.img = null;
  this.page();
}
Pdf.prototype.page = function () {
  this.c = [];
  this.pages.push(this.c);
  this.y = 40;
};
Pdf.prototype.col = function (rgb) {
  return (rgb || [0.06, 0.11, 0.15])
    .map(function (v) {
      return v.toFixed(3);
    })
    .join(' ');
};
Pdf.prototype.t = function (x, top, s, size, bold, align, rgb) {
  size = size || 10;
  var w = tw(s, size, bold),
    xx = align === 'r' ? x - w : align === 'c' ? x - w / 2 : x;
  this.c.push(
    'BT /' +
      (bold ? 'F2' : 'F1') +
      ' ' +
      size +
      ' Tf ' +
      this.col(rgb) +
      ' rg 1 0 0 1 ' +
      xx.toFixed(2) +
      ' ' +
      (842 - top - size * 0.8).toFixed(2) +
      ' Tm (' +
      pStr(s) +
      ') Tj ET'
  );
};
Pdf.prototype.rect = function (x, top, w, h, rgb) {
  this.c.push(
    this.col(rgb) + ' rg ' + x + ' ' + (842 - top - h).toFixed(2) + ' ' + w + ' ' + h.toFixed(2) + ' re f'
  );
};
Pdf.prototype.line = function (x1, top, x2, rgb, lw) {
  this.c.push(
    this.col(rgb || [0.8, 0.83, 0.85]) +
      ' RG ' +
      (lw || 0.6) +
      ' w ' +
      x1 +
      ' ' +
      (842 - top).toFixed(2) +
      ' m ' +
      x2 +
      ' ' +
      (842 - top).toFixed(2) +
      ' l S'
  );
};
Pdf.prototype.image = function (src, iw, ih, x, top, w, h) {
  this.img = { bin: atob(src.split(',')[1]), w: iw, h: ih };
  this.c.push(
    'q ' +
      w.toFixed(2) +
      ' 0 0 ' +
      h.toFixed(2) +
      ' ' +
      x +
      ' ' +
      (842 - top - h).toFixed(2) +
      ' cm /Im1 Do Q'
  );
};
Pdf.prototype.need = function (h, foot) {
  if (this.y + h > 842 - 50) {
    this.page();
    if (foot) foot(this);
  }
};
Pdf.prototype.bytes = function (footer) {
  var objs = [],
    add = function (s) {
      objs.push(s);
      return objs.length;
    };
  var n = this.pages.length;
  this.pages.forEach(function (c, i) {
    if (footer) {
      wrapT(footer, 430, 7.5)
        .slice(0, 2)
        .forEach(function (fl, k, arr) {
          c.push(
            'BT /F1 7.5 Tf 0.4 0.45 0.5 rg 1 0 0 1 40 ' +
              (24 + (arr.length - 1 - k) * 9) +
              ' Tm (' +
              pStr(fl) +
              ') Tj ET'
          );
        });
      var pg = 'Page ' + (i + 1) + ' of ' + n;
      c.push(
        'BT /F1 7.5 Tf 0.4 0.45 0.5 rg 1 0 0 1 ' +
          (555 - tw(pg, 7.5)).toFixed(2) +
          ' 24 Tm (' +
          pStr(pg) +
          ') Tj ET'
      );
    }
  });
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('PAGES');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  var imgRef = '';
  if (this.img) {
    var io = add(
      '<< /Type /XObject /Subtype /Image /Width ' +
        this.img.w +
        ' /Height ' +
        this.img.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        this.img.bin.length +
        ' >>\nstream\n' +
        this.img.bin +
        '\nendstream'
    );
    imgRef = ' /XObject << /Im1 ' + io + ' 0 R >>';
  }
  var kids = [];
  this.pages.forEach(function (c) {
    var body = c.join('\n');
    var cs = add('<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream');
    kids.push(
      add(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' +
          imgRef +
          ' >> /Contents ' +
          cs +
          ' 0 R >>'
      )
    );
  });
  objs[1] =
    '<< /Type /Pages /Kids [' +
    kids
      .map(function (k) {
        return k + ' 0 R';
      })
      .join(' ') +
    '] /Count ' +
    kids.length +
    ' >>';
  var out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n',
    offs = [];
  objs.forEach(function (o, i) {
    offs.push(out.length);
    out += i + 1 + ' 0 obj\n' + o + '\nendobj\n';
  });
  var xr = out.length;
  out +=
    'xref\n0 ' +
    (objs.length + 1) +
    '\n0000000000 65535 f \n' +
    offs
      .map(function (o) {
        return ('000000000' + o).slice(-10) + ' 00000 n \n';
      })
      .join('') +
    'trailer\n<< /Size ' +
    (objs.length + 1) +
    ' /Root 1 0 R >>\nstartxref\n' +
    xr +
    '\n%%EOF';
  var u = new Uint8Array(out.length);
  for (var i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255;
  return u;
};
function fileOut(bytes, name, how) {
  var blob = new Blob([bytes], { type: 'application/pdf' });
  if (how === 'share') {
    try {
      var f = new File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: name }).catch(function () {});
        return;
      }
    } catch (e) {}
    toast('Sharing files is not available on this device. Use Download PDF.');
    return;
  }
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
  toast('PDF saved as ' + name + '. (In the Claude demo, downloads are blocked. Use Preview.)');
}
function printHtml(html) {
  var p = $('#printArea');
  if (!p) {
    p = document.createElement('div');
    p.id = 'printArea';
    document.body.appendChild(p);
  }
  p.innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(function () {
    try {
      window.print();
    } catch (e) {}
    setTimeout(function () {
      document.body.classList.remove('printing');
    }, 500);
  }, 50);
}
function bizLines() {
  return [BIZ.address]
    .concat([
      BIZ.phone ? 'Phone: ' + BIZ.phone : '',
      BIZ.email,
      BIZ.web,
      BIZ.reg,
      vatOn() && BIZ.vatNo ? 'VAT number: ' + BIZ.vatNo : '',
      BIZ.companyNo ? 'Company number: ' + BIZ.companyNo : ''
    ])
    .filter(Boolean)
    .join('\n');
}
function bizFooter() {
  return [
    bizName(),
    BIZ.companyNo ? 'Registered in England and Wales, company number ' + BIZ.companyNo : '',
    BIZ.companyNo && (BIZ.regOffice || BIZ.address)
      ? 'Registered office: ' + String(BIZ.regOffice || BIZ.address).replace(/\s*\n\s*/g, ', ')
      : ''
  ]
    .filter(Boolean)
    .join(' · ');
}

/* --- quotes and invoices --- */
var dcCase = null,
  dcDoc = null;
function docsOf(c) {
  return (c && c.docs) || [];
}
function dcTotals(d) {
  var sub = 0,
    vat = 0;
  (d.lines || []).forEach(function (l) {
    var a = r2((+l.q || 0) * (+l.p || 0));
    sub += a;
    if (vatOn()) vat += (a * (+l.v || 0)) / 100;
  });
  sub = r2(sub);
  vat = r2(vat);
  return { sub: sub, vat: vat, total: r2(sub + vat) };
}
function dcOver(d) {
  return d.kind === 'invoice' && d.status !== 'paid' && d.status !== 'cancelled' && d.due && diff(d.due) < 0;
}
var DC_ST = {
  quote: [
    ['draft', 'Draft'],
    ['sent', 'Sent'],
    ['accepted', 'Accepted'],
    ['declined', 'Declined']
  ],
  invoice: [
    ['draft', 'Draft'],
    ['sent', 'Sent'],
    ['paid', 'Paid'],
    ['cancelled', 'Cancelled']
  ]
};
function dcStLabel(d) {
  var o = (DC_ST[d.kind] || []).filter(function (x) {
    return x[0] === d.status;
  })[0];
  return dcOver(d) ? 'Overdue' : o ? o[1] : 'Draft';
}
function dcChip(d) {
  var s = dcOver(d)
    ? 'bad'
    : d.status === 'paid' || d.status === 'accepted'
      ? 'ok'
      : d.status === 'sent'
        ? 'warn'
        : '';
  return '<span class="chip ' + s + '">' + dcStLabel(d) + '</span>';
}
function dcNewNumber(kind) {
  return kind === 'quote'
    ? (BIZ.quotePrefix != null ? BIZ.quotePrefix : 'Q-') + (BIZ.nextQuote || 1001)
    : (BIZ.invPrefix != null ? BIZ.invPrefix : 'INV-') + (BIZ.nextInv || 1001);
}
function docsFs(c) {
  var ds = docsOf(c)
    .slice()
    .sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  return (
    '<fieldset style="margin-top:14px"><legend>Quotes and invoices (' +
    ds.length +
    ')</legend><div class="add" style="margin:0 0 8px"><button type="button" class="btn ghost sm" data-dcnew="quote">New quote</button><button type="button" class="btn ghost sm" data-dcnew="invoice">New invoice</button>' +
    (bizName()
      ? ''
      : '<button type="button" class="btn ghost sm" data-bizopen="1">Add your business details and logo first</button>') +
    '</div>' +
    (ds.length
      ? ds
          .map(function (d) {
            var t = dcTotals(d);
            return (
              '<button type="button" class="clrec" data-dcopen="' +
              esc(c.id) +
              '|' +
              esc(d.id) +
              '"><b>' +
              (d.kind === 'quote' ? 'Quote' : 'Invoice') +
              ' ' +
              esc(d.number || '') +
              '</b> ' +
              dcChip(d) +
              '<span class="muted"> · ' +
              fd(d.date) +
              '</span><span class="num" style="margin-left:auto">' +
              gbp(t.total) +
              '</span></button>'
            );
          })
          .join('')
      : '<span class="muted">None yet.</span>') +
    '</fieldset>'
  );
}
function dcOpen(caseId, docId, kind, from) {
  var c = cases.filter(function (x) {
    return x.id === caseId;
  })[0];
  if (!c) return;
  dcCase = caseId;
  var d = docId
    ? docsOf(c).filter(function (x) {
        return x.id === docId;
      })[0]
    : null;
  if (d) dcDoc = JSON.parse(JSON.stringify(d));
  else {
    var ap = (c.applicants || []).filter(function (a) {
        return a.name;
      }),
      addr = (ap[0] && ap[0].address) || '',
      job = fv(c, T.addr) || '',
      today = iso(TODAY);
    dcDoc = {
      id: 'd' + uid(),
      kind: kind,
      number: dcNewNumber(kind),
      date: today,
      due:
        kind === 'quote'
          ? addDays(today, BIZ.quoteValid != null ? BIZ.quoteValid : 30)
          : addDays(today, BIZ.payTerms != null ? BIZ.payTerms : 14),
      status: 'draft',
      toName: T.tenancyMode
        ? tnCurrent(c).map(tnNames).filter(Boolean).join(' & ')
        : pnames(c) === 'Unnamed client'
          ? ''
          : pnames(c),
      toAddr: T.tenancyMode ? paddr(c) : addr,
      job: job && job !== addr && T.byKey[T.addr] && T.byKey[T.addr].t === 'text' ? job : '',
      lines: [{ d: c.type || '', q: 1, p: '', v: vatOn() ? (BIZ.vatRate != null ? BIZ.vatRate : 20) : 0 }],
      notes: '',
      isNew: true
    };
    if (from) {
      dcDoc.lines = JSON.parse(JSON.stringify(from.lines || []));
      dcDoc.fromQuote = from.number;
      dcDoc.notes = from.notes || '';
      dcDoc.toName = from.toName;
      dcDoc.toAddr = from.toAddr;
      dcDoc.job = from.job;
    }
    /* two bank accounts saved: ask which one this invoice should show */
    if (kind === 'invoice' && payAccs().length > 1) {
      var accs = payAccs();
      docAsk(
        'Which bank account for this invoice?',
        'You have two accounts saved. Choose the one this invoice should show. You can change it later on the invoice.',
        accs
          .map(function (x, i) {
            return {
              pri: i === 0,
              label:
                '<b>' +
                esc(x.label) +
                '</b><br><span style="font-size:12.5px;opacity:.8">' +
                esc(String(x.text).split('\n')[0]) +
                '</span>',
              go: function () {
                dcDoc.payAcc = x.n;
                dcRender();
              }
            };
          })
          .concat([{ label: 'Cancel', go: null }])
      );
      return;
    }
  }
  dcRender();
}
function dcLineRow(l, i) {
  return (
    '<tr data-dcl="' +
    i +
    '"><td><textarea data-dlf="d" rows="1" placeholder="Description of work or item">' +
    esc(l.d || '') +
    '</textarea></td><td><input data-dlf="q" type="number" step="any" value="' +
    esc(l.q) +
    '"></td><td><input data-dlf="p" type="number" step="any" placeholder="0.00" value="' +
    esc(l.p) +
    '"></td>' +
    (vatOn()
      ? '<td><select data-dlf="v">' +
        [20, 5, 0]
          .map(function (v) {
            return '<option value="' + v + '"' + (+l.v === v ? ' selected' : '') + '>' + v + '%</option>';
          })
          .join('') +
        '</select></td>'
      : '') +
    '<td class="num" data-dla="' +
    i +
    '">' +
    gbp((+l.q || 0) * (+l.p || 0)) +
    '</td><td><button type="button" class="x" data-dldel="' +
    i +
    '" aria-label="Remove line">×</button></td></tr>'
  );
}
function dcRender() {
  var d = dcDoc,
    isQ = d.kind === 'quote',
    st = DC_ST[d.kind];
  overlay(
    'dcOv',
    '<div class="dhd"><h2>' +
      (isQ ? 'Quote' : 'Invoice') +
      ' ' +
      esc(d.number) +
      (d.isNew ? ' (new)' : '') +
      '</h2><button type="button" class="btn ghost" data-dcclose="1">Close</button></div>' +
      (bizName()
        ? ''
        : '<p class="dnote">Your business name, address and logo are not set up yet. <button type="button" class="lnk" data-bizopen="1"><b>Add business details</b></button></p>') +
      '<div class="dcgrid"><div class="dcform"><div class="grid">' +
      '<label class="f">' +
      (isQ ? 'Quote' : 'Invoice') +
      ' number<input id="dc-number" value="' +
      esc(d.number) +
      '"></label><label class="f">Status<select id="dc-status">' +
      st
        .map(function (o) {
          return (
            '<option value="' + o[0] + '"' + (d.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<label class="f">Date<input id="dc-date" type="date" value="' +
      esc(d.date) +
      '"></label><label class="f">' +
      (isQ ? 'Valid until' : 'Payment due') +
      '<input id="dc-due" type="date" value="' +
      esc(d.due) +
      '"></label>' +
      (!isQ
        ? '<label class="f">Paid on<input id="dc-paid" type="date" value="' +
          esc(d.paidDate || '') +
          '"></label>'
        : '') +
      (!isQ && payAccs().length > 1
        ? '<label class="f">Pay into<select id="dc-payAcc">' +
          payAccs()
            .map(function (x) {
              return (
                '<option value="' +
                x.n +
                '"' +
                (+d.payAcc === x.n || (!d.payAcc && x.n === 1) ? ' selected' : '') +
                '>' +
                esc(x.label) +
                '</option>'
              );
            })
            .join('') +
          '</select></label>'
        : '') +
      '<label class="f wide">' +
      (isQ ? 'Quote for' : 'Bill to') +
      '<input id="dc-toName" value="' +
      esc(d.toName || '') +
      '"></label><label class="f wide">Their address<textarea id="dc-toAddr" rows="2">' +
      esc(d.toAddr || '') +
      '</textarea></label>' +
      '<label class="f wide">Job or property address (if different)<input id="dc-job" value="' +
      esc(d.job || '') +
      '"></label></div>' +
      '<table class="dclines"><thead><tr><th>Description</th><th>Qty</th><th>Price (£)</th>' +
      (vatOn() ? '<th>VAT</th>' : '') +
      '<th>Amount</th><th></th></tr></thead><tbody id="dcLines">' +
      (d.lines || []).map(dcLineRow).join('') +
      '</tbody></table>' +
      '<button type="button" class="btn ghost sm" data-dladd="1">Add line</button><div id="dcTot" class="dctot"></div>' +
      '<label class="f">Notes for this ' +
      (isQ ? 'quote' : 'invoice') +
      '<textarea id="dc-notes" rows="3" placeholder="' +
      (isQ ? 'What is included, what is not, start dates' : 'Anything the customer should know') +
      '">' +
      esc(d.notes || '') +
      '</textarea></label>' +
      (vatOn()
        ? ''
        : '<p class="muted" style="font-size:12px">Not VAT registered, so no VAT is shown. Change this in Business details.</p>') +
      '</div><div class="dcprev"><div class="muted" style="font-size:12px;margin-bottom:6px">Preview</div><div id="dcPrev"></div></div></div>' +
      '<div class="mkact dcact"><button type="button" class="btn" data-dcsave="1">Save</button><button type="button" class="btn ghost" data-dcpdf="dl">Download PDF</button><button type="button" class="btn ghost" data-dcpdf="share">Share</button><button type="button" class="btn ghost" data-dcprint="1">Print</button><button type="button" class="btn" data-dcsend="1">Send by WhatsApp or email</button>' +
      (isQ && !d.isNew
        ? '<button type="button" class="btn ghost" data-dcconv="1">Turn into invoice</button>'
        : '') +
      (!d.isNew
        ? '<button type="button" class="btn danger" data-dcdel="1" style="margin-left:auto">Delete</button>'
        : '') +
      '</div>',
    true
  );
  dcPreview();
}
function dcRead() {
  var d = dcDoc,
    g = function (k) {
      var e = $('#dc-' + k);
      return e ? e.value : null;
    };
  if (!$('#dcOv')) return d;
  ['number', 'status', 'date', 'due', 'toName', 'toAddr', 'job', 'notes'].forEach(function (k) {
    var v = g(k);
    if (v != null) d[k] = k === 'notes' || k === 'toAddr' ? v : v.trim();
  });
  var pv = g('paid');
  if (pv != null) d.paidDate = pv;
  var pa = g('payAcc');
  if (pa != null) d.payAcc = +pa;
  d.lines = [];
  document.querySelectorAll('#dcLines tr').forEach(function (tr) {
    var l = {};
    tr.querySelectorAll('[data-dlf]').forEach(function (i) {
      var k = i.getAttribute('data-dlf');
      l[k] = k === 'd' ? i.value : i.value === '' ? '' : +i.value;
    });
    if (l.v == null) l.v = 0;
    d.lines.push(l);
  });
  return d;
}
function dcHtml(d) {
  var isQ = d.kind === 'quote',
    t = dcTotals(d),
    v = vatOn();
  return (
    '<div class="dpage"><div class="dtop"><div>' +
    (okLogo(BIZ.logo) ? '<img class="dlogo" src="' + BIZ.logo + '" alt="">' : '') +
    '</div><div class="dtitle"><div class="dbig">' +
    (isQ ? 'QUOTE' : v ? 'VAT INVOICE' : 'INVOICE') +
    '</div><table class="dmeta"><tr><td>Number</td><td>' +
    esc(d.number) +
    '</td></tr><tr><td>Date</td><td>' +
    fd(d.date) +
    '</td></tr><tr><td>' +
    (isQ ? 'Valid until' : 'Payment due') +
    '</td><td>' +
    fd(d.due) +
    '</td></tr>' +
    (d.fromQuote ? '<tr><td>Quote</td><td>' + esc(d.fromQuote) + '</td></tr>' : '') +
    '</table>' +
    (d.status === 'paid'
      ? '<div class="dpaid">PAID' + (d.paidDate ? ' ' + fd(d.paidDate) : '') + '</div>'
      : '') +
    '</div></div>' +
    '<div class="dparties"><div><div class="dlab">From</div><b>' +
    esc(bizName() || 'Your business name') +
    '</b><br>' +
    nl2br(bizLines()) +
    '</div><div><div class="dlab">' +
    (isQ ? 'Quote for' : 'Bill to') +
    '</div><b>' +
    esc(d.toName || '') +
    '</b><br>' +
    nl2br(d.toAddr || '') +
    (d.job
      ? '<div style="margin-top:6px"><span class="dlab">' +
        (T.id === 'landlord' ? 'Property' : 'Job address') +
        '</span><br>' +
        esc(d.job) +
        '</div>'
      : '') +
    '</div></div>' +
    '<table class="dtab"><thead><tr><th>Description</th><th>Qty</th><th>Price</th>' +
    (v ? '<th>VAT</th>' : '') +
    '<th>Amount</th></tr></thead><tbody>' +
    (d.lines || [])
      .filter(function (l) {
        return l.d || l.p;
      })
      .map(function (l) {
        return (
          '<tr><td>' +
          nl2br(l.d || '') +
          '</td><td>' +
          esc(l.q) +
          '</td><td>' +
          gbp(l.p) +
          '</td>' +
          (v ? '<td>' + (+l.v || 0) + '%</td>' : '') +
          '<td>' +
          gbp((+l.q || 0) * (+l.p || 0)) +
          '</td></tr>'
        );
      })
      .join('') +
    '</tbody></table>' +
    '<table class="dsum">' +
    (v
      ? '<tr><td>Subtotal</td><td>' +
        gbp(t.sub) +
        '</td></tr><tr><td>VAT</td><td>' +
        gbp(t.vat) +
        '</td></tr>'
      : '') +
    '<tr class="dgt"><td>Total</td><td>' +
    gbp(t.total) +
    '</td></tr></table>' +
    (d.notes ? '<div class="dsec"><div class="dlab">Notes</div>' + nl2br(d.notes) + '</div>' : '') +
    (isQ
      ? '<div class="dsec">This quote is valid until ' + fd(d.due) + '.</div>'
      : payFor(d) && d.status !== 'paid'
        ? '<div class="dsec"><div class="dlab">How to pay</div>' +
          nl2br(payFor(d)) +
          '<br>Please use reference <b>' +
          esc(d.number) +
          '</b>.</div>'
        : '') +
    (BIZ.terms ? '<div class="dsec muted">' + nl2br(BIZ.terms) + '</div>' : '') +
    '<div class="dfoot">' +
    esc(bizFooter()) +
    '</div></div>'
  );
}
function dcPreview() {
  var d = dcRead(),
    t = dcTotals(d),
    v = vatOn(),
    b = $('#dcTot');
  if (b)
    b.innerHTML =
      (v ? '<div>Subtotal <b>' + gbp(t.sub) + '</b></div><div>VAT <b>' + gbp(t.vat) + '</b></div>' : '') +
      '<div class="big">Total <b>' +
      gbp(t.total) +
      '</b></div>';
  (d.lines || []).forEach(function (l, i) {
    var a = document.querySelector('[data-dla="' + i + '"]');
    if (a) a.textContent = gbp((+l.q || 0) * (+l.p || 0));
  });
  var p = $('#dcPrev');
  if (p) p.innerHTML = dcHtml(d);
}
function dcPdf(d) {
  var P = new Pdf(),
    isQ = d.kind === 'quote',
    t = dcTotals(d),
    v = vatOn(),
    G = [0.35, 0.41, 0.47],
    A = [0.18, 0.29, 0.25];
  var lh = 0;
  if (okLogo(BIZ.logo) && BIZ.logoW) {
    var s = Math.min(170 / BIZ.logoW, 70 / BIZ.logoH);
    P.image(BIZ.logo, BIZ.logoW, BIZ.logoH, 40, 40, BIZ.logoW * s, BIZ.logoH * s);
    lh = BIZ.logoH * s;
  }
  P.t(555, 40, isQ ? 'QUOTE' : v ? 'VAT INVOICE' : 'INVOICE', 22, true, 'r', A);
  var my = 72;
  [
    ['Number', d.number],
    ['Date', fd(d.date)],
    [isQ ? 'Valid until' : 'Payment due', fd(d.due)]
  ]
    .concat(d.fromQuote ? [['Quote', d.fromQuote]] : [])
    .forEach(function (r) {
      P.t(470, my, r[0], 9, false, 'r', G);
      P.t(555, my, r[1], 9, true, 'r');
      my += 13;
    });
  if (d.status === 'paid') {
    P.t(555, my + 4, 'PAID' + (d.paidDate ? ' ' + fd(d.paidDate) : ''), 12, true, 'r', [0.1, 0.5, 0.25]);
    my += 18;
  }
  var top = Math.max(40 + lh, my) + 18,
    ly = top,
    ry = top;
  P.t(40, ly, 'FROM', 7.5, true, 'l', G);
  ly += 11;
  P.t(40, ly, bizName() || 'Your business name', 11, true);
  ly += 15;
  wrapT(bizLines(), 250, 9).forEach(function (l) {
    P.t(40, ly, l, 9);
    ly += 12;
  });
  P.t(320, ry, isQ ? 'QUOTE FOR' : 'BILL TO', 7.5, true, 'l', G);
  ry += 11;
  wrapT(d.toName || '', 235, 11, true).forEach(function (l) {
    P.t(320, ry, l, 11, true);
    ry += 14;
  });
  ry += 1;
  wrapT(d.toAddr || '', 235, 9).forEach(function (l) {
    P.t(320, ry, l, 9);
    ry += 12;
  });
  if (d.job) {
    ry += 4;
    P.t(320, ry, T.id === 'landlord' ? 'PROPERTY' : 'JOB ADDRESS', 7.5, true, 'l', G);
    ry += 11;
    wrapT(d.job, 235, 9).forEach(function (l) {
      P.t(320, ry, l, 9);
      ry += 12;
    });
  }
  P.y = Math.max(ly, ry) + 16;
  var cQ = v ? 360 : 400,
    cP = v ? 430 : 475,
    cV = 485,
    dw = (v ? 300 : 340) - 48;
  var head = function (p) {
    p.rect(40, p.y, 515, 18, [0.93, 0.95, 0.94]);
    p.t(46, p.y + 5, 'Description', 8.5, true);
    p.t(cQ, p.y + 5, 'Qty', 8.5, true, 'r');
    p.t(cP, p.y + 5, 'Price', 8.5, true, 'r');
    if (v) p.t(cV, p.y + 5, 'VAT', 8.5, true, 'r');
    p.t(549, p.y + 5, 'Amount', 8.5, true, 'r');
    p.y += 22;
  };
  head(P);
  (d.lines || [])
    .filter(function (l) {
      return l.d || l.p;
    })
    .forEach(function (l) {
      var ls = wrapT(l.d || '', dw, 9.5),
        h = ls.length * 12 + 6;
      P.need(h, head);
      ls.forEach(function (x, i) {
        P.t(46, P.y + i * 12, x, 9.5);
      });
      P.t(cQ, P.y, String(l.q), 9.5, false, 'r');
      P.t(cP, P.y, gbp(l.p), 9.5, false, 'r');
      if (v) P.t(cV, P.y, (+l.v || 0) + '%', 9.5, false, 'r');
      P.t(549, P.y, gbp((+l.q || 0) * (+l.p || 0)), 9.5, false, 'r');
      P.y += h;
      P.line(40, P.y - 3, 555);
    });
  P.need(70);
  P.y += 6;
  if (v) {
    P.t(470, P.y, 'Subtotal', 9.5, false, 'r', G);
    P.t(549, P.y, gbp(t.sub), 9.5, false, 'r');
    P.y += 14;
    P.t(470, P.y, 'VAT', 9.5, false, 'r', G);
    P.t(549, P.y, gbp(t.vat), 9.5, false, 'r');
    P.y += 16;
  }
  P.rect(360, P.y - 4, 195, 22, [0.93, 0.95, 0.94]);
  P.t(470, P.y + 2, 'Total', 11, true, 'r');
  P.t(549, P.y + 2, gbp(t.total), 11, true, 'r');
  P.y += 34;
  var sec = function (title, text) {
    if (!text) return;
    var ls = wrapT(text, 515, 9.5);
    P.need(14 + ls.length * 12);
    if (title) {
      P.t(40, P.y, title.toUpperCase(), 7.5, true, 'l', G);
      P.y += 11;
    }
    ls.forEach(function (x) {
      P.need(12);
      P.t(40, P.y, x, 9.5);
      P.y += 12;
    });
    P.y += 8;
  };
  sec('Notes', d.notes);
  if (isQ) sec('', 'This quote is valid until ' + fd(d.due) + '.');
  else if (payFor(d) && d.status !== 'paid')
    sec('How to pay', payFor(d) + '\nPlease use reference ' + d.number + '.');
  sec('', BIZ.terms);
  return P.bytes(bizFooter());
}
function dcSave(quiet) {
  var d = dcRead(),
    c = cases.filter(function (x) {
      return x.id === dcCase;
    })[0];
  if (!c) return null;
  if (
    !(d.lines || []).some(function (l) {
      return l.d || l.p;
    })
  ) {
    toast('Add at least one line');
    return null;
  }
  var isNew = !!d.isNew;
  delete d.isNew;
  d.updatedAt = Date.now();
  if (isNew) d.createdAt = d.updatedAt;
  if (d.kind === 'invoice' && d.status === 'paid' && !d.paidDate) d.paidDate = iso(TODAY);
  var t = dcTotals(d);
  d.total = t.total;
  var list = docsOf(c)
      .filter(function (x) {
        return x.id !== d.id;
      })
      .concat([d]),
    o = { docs: list };
  if (d.kind === 'invoice' && T.byKey.invoiceNo) {
    var inv = list
      .filter(function (x) {
        return x.kind === 'invoice' && x.status !== 'cancelled';
      })
      .sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0);
      })[0];
    if (inv && inv.id === d.id) {
      o.invoiceNo = d.number;
      o.invoiceAmount = t.total;
      o.invoiceDate = d.date;
      if (T.byKey.payDue) o.payDue = d.due;
      if (T.byKey.paidDate) o.paidDate = d.status === 'paid' ? d.paidDate || iso(TODAY) : '';
      o.docSync = d.id;
    }
  }
  if (d.kind === 'quote' && T.byKey.quote && d.status !== 'declined') o.quote = t.total;
  patch(c.id, o);
  if (openId === c.id && $('#caseForm')) {
    Object.keys(o).forEach(function (k) {
      var e = $('#f-' + k);
      if (e) {
        e.value = o[k];
        if (e.hasAttribute('data-from')) e.setAttribute('data-auto', '0');
      }
    });
    lastAuto = JSON.stringify(collectForm());
    updStrip();
  }
  if (isNew) {
    var nb = Object.assign({}, BIZ);
    if (d.kind === 'quote' && d.number === dcNewNumber('quote')) nb.nextQuote = (BIZ.nextQuote || 1001) + 1;
    if (d.kind === 'invoice' && d.number === dcNewNumber('invoice')) nb.nextInv = (BIZ.nextInv || 1001) + 1;
    if (nb.nextQuote !== BIZ.nextQuote || nb.nextInv !== BIZ.nextInv) {
      BIZ = nb;
      write('set-biz', function () {
        return setCol.doc('business').set(nb);
      });
    }
  }
  dcDoc = JSON.parse(JSON.stringify(d));
  if (!quiet) {
    toast((d.kind === 'quote' ? 'Quote ' : 'Invoice ') + d.number + ' saved');
    dcRender();
  }
  setTimeout(function () {
    if (openId) renderLive();
    if (view === 'invoices') render();
  }, 60);
  return d;
}
function docReminders(c) {
  var out = [];
  docsOf(c).forEach(function (d) {
    if (
      d.kind !== 'invoice' ||
      d.status === 'paid' ||
      d.status === 'cancelled' ||
      !d.due ||
      d.status === 'draft'
    )
      return;
    if (T.byKey.payDue && c.docSync === d.id) return;
    var k = 'doc:' + d.id;
    if (c.remDone && c.remDone[k] === d.due) return;
    out.push({
      date: d.due,
      label: 'Invoice ' + d.number + ' payment due (' + gbp(d.total || dcTotals(d).total) + ')',
      key: k,
      sec: false
    });
  });
  return out;
}
/* list page */
var ivFilter = 'all';
function invoicesHTML() {
  var all = [];
  cases.forEach(function (c) {
    docsOf(c).forEach(function (d) {
      all.push({ c: c, d: d });
    });
  });
  var unpaid = all.filter(function (x) {
      return (
        x.d.kind === 'invoice' &&
        x.d.status !== 'paid' &&
        x.d.status !== 'cancelled' &&
        x.d.status !== 'draft'
      );
    }),
    over = unpaid.filter(function (x) {
      return dcOver(x.d);
    }),
    sum = function (l) {
      return l.reduce(function (a, x) {
        return a + (x.d.total || dcTotals(x.d).total);
      }, 0);
    };
  var paidY = all.filter(function (x) {
    return (
      x.d.kind === 'invoice' &&
      x.d.status === 'paid' &&
      (x.d.paidDate || '').slice(0, 4) === String(TODAY.getFullYear())
    );
  });
  var f = {
    all: function () {
      return true;
    },
    quotes: function (x) {
      return x.d.kind === 'quote';
    },
    open: function (x) {
      return x.d.kind === 'quote' && (x.d.status === 'sent' || x.d.status === 'draft');
    },
    unpaid: function (x) {
      return unpaid.indexOf(x) > -1;
    },
    over: function (x) {
      return dcOver(x.d);
    },
    paid: function (x) {
      return x.d.status === 'paid';
    },
    draft: function (x) {
      return x.d.status === 'draft';
    }
  };
  var l = all.filter(f[ivFilter] || f.all).sort(function (a, b) {
    return a.d.date < b.d.date ? 1 : a.d.date > b.d.date ? -1 : (b.d.createdAt || 0) - (a.d.createdAt || 0);
  });
  var chips = [
    ['all', 'All'],
    ['quotes', 'Quotes'],
    ['open', 'Open quotes'],
    ['unpaid', 'Unpaid invoices'],
    ['over', 'Overdue'],
    ['paid', 'Paid'],
    ['draft', 'Drafts']
  ];
  return (
    '<div class="pagehead"><h1>Quotes &amp; invoices</h1><button type="button" class="btn ghost" data-bizopen="1">Business details and logo</button></div>' +
    '<div class="stats" style="margin:6px 0 12px"><div class="stat"><b>' +
    gbp(sum(unpaid)) +
    '</b><span>Unpaid (' +
    unpaid.length +
    ')</span></div><div class="stat"><b style="color:var(--bad,#b3261e)">' +
    gbp(sum(over)) +
    '</b><span>Overdue (' +
    over.length +
    ')</span></div><div class="stat"><b>' +
    gbp(sum(paidY)) +
    '</b><span>Paid in ' +
    TODAY.getFullYear() +
    '</span></div></div>' +
    '<div class="chips" style="margin:0 0 10px">' +
    chips
      .map(function (c) {
        return (
          '<button type="button" data-ivf="' +
          c[0] +
          '" aria-pressed="' +
          (ivFilter === c[0]) +
          '">' +
          c[1] +
          '</button>'
        );
      })
      .join('') +
    '</div>' +
    (all.length
      ? ''
      : '<div class="empty"><h2>No quotes or invoices yet</h2>Open a ' +
        esc(N1()) +
        ' and use New quote or New invoice. Add your business details and logo first so they appear on every document.<br><button class="btn" data-bizopen="1">Add business details</button></div>') +
    (l.length
      ? '<div class="tw" tabindex="0" role="region" aria-label="Table: scroll sideways to see more"><table><thead><tr><th>Number</th><th>Type</th><th>' +
        esc(CL().replace(/s$/, '')) +
        '</th><th>Date</th><th>Due / valid until</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
        l
          .map(function (x) {
            return (
              '<tr class="click" data-dcopen="' +
              esc(x.c.id) +
              '|' +
              esc(x.d.id) +
              '"><td><b>' +
              esc(x.d.number) +
              '</b></td><td>' +
              (x.d.kind === 'quote' ? 'Quote' : 'Invoice') +
              '</td><td>' +
              esc(x.d.toName || names(x.c)) +
              cno(x.c) +
              '</td><td>' +
              fd(x.d.date) +
              '</td><td>' +
              fd(x.d.due) +
              '</td><td class="num">' +
              gbp(x.d.total || dcTotals(x.d).total) +
              '</td><td>' +
              dcChip(x.d) +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table></div>'
      : all.length
        ? '<div class="muted">Nothing here.</div>'
        : '')
  );
}

/* --- tenancy agreement (landlords, England) --- */
var taCase = null,
  taTn = null;
var TA_BILLS = [
  ['councilTax', 'Council tax'],
  ['gas', 'Gas'],
  ['electricity', 'Electricity'],
  ['water', 'Water and sewerage'],
  ['broadband', 'Broadband and phone'],
  ['tv', 'TV licence']
];
