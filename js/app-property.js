'use strict';
/* MySimpleDesk app: The rental property page, its folder and its uploaded documents.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- landlords: property page with tenants and certificates ---------- */
function tfv(tn, k) {
  var v = tn ? tn[k] : null;
  if (v !== '' && v != null) return v;
  var f = T.tByKey && T.tByKey[k];
  if (f && f.auto && tn) {
    var s = tfv(tn, f.auto.from);
    return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? autoDate(s, f.auto) : '';
  }
  return '';
}
function tnMigrate(c) {
  var ap = (c.applicants || []).filter(function (a) {
      return a && a.name;
    }),
    has = ap.length || c.rent || c.tenancyStart || c.deposit;
  if (!has) return [];
  var tn = {
    id: 'tmig',
    status: 'current',
    people: ap.map(function (a) {
      return { name: a.name, phone: a.phone || '', email: a.email || '' };
    })
  };
  (T.tenancyFields || []).forEach(function (f) {
    if (f.k !== 'status' && c[f.k] != null && c[f.k] !== '') tn[f.k] = c[f.k];
  });
  if (c.tenancyDoc) tn.agreement = c.tenancyDoc;
  return [tn];
}
function tnList(c) {
  return (c && c.tenancies) || (T.tenancyMode && c ? tnMigrate(c) : []);
}
function tnCurrent(c) {
  return tnList(c).filter(function (t) {
    return (t.status || 'current') === 'current';
  });
}
function tnCorp(tn) {
  return (tn && tn.tenantType) === 'corporate';
}
function tnAgLabel(tn) {
  var corp = tnCorp(tn),
    has = tn.agreement && (tn.agreement.kind === 'company') === corp;
  return (has ? 'Open ' : 'Create ') + (corp ? 'company let agreement' : 'tenancy agreement');
}
function tnDir(v, i) {
  return (
    '<div class="tnd" style="display:flex;gap:8px;align-items:flex-end;margin:0 0 8px"><label class="f" style="flex:1;margin:0">Director<input data-td="1" maxlength="80" value="' +
    esc(v || '') +
    '"></label><button type="button" class="btn ghost sm" data-tnrmd="1">Remove</button></div>'
  );
}
function tnCoHtml(tn) {
  var corp = tnCorp(tn),
    dirs = (tn.directors || []).filter(Boolean).slice(0, 4);
  return (
    '<div class="tntype"><label class="f">Type of tenant<select data-tf="tenantType"><option value="private"' +
    (corp ? '' : ' selected') +
    '>Private tenant</option><option value="corporate"' +
    (corp ? ' selected' : '') +
    '>Corporate tenant</option></select></label></div>' +
    '<div class="tnco" style="' +
    (corp ? '' : 'display:none') +
    '"><div class="grid" style="margin:0 0 10px"><label class="f">Company name<input data-tf="company" maxlength="120" value="' +
    esc(tn.company || '') +
    '"></label><label class="f">Company registration number<input data-tf="companyNo" maxlength="20" value="' +
    esc(tn.companyNo || '') +
    '"></label></div>' +
    '<div class="tndirs">' +
    (dirs.length ? dirs : ['']).map(tnDir).join('') +
    '</div><button type="button" class="btn ghost sm" data-tnaddd="1"' +
    (dirs.length >= 4 ? ' style="display:none"' : '') +
    '>Add director</button>' +
    '<p class="muted" style="margin:10px 0 8px;font-size:12px">A company usually cannot hold an assured tenancy, so the deposit and rent increase rules for ordinary tenants on this page may not apply to a company let. Use the company let agreement button at the bottom of this card.</p>' +
    '<p style="margin:0 0 6px;font-weight:600;font-size:13px">Contact at the company</p></div>'
  );
}
function tnCoSync(card) {
  var s = card.querySelector('[data-tf="tenantType"]'),
    corp = s && s.value === 'corporate',
    co = card.querySelector('.tnco'),
    ab = card.querySelector('[data-tnaddp]'),
    ad = card.querySelector('[data-tnaddd]');
  if (co) co.style.display = corp ? '' : 'none';
  if (ab) ab.textContent = corp ? 'Add another contact' : 'Add joint tenant';
  var agb = card.querySelector('[data-tnag]');
  if (agb) {
    var tid = card.getAttribute('data-tn'),
      tn0 =
        tnList(currentCase() || {}).filter(function (x) {
          return x.id === tid;
        })[0] || {};
    agb.textContent = tnAgLabel(Object.assign({}, tn0, { tenantType: corp ? 'corporate' : 'private' }));
  }
  if (ad) ad.style.display = card.querySelectorAll('.tnd').length >= 4 ? 'none' : '';
  if (corp) {
    var tt = card.querySelector('[data-tf="tenancyType"]');
    if (tt && !tt.value) tt.value = 'Company let';
  }
}
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t && t.getAttribute && t.getAttribute('data-tf') === 'tenantType') {
    var cd = t.closest('.tncard');
    if (cd) tnCoSync(cd);
  }
  if (t && t.id === 'f-postcode') t.value = pcFmt(t.value);
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t && t.id === 'f-propertyAddress' && t.value.trim()) {
    t.style.borderColor = '';
    var m = $('#paErr');
    if (m) m.remove();
  }
});
function paNeed() {
  var f = $('#f-propertyAddress');
  if (!f) return;
  f.style.borderColor = '#b3261e';
  if (!$('#paErr'))
    f.insertAdjacentHTML(
      'afterend',
      '<span id="paErr" role="alert" style="color:#b3261e;font-size:12px;font-weight:600">Address line one is needed before the property can be saved.</span>'
    );
  var fs = f.closest('fieldset');
  if (fs && fs.classList.contains('col-closed')) {
    var cb = fs.querySelector('[data-coltoggle]');
    if (cb) cb.click();
  }
  f.scrollIntoView({ block: 'center' });
  try {
    f.focus({ preventScroll: true });
  } catch (x) {}
}
function tnNames(tn) {
  if (tnCorp(tn) && String(tn.company || '').trim()) return String(tn.company).trim();
  return (tn.people || [])
    .map(function (p) {
      return p.name;
    })
    .filter(Boolean)
    .join(' & ');
}
function tnMonthly(tn) {
  var r = +tfv(tn, 'rent') || 0,
    f = tfv(tn, 'rentFreq');
  return f === 'Weekly'
    ? (r * 52) / 12
    : f === 'Every 4 weeks'
      ? (r * 13) / 12
      : f === 'Quarterly'
        ? r / 3
        : r;
}
function rentSum(c) {
  return tnCurrent(c).reduce(function (a, t) {
    return a + tnMonthly(t);
  }, 0);
}
function occOf(c) {
  var cur = tnCurrent(c);
  if (!cur.length) return 'Vacant';
  return cur.some(function (t) {
    return tfv(t, 'noticeDate');
  })
    ? 'Notice given'
    : 'Let';
}
function occChip(c) {
  var o = occOf(c);
  return '<span class="chip ' + (o === 'Let' ? 'ok' : o === 'Vacant' ? 'warn' : 'bad') + '">' + o + '</span>';
}
function tnReminders(c) {
  var out = [];
  if (!T.tenancyReminders) return out;
  tnCurrent(c).forEach(function (tn) {
    T.tenancyReminders.forEach(function (r) {
      if (
        r.unless &&
        r.unless.some(function (k) {
          return tfv(tn, k) !== '';
        })
      )
        return;
      var d = tfv(tn, r.k),
        key = 't:' + tn.id + ':' + r.k;
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || (c.remDone && c.remDone[key] === d)) return;
      out.push({ date: d, label: r.l + (tnNames(tn) ? ' · ' + tnNames(tn) : ''), key: key, sec: false });
    });
  });
  return out;
}
function tfHtml(f, tn) {
  var v = tn[f.k];
  if (f.t === 'sel') {
    var opts = (f.o || []).map(function (x) {
        return Array.isArray(x) ? x : [x, x === '' ? 'Choose…' : x];
      }),
      cur = v == null ? (f.k === 'status' ? 'current' : '') : v;
    return (
      '<label class="f">' +
      esc(f.l) +
      '<select data-tf="' +
      f.k +
      '">' +
      opts
        .map(function (o) {
          return (
            '<option value="' +
            esc(o[0]) +
            '"' +
            (o[0] === cur ? ' selected' : '') +
            '>' +
            esc(o[1]) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>'
    );
  }
  if (f.t === 'date' && f.auto)
    return (
      '<label class="f">' +
      esc(f.l) +
      '<input data-tf="' +
      f.k +
      '" type="date" data-auto="' +
      (v ? '0' : '1') +
      '" data-tfrom="' +
      f.auto.from +
      '" value="' +
      esc(tfv(tn, f.k)) +
      '"></label>'
    );
  var inp =
    '<input data-tf="' +
    f.k +
    '" type="' +
    (f.t === 'money' || f.t === 'num'
      ? 'number" step="any" inputmode="decimal'
      : f.t === 'date'
        ? 'date'
        : 'text') +
    '" value="' +
    esc(v == null ? '' : v) +
    '">';
  if (f.t === 'money') inp = '<span class="ig"><i>£</i>' + inp + '</span>';
  return '<label class="f">' + esc(f.l) + inp + '</label>';
}
function tnPerson(p) {
  p = p || {};
  return (
    '<div class="tnp"><label class="f">Name<input data-tp="name" value="' +
    esc(p.name || '') +
    '"></label><label class="f">Phone<input data-tp="phone" type="tel" value="' +
    esc(p.phone || '') +
    '"><span class="pl">' +
    plinks(p.phone) +
    '</span></label><label class="f">Email<input data-tp="email" type="email" value="' +
    esc(p.email || '') +
    '"><span class="pl el">' +
    elinks(p.email) +
    '</span></label><button type="button" class="x" data-tnrmp="1" aria-label="Remove this tenant">×</button></div>'
  );
}
/* tenant card sections: the basics always show; deposit and checks fold away behind a one-line summary */
var TN_GROUPS = [
  ['rent', 'Tenancy and rent', ['status', 'tenancyType', 'tenancyStart', 'rent', 'rentFreq', 'rentDay']],
  ['deposit', 'Deposit', ['deposit', 'depositReceived', 'depositDue', 'depositScheme', 'depositProtected']],
  [
    'checks',
    'Checks, rent increases and notices',
    ['rightToRent', 'infoSheet', 'lastRentIncrease', 'nextRentIncrease', 'noticeDate', 'moveOut']
  ]
];
function tnSumDeposit(tn) {
  var dep = +tfv(tn, 'deposit') || 0,
    sch = tfv(tn, 'depositScheme'),
    rec = tfv(tn, 'depositReceived'),
    due = tfv(tn, 'depositDue'),
    pr = tfv(tn, 'depositProtected');
  if (sch === 'Not taken') return ['', 'No deposit taken'];
  if (pr)
    return [
      'ok',
      (dep ? money(dep) + ' · ' : '') + 'protected' + (sch ? ' with ' + sch : '') + ' on ' + fd(pr)
    ];
  if (rec && due)
    return [
      diff(due) < 0 ? 'bad' : 'warn',
      (dep ? money(dep) + ' · ' : '') + 'not protected yet · protect by ' + fd(due)
    ];
  if (dep) return ['', money(dep) + (sch ? ' · ' + sch : '')];
  return ['', 'Not added yet'];
}
function tnSumChecks(tn) {
  var out = [],
    rtr = tfv(tn, 'rightToRent'),
    nx = tfv(tn, 'nextRentIncrease'),
    nt = tfv(tn, 'noticeDate'),
    mo = tfv(tn, 'moveOut');
  out.push(rtr ? 'Right to rent checked ' + fd(rtr) : 'Right to rent not recorded');
  if (nx) out.push('next rent increase from ' + fd(nx));
  if (nt) out.push('notice ' + fd(nt));
  if (mo) out.push('moving out ' + fd(mo));
  return [rtr ? '' : 'warn', out.join(' · ')];
}
function tnSections(tn, isNew) {
  var F = T.tenancyFields || [],
    used = {},
    grid = function (keys) {
      return (
        '<div class="grid">' +
        keys
          .map(function (k) {
            used[k] = 1;
            var f = T.tByKey[k];
            return f ? tfHtml(f, tn) : '';
          })
          .join('') +
        '</div>'
      );
    };
  var g = TN_GROUPS.map(function (x) {
    return [
      x[0],
      x[1],
      x[2].filter(function (k) {
        return T.tByKey && T.tByKey[k];
      })
    ];
  });
  F.forEach(function (f) {
    if (
      !g.some(function (x) {
        return x[2].indexOf(f.k) > -1;
      })
    )
      g[g.length - 1][2].push(f.k);
  });
  var h =
    '<div class="tnsec"><div class="tnsh">' +
    esc(g[0][1]) +
    '</div>' +
    grid(g[0][2]) +
    '</div>' +
    rlBox(tn, currentCase() || {});
  g.slice(1).forEach(function (x) {
    if (!x[2].length) return;
    var sm = x[0] === 'deposit' ? tnSumDeposit(tn) : tnSumChecks(tn),
      open = sm[0] === 'bad' || (x[0] === 'deposit' && sm[0] === 'warn');
    h +=
      '<details class="tnsec tnfold"' +
      (open ? ' open' : '') +
      '><summary><span class="tnsh">' +
      esc(x[1]) +
      '</span><span class="tnsum ' +
      sm[0] +
      '">' +
      (sm[0] === 'bad' || sm[0] === 'warn' ? '&#9888; ' : '') +
      esc(isNew && sm[1] === 'Not added yet' ? 'Add later if you like' : sm[1]) +
      '</span></summary>' +
      grid(x[2]) +
      '</details>';
  });
  return h;
}
function tnCard(tn, isNew, others) {
  var ended = (tn.status || 'current') === 'ended',
    nm = tnNames(tn),
    rent = tfv(tn, 'rent'),
    st = tfv(tn, 'tenancyStart');
  var sum =
    (nm || 'New tenant') +
    (rent !== ''
      ? ' · ' + money(rent) + (tfv(tn, 'rentFreq') ? ' ' + String(tfv(tn, 'rentFreq')).toLowerCase() : '')
      : '') +
    (st ? ' · from ' + fd(st) : '') +
    (ended && tfv(tn, 'moveOut') ? ' to ' + fd(tfv(tn, 'moveOut')) : '');
  return (
    '<details class="tncard' +
    (ended ? ' ended' : '') +
    (isNew ? ' isnew' : ' locked') +
    '" data-tn="' +
    esc(tn.id) +
    '"' +
    (isNew ? ' data-new="1"' : '') +
    (ended ? '' : ' open') +
    '><summary><b>' +
    esc(isNew ? 'Create tenant' : sum) +
    '</b> <span class="chip ' +
    (ended ? '' : 'ok') +
    '">' +
    (isNew ? 'Not saved yet' : ended ? 'Previous tenant' : 'Current') +
    '</span><span class="chip tnlk">Locked</span></summary>' +
    (isNew && others
      ? '<label class="tnmove"><input type="checkbox" data-tnmove="1" checked> Move ' +
        esc(others) +
        ' to Previous tenants when this tenant is saved</label>'
      : '') +
    '<div class="tnsec"><div class="tnsh">Who is renting</div>' +
    tnCoHtml(tn) +
    '<div class="tnpeople">' +
    (tn.people && tn.people.length ? tn.people : [{}]).map(tnPerson).join('') +
    '</div><button type="button" class="btn ghost sm" data-tnaddp="1">' +
    (tnCorp(tn) ? 'Add another contact' : 'Add joint tenant') +
    '</button></div>' +
    tnSections(tn, isNew) +
    '<div class="tnacts">' +
    (isNew
      ? ''
      : '<button type="button" class="btn ghost sm" data-tnag="' +
        esc(tn.id) +
        '">' +
        tnAgLabel(tn) +
        '</button><button type="button" class="btn ghost sm" data-tnstmt="' +
        esc(tn.id) +
        '">Rent statement</button>') +
    '<span class="sp"></span>' +
    (isNew
      ? '<button type="button" class="btn ghost sm" data-tncancel="1">Cancel</button>'
      : '<button type="button" class="btn ghost sm danger" data-tnrm="1">Delete tenant</button><button type="button" class="btn ghost sm" data-tnedit="1">Edit</button>') +
    '<button type="button" class="btn sm" data-tnsave="1">Save tenant</button></div></details>'
  );
}
/* ---------- property folder and uploaded documents (landlord) ---------- */
var DZ_BTN =
    'background:none;border:0;padding:0;font:inherit;font-weight:600;color:var(--link,#0A6B50);cursor:pointer;text-align:left',
  pfTried = {},
  pfRun = false,
  dzBusy = false;
function pfClean(s, n) {
  return String(s || '')
    .replace(/[\\\/:*?"<>|#%~&{}\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '')
    .slice(0, n || 80)
    .replace(/[ .]+$/, '');
}
/* where a record's folder sits: rental properties in Properties, a trade's jobs in Jobs */
function dzRoot() {
  return T && T.tenancyMode ? undefined : T.docRoot || 'Jobs';
}
function dzRootL() {
  return T && T.tenancyMode ? 'Properties' : T.docRoot || 'Jobs';
}
function dzNoun() {
  return T && T.tenancyMode ? 'property' : N1().toLowerCase();
}
function pfName(c, used) {
  var a =
    T && T.tenancyMode
      ? pfClean(String(c.propertyAddress || '').split(/[\n,]/)[0]) || 'Property ' + (c.clientNo || '')
      : pfClean(
          [pnames(c), String((T && T.addr && c[T.addr]) || '').split(/[\n,]/)[0]].filter(Boolean).join(' - ')
        ) || N1() + ' ' + (c.clientNo || '');
  var clash =
    (used && used[a.toLowerCase()]) ||
    cases.some(function (x) {
      return x.id !== c.id && x.folder && String(x.folder.name || '').toLowerCase() === a.toLowerCase();
    });
  return clash ? a + ' (' + (c.clientNo || String(c.id || '').slice(0, 4)) + ')' : a;
}
function dzFiles(c, k) {
  return ((c && c.files) || []).filter(function (f) {
    return f.k === k;
  });
}
/* phones also get a Take photo button next to Upload (Upload opens the file picker; Take photo opens the camera) */
function dzTouch() {
  return !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
}
function dzCam(k, t) {
  return dzTouch()
    ? '<button type="button" style="' +
        DZ_BTN +
        '" data-dzup="' +
        esc(k) +
        '" data-dzcam="1">' +
        esc(t || 'Take photo') +
        '</button>'
    : '';
}
function dzInner(c, k, label) {
  var fl = dzFiles(c, k),
    up = function (t) {
      return (
        '<button type="button" style="' + DZ_BTN + '" data-dzup="' + esc(k) + '">' + esc(t) + '</button>'
      );
    },
    rm = function (f) {
      return (
        '<button type="button" style="' +
        DZ_BTN +
        ';color:#8a98a3" data-dzrm="' +
        esc(f.id) +
        '">Delete</button>'
      );
    };
  if (k === 'other')
    return (
      fl
        .map(function (f) {
          return (
            '<div class="pl" style="flex-wrap:wrap;margin:0 0 8px"><a class="doclink" href="' +
            esc(f.url) +
            '" target="_blank" rel="noopener">' +
            esc(f.name) +
            '</a><button type="button" style="' +
            DZ_BTN +
            '" data-dzrem="' +
            esc(f.id) +
            '">Remind me</button>' +
            rm(f) +
            '</div>'
          );
        })
        .join('') +
      '<div class="pl">' +
      dzCam('other', 'Take photo') +
      up('Upload a document') +
      '</div>'
    );
  if (!fl.length) return dzCam(k, 'Take photo') + up('Upload ' + label);
  var f = fl[fl.length - 1];
  return (
    '<a class="doclink" href="' +
    esc(f.url) +
    '" target="_blank" rel="noopener" title="' +
    esc(f.name) +
    '">Open ' +
    esc(label) +
    '</a>' +
    up('Replace') +
    dzCam(k, 'Replace with photo') +
    rm(f)
  );
}
function dzSpan(c, f) {
  return (
    '<span class="pl dz" style="flex-wrap:wrap" data-dz="' +
    esc(f.k) +
    '" data-dzl="' +
    esc(f.doc) +
    '">' +
    dzInner(c, f.k, f.doc) +
    '</span>'
  );
}
function dzFolderHtml(c) {
  var f = c && c.folder,
    w = window.CD_files ? window.CD_files.where() : 'file storage';
  if (f && f.name)
    return (
      '<p class="muted" style="margin:0 0 8px;font-size:12px">Folder in your ' +
      esc(w) +
      ': <b>' +
      dzRootL() +
      ' › ' +
      esc(f.name) +
      '</b></p>' +
      (f.url
        ? '<div class="pl" style="margin:0 0 6px"><a class="doclink" href="' +
          esc(f.url) +
          '" target="_blank" rel="noopener">Open ' +
          dzNoun() +
          ' folder</a></div>'
        : '') +
      '<p style="margin:0 0 10px;padding:7px 9px;background:#FBEFD2;color:#6b4700;border-radius:7px;font-size:12px"><b>Do not delete, move or rename folders in your ' +
      esc(w) +
      '.</b> Your records and documents are kept there, and deleting them removes them from the app.</p>'
    );
  return (
    '<p class="muted" style="margin:0 0 8px;font-size:12px">' +
    (T.tenancyMode
      ? 'A folder for this property is made in your ' +
        esc(w) +
        ' when the property is saved. It is named after the first line of the address.'
      : 'A folder for this ' +
        dzNoun() +
        ' is made in your ' +
        esc(w) +
        ' when you save the first photo or document. It is named after the customer and the address.') +
    '</p>'
  );
}
function dzSide(c) {
  return (
    '<fieldset data-sec="docs"><legend>' +
    (T.tenancyMode ? 'Property' : N1()) +
    ' documents</legend><div id="dzFolder">' +
    dzFolderHtml(c) +
    '</div><div data-dz="other" data-dzl="document">' +
    dzInner(c, 'other', 'document') +
    '</div><p class="muted" style="margin:8px 0 0;font-size:12px">' +
    (T.tenancyMode
      ? 'Certificates can also be uploaded next to their dates. '
      : T.docHint
        ? T.docHint + ' '
        : 'Photograph a certificate, data plate or the finished work. Photos are saved as one PDF. ') +
    'Files up to 50 MB.</p></fieldset>'
  );
}
function dzRefresh(c) {
  document.querySelectorAll('#caseForm [data-dz]').forEach(function (el) {
    el.innerHTML = el.hasAttribute('data-dzlg')
      ? lgDocInner(c, el.getAttribute('data-dz'))
      : dzInner(c, el.getAttribute('data-dz'), el.getAttribute('data-dzl'));
  });
  var ff = $('#dzFolder');
  if (ff) ff.innerHTML = dzFolderHtml(c);
}
function dzErr(e) {
  if (e && e.renew)
    return 'Google Drive needs reconnecting. Press the yellow bar at the bottom, then upload again.';
  if (navigator.onLine === false || e instanceof TypeError)
    return 'Could not reach your file storage. Check you are online, then upload again.';
  if (e && (e.full || e.status === 507))
    return 'Your file storage is full. Free up space or add storage, then upload again.';
  return 'Could not upload the file (' + ((e && e.message) || 'try again') + ').';
}
function dzDest(k) {
  var c = currentCase(),
    el = document.querySelector('#caseForm [data-dz="' + k + '"]'),
    label = (el && el.getAttribute('data-dzl')) || 'document',
    w = (window.CD_files && window.CD_files.where && window.CD_files.where()) || 'your storage',
    folder = c ? (c.folder && c.folder.name) || pfName(c) : '';
  return (
    w +
    ' › ' +
    dzRootL() +
    ' › ' +
    folder +
    (k === 'other' ? '' : ' › ' + label.charAt(0).toUpperCase() + label.slice(1))
  );
}
function dzPick(k, lg, cam) {
  if (!openId) {
    toast('Add the property address first. It saves itself, then try again.');
    return;
  }
  if (!window.CD_files || !window.CD_files.can()) {
    toast('Could not reach your file storage. Check you are online, then try again.');
    return;
  }
  if (dzBusy) {
    toast('Still uploading the last file. Try again in a moment.');
    return;
  }
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.id = 'dzFile';
  inp.accept = cam
    ? 'image/*'
    : '.pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.xls,.xlsx,.txt,image/*,application/pdf';
  if (cam) inp.setAttribute('capture', 'environment');
  if (!cam) inp.multiple = true;
  inp.style.display = 'none';
  var old = $('#dzFile');
  if (old) old.remove();
  document.body.appendChild(inp);
  inp.addEventListener('change', function () {
    var files = [].slice.call(inp.files || []);
    inp.remove();
    if (!files.length) return;
    var imgs = files.filter(scIsImg),
      after = function (f, c) {
        if (lg && dzFiles(currentCase(), k).length) lgAsk(k, f, c);
        else dzSend(k, f, lg ? 'keep' : '', c);
      };
    if (imgs.length) {
      if (imgs.length < files.length)
        toast('Only the photos were used. Upload a PDF or Word file on its own.');
      scOpen({
        files: imgs,
        source: cam ? 'camera' : 'file',
        dest: dzDest(k),
        ask: k === 'other' ? 'Document name' : '',
        hint: 'For example: Boiler service 2026',
        done: function (f, th, named) {
          after(f, !named);
        },
        fallback: function (f) {
          after(f, false);
        }
      });
    } else if (files.length > 1) toast('Choose one PDF or Word file at a time.');
    else after(files[0], false);
  });
  inp.click();
}
function dzSend(k, file, mode, cam) {
  var id = openId,
    c = currentCase();
  if (!id || !c) return;
  if (!file.size) {
    toast('That file is empty.');
    return;
  }
  if (file.size > window.CD_files.max) {
    toast('That file is over 50 MB. Choose a smaller file.');
    return;
  }
  var el = document.querySelector('#caseForm [data-dz="' + k + '"]'),
    label = (el && el.getAttribute('data-dzl')) || 'document';
  var oext = (/\.[A-Za-z0-9]{1,8}$/.exec(file.name) || [''])[0].toLowerCase(),
    dt = ($('#f-' + k) || {}).value || iso(TODAY);
  var folder = (c.folder && c.folder.name) || pfName(c);
  var sentInfo = null;
  dzBusy = true;
  pfTried[id] = 1;
  toast('Uploading ' + (cam ? 'the PDF' : file.name) + '…', true);
  /* phone photos are large: rcPrep shrinks images to a clear JPEG (PDFs and other files are sent as they are) */
  rcPrep(file)
    .then(function (pp) {
      var blob = pp.blob,
        ext = pp.ext || oext,
        d = new Date(),
        z = function (n) {
          return String(n).padStart(2, '0');
        };
      sentInfo = { blob: blob, name: file.name, type: blob.type || file.type || '' };
      var base = cam
        ? 'Scan ' + iso(TODAY) + ' ' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds())
        : pfClean(file.name.slice(0, file.name.length - oext.length), 100) || 'Document';
      var fname =
        k === 'other' ? base + ext : label.charAt(0).toUpperCase() + label.slice(1) + ' ' + dt + ext;
      if (
        mode === 'keep' &&
        k !== 'other' &&
        dzFiles(c, k).some(function (f) {
          return String(f.name).toLowerCase() === fname.toLowerCase();
        })
      )
        fname = fname.slice(0, fname.length - ext.length) + ' (added ' + iso(TODAY) + ')' + ext;
      if (blob.size > window.CD_files.max) throw { big: true };
      return window.CD_files.upload(folder, fname, blob, undefined, dzRoot()).then(function (res) {
        return { res: res, size: blob.size };
      });
    })
    .then(
      function (o) {
        var res = o.res;
        dzBusy = false;
        var cur =
          cases.filter(function (x) {
            return x.id === id;
          })[0] || c;
        var old =
          mode === 'replace'
            ? (cur.files || []).filter(function (f) {
                return f.k === k;
              })
            : [];
        var files = (cur.files || []).filter(function (f) {
          return k === 'other' || mode === 'keep' || f.k !== k;
        });
        files.push({
          id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          k: k,
          name: res.name,
          url: res.url,
          fid: res.id,
          size: o.size,
          at: Date.now()
        });
        var up = { files: files };
        if (res.folder && res.folder.name && !(cur.folder && cur.folder.url)) up.folder = res.folder;
        patch(id, up);
        toast('Uploaded to ' + dzRootL() + ' › ' + folder);
        try {
          dxAfter(id, k, sentInfo, res);
        } catch (e) {}
        if (openId === id) dzRefresh(Object.assign({}, cur, up));
        if (old.length && window.CD_files.trash) {
          var w = window.CD_files.where(),
            bin = w === 'Google Drive' ? 'Google Drive bin' : w + ' recycle bin';
          Promise.all(
            old.map(function (f) {
              return f.fid
                ? window.CD_files.trash(f.fid).then(
                    function () {
                      return true;
                    },
                    function () {
                      return false;
                    }
                  )
                : Promise.resolve(false);
            })
          ).then(function (rs) {
            var bad = rs.filter(function (x) {
              return !x;
            }).length;
            toast(
              bad
                ? 'Uploaded. ' +
                    bad +
                    ' old document' +
                    (bad > 1 ? 's' : '') +
                    ' could not be moved to the ' +
                    bin +
                    '. Delete ' +
                    (bad > 1 ? 'them' : 'it') +
                    ' from the property folder yourself.'
                : 'Uploaded. The old document' + (old.length > 1 ? 's are' : ' is') + ' in your ' + bin + '.'
            );
          });
        }
      },
      function (e) {
        Promise.resolve(e && e.bodyP)
          .catch(function () {})
          .then(function () {
            dzBusy = false;
            toast(e && e.big ? 'That file is over 50 MB. Choose a smaller file.' : dzErr(e));
          });
      }
    );
}
function dzRemove(fid) {
  var id = openId,
    c = currentCase();
  if (!id || !c) return;
  var f = (c.files || []).filter(function (x) {
    return x.id === fid;
  })[0];
  if (!f) return;
  if (!confirm('Delete "' + f.name + '"? It moves to your ' + binName() + ' and is taken off this record.'))
    return;
  toast('Deleting…', true);
  fileDelete(f.fid).then(function (r) {
    if (r === 'offline' || r === 'fail') {
      toast(delFailMsg(r));
      return;
    }
    var cur =
        cases.filter(function (x) {
          return x.id === id;
        })[0] || c,
      up = {
        files: (cur.files || []).filter(function (x) {
          return x.id !== fid;
        })
      };
    if (
      f.fid &&
      (cur.expRems || []).some(function (r) {
        return r.fid === f.fid;
      })
    )
      up.expRems = cur.expRems.filter(function (r) {
        return r.fid !== f.fid;
      });
    patch(id, up);
    if (openId === id) dzRefresh(Object.assign({}, cur, up));
    toast(delTell(r));
  });
}
document.addEventListener('click', function (e) {
  var rmd = e.target && e.target.closest ? e.target.closest('[data-dzrem]') : null;
  if (rmd) {
    e.preventDefault();
    var cf = currentCase(),
      ff =
        cf &&
        (cf.files || []).filter(function (x) {
          return x.id === rmd.getAttribute('data-dzrem');
        })[0];
    if (ff) expManual({ t: 'case', id: openId }, ff);
    return;
  }
  var t = e.target && e.target.closest ? e.target.closest('[data-dzup],[data-dzrm]') : null;
  if (!t) return;
  e.preventDefault();
  if (t.hasAttribute('data-dzup'))
    dzPick(t.getAttribute('data-dzup'), !!t.closest('[data-dzlg]'), t.hasAttribute('data-dzcam'));
  else dzRemove(t.getAttribute('data-dzrm'));
});
/* makes the storage folder for every property that has an address and no folder yet (new and existing properties) */
function pfSweep() {
  if (!T.tenancyMode || pfRun || !window.CD_files || !window.CD_files.can()) return;
  var todo = cases.filter(function (c) {
    return (
      String(c.propertyAddress || '').trim() && !(c.folder && c.folder.name && c.folder.rc) && !pfTried[c.id]
    );
  });
  if (!todo.length) return;
  pfRun = true;
  var used = {};
  (function next() {
    var c = todo.shift();
    if (!c) {
      pfRun = false;
      return;
    }
    pfTried[c.id] = 1;
    var nm = (c.folder && c.folder.name) || pfName(c, used);
    used[nm.toLowerCase()] = 1;
    window.CD_files.folder(nm).then(
      function (f) {
        if (f && f.name) {
          f = Object.assign({}, c.folder || {}, f);
          patch(c.id, { folder: f });
          if (openId === c.id) {
            var cur = currentCase() || c;
            dzRefresh(Object.assign({}, cur, { folder: f }));
          }
        }
        next();
      },
      function () {
        next();
      }
    );
  })();
}
function llBody(c) {
  var main = T.sections.filter(function (s) {
      return !s.side;
    }),
    side = T.sections.filter(function (s) {
      return s.side;
    });
  var tenants = tnFsHtml(c);
  var prop = main
    .map(function (s, i) {
      return (
        secFs(s.id, esc(s.title)) +
        (i === 0
          ? fld('clientNo', 'Property reference', c.clientNo) + sel('type', 'Type', c.type, typeOpts(c.type))
          : '') +
        s.fields
          .map(function (f) {
            return fieldHtml(f, c);
          })
          .join('') +
        '</div></fieldset>'
      );
    })
    .join('');
  return (
    '<div class="llgrid"><div class="llmain">' +
    prop +
    tenants +
    dzSide(c) +
    '</div>' +
    '<aside class="llside">' +
    advBox(fv(c, 'btlFixedUntil'), 'Buy-to-let mortgage deal') +
    lgBox(c) +
    side
      .map(function (s) {
        return (
          secFs(s.id, esc(s.title)) +
          s.fields
            .map(function (f) {
              return fieldHtml(f, c);
            })
            .join('') +
          '</div></fieldset>'
        );
      })
      .join('') +
    '</aside></div>'
  );
}
/* Tenants section: current tenants, then a closed list of previous tenants.
   A newly added tenant (data-new) moves the current tenants to Previous tenants when it is saved, unless the box on the new card is unticked. */
function tnFsHtml(c) {
  var all = tnList(c),
    cur = all.filter(function (t) {
      return (t.status || 'current') !== 'ended';
    }),
    prev = all
      .filter(function (t) {
        return (t.status || 'current') === 'ended';
      })
      .sort(function (a, b) {
        return String(tfv(b, 'moveOut') || tfv(b, 'tenancyStart') || '').localeCompare(
          String(tfv(a, 'moveOut') || tfv(a, 'tenancyStart') || '')
        );
      });
  var sum = cur.length ? cur.map(tnNames).filter(Boolean).join(', ') : 'Vacant';
  return (
    '<fieldset id="tnFs"><legend>Tenants <span class="lgsum">' +
    esc(sum) +
    '</span></legend>' +
    '<div class="tnbar"><span class="tnh">Current tenant' +
    (cur.length > 1 ? 's' : '') +
    '</span><button type="button" class="btn sm" id="addTn">Create tenant</button></div>' +
    '<div id="tns">' +
    cur
      .map(function (t) {
        return tnCard(t);
      })
      .join('') +
    '</div>' +
    (cur.length
      ? ''
      : '<p class="muted" id="tnEmpty" style="margin:0 0 8px">No current tenant. Press Create tenant to add one.</p>') +
    '<details class="tnprev" id="tnPrev"><summary><span class="tnh">Previous tenants</span> <span class="chip">' +
    prev.length +
    '</span></summary><div id="tnsPrev">' +
    (prev.length
      ? prev
          .map(function (t) {
            return tnCard(t);
          })
          .join('')
      : '<p class="muted" style="margin:6px 0">No previous tenants yet.</p>') +
    '</div></details></fieldset>'
  );
}
/* a saved tenant is locked (read only) until Edit is pressed; rent payments stay usable */
function tnLock(card, on) {
  card.classList.toggle('locked', !!on);
  card.querySelectorAll('[data-tf],[data-tp],[data-td],[data-tnmove]').forEach(function (i) {
    i.disabled = !!on;
    var l = i.closest('label.f');
    if (l && !l.closest('.rlrow'))
      l.classList.toggle(
        'blank',
        !!on &&
          (!String(i.value || '').trim() ||
            (i.getAttribute('data-tf') === 'tenantType' && i.value === 'private') ||
            (i.getAttribute('data-tf') === 'status' && i.value === 'current'))
      );
  });
  var lk = card.querySelector('.tnlk');
  if (lk) lk.textContent = on ? 'Locked' : 'Editing';
}
function tnLockAll() {
  document.querySelectorAll('#tnFs .tncard.locked').forEach(function (cd) {
    tnLock(cd, true);
  });
}
function tnRedraw() {
  var fs = $('#tnFs'),
    c = currentCase();
  if (!fs || !c) return;
  var wasPrev = ($('#tnPrev') || {}).open,
    closed = fs.classList.contains('col-closed');
  var tmp = document.createElement('div');
  tmp.innerHTML = tnFsHtml(c);
  var nf = tmp.firstChild;
  fs.parentNode.replaceChild(nf, fs);
  if (wasPrev) $('#tnPrev').open = true;
  colOpen['tenants'] = !closed;
  decorateSecs();
  tnLockAll();
  if (typeof rhRender === 'function') rhRender();
  updStrip();
}
function tnSaveNow(msg) {
  if (!openId) {
    toast('Add address line one of the property first. It saves itself, then save the tenant.');
    paNeed();
    return false;
  }
  var data = collectForm();
  patch(openId, data);
  lastAuto = JSON.stringify(data);
  setTimeout(function () {
    tnRedraw();
    if (msg) toast(msg);
  }, 80);
  return true;
}
function tnCollect() {
  var cards = document.querySelectorAll('#tnFs .tncard');
  if (!$('#tns')) return null;
  var old = tnList(currentCase() || {}),
    out = [];
  cards.forEach(function (card) {
    if (
      card.hasAttribute('data-new') &&
      !Array.prototype.some.call(
        card.querySelectorAll('[data-tp="name"],[data-tf="company"],[data-tp="phone"],[data-tp="email"]'),
        function (i) {
          return i.value.trim();
        }
      )
    )
      return;
    var id = card.getAttribute('data-tn'),
      prev =
        old.filter(function (t) {
          return t.id === id;
        })[0] || {},
      tn = Object.assign({}, prev, { id: id });
    card.querySelectorAll('[data-tf]').forEach(function (e) {
      var k = e.getAttribute('data-tf');
      tn[k] = e.type === 'number' ? num(e.value) : e.value.trim();
    });
    (T.tenancyFields || []).forEach(function (f) {
      if (f.auto && tn[f.k]) {
        var s = tfv(Object.assign({}, tn, { [f.k]: '' }), f.auto.from);
        if (s && tn[f.k] === autoDate(s, f.auto)) tn[f.k] = '';
      }
    });
    tn.rentLog = [];
    card.querySelectorAll('.rlrow').forEach(function (r) {
      var o = { id: r.getAttribute('data-rlid') };
      r.querySelectorAll('[data-rl]').forEach(function (i) {
        var k = i.getAttribute('data-rl');
        o[k] = i.type === 'number' ? num(i.value) : i.value;
      });
      if (o.due || o.amount != null) tn.rentLog.push(o);
    });
    tn.tenantType = tn.tenantType === 'corporate' ? 'corporate' : 'private';
    tn.directors = [];
    card.querySelectorAll('[data-td]').forEach(function (i) {
      var v = i.value.trim();
      if (v && tn.directors.length < 4) tn.directors.push(v);
    });
    tn.people = [];
    card.querySelectorAll('.tnp').forEach(function (r) {
      var p = {};
      r.querySelectorAll('[data-tp]').forEach(function (i) {
        p[i.getAttribute('data-tp')] = i.value.trim();
      });
      if (p.name || p.phone || p.email) tn.people.push(p);
    });
    out.push(tn);
  });
  var nw = Array.prototype.slice
    .call(document.querySelectorAll('#tns .tncard[data-new]'))
    .filter(function (cd) {
      var b = cd.querySelector('[data-tnmove]');
      if (b && !b.checked) return false;
      return Array.prototype.some.call(
        cd.querySelectorAll('[data-tp="name"],[data-tf="company"]'),
        function (i) {
          return i.value.trim();
        }
      );
    });
  if (nw.length) {
    var ids = nw.map(function (cd) {
        return cd.getAttribute('data-tn');
      }),
      st = (
        out.filter(function (t) {
          return t.id === ids[0];
        })[0] || {}
      ).tenancyStart,
      end = st && /^\d{4}-\d{2}-\d{2}$/.test(st) ? addDays(st, -1) : iso(TODAY);
    out.forEach(function (t) {
      if (ids.indexOf(t.id) < 0 && (t.status || 'current') === 'current') {
        t.status = 'ended';
        if (!t.moveOut) t.moveOut = end;
      }
    });
  }
  return out;
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var b;
  if (t.id === 'addTn') {
    var box = $('#tns');
    if (!box) return;
    if (box.querySelector('[data-new]')) {
      toast('Finish or cancel the new tenant first.');
      box.querySelector('[data-new] [data-tp="name"]').focus();
      return;
    }
    var em = $('#tnEmpty');
    if (em) em.remove();
    var oth = Array.prototype.map
      .call(box.querySelectorAll('.tncard'), function (cd) {
        var sel = cd.querySelector('[data-tf="status"]');
        if (sel && sel.value === 'ended') return '';
        var n = Array.prototype.map
          .call(cd.querySelectorAll('[data-tp="name"]'), function (i) {
            return i.value.trim();
          })
          .filter(Boolean)
          .join(' & ');
        var co = cd.querySelector('[data-tf="company"]');
        return co && co.value.trim() && cd.querySelector('[data-tf="tenantType"]').value === 'corporate'
          ? co.value.trim()
          : n || 'the current tenant';
      })
      .filter(Boolean);
    box.querySelectorAll('.tncard').forEach(function (cd) {
      cd.open = false;
    });
    box.insertAdjacentHTML(
      'afterbegin',
      tnCard({ id: 't' + uid(), status: 'current', people: [{}] }, true, oth.join(' and '))
    );
    var fs0 = $('#tnFs');
    if (fs0 && fs0.classList.contains('col-closed')) {
      var cb0 = fs0.querySelector('[data-coltoggle]');
      if (cb0) cb0.click();
    }
    var f = box.querySelector('.tncard [data-tp="name"]');
    if (f) {
      f.focus();
      f.scrollIntoView({ block: 'center' });
    }
    return;
  }
  if ((b = t.closest('[data-tnsave]'))) {
    var sc = b.closest('.tncard');
    if (sc.hasAttribute('data-new')) {
      var hasNm = Array.prototype.some.call(
        sc.querySelectorAll('[data-tp="name"],[data-tf="company"]'),
        function (i) {
          return i.value.trim();
        }
      );
      if (!hasNm) {
        toast("Add the tenant's name first.");
        var nf = sc.querySelector('[data-tp="name"]');
        if (nf) nf.focus();
        return;
      }
    }
    var mv =
      sc.hasAttribute('data-new') &&
      sc.querySelector('[data-tnmove]') &&
      sc.querySelector('[data-tnmove]').checked;
    tnSaveNow(mv ? 'Tenant saved. The previous tenant moved to Previous tenants.' : 'Tenant saved');
    return;
  }
  if ((b = t.closest('[data-tnedit]'))) {
    var ec = b.closest('.tncard');
    ec.open = true;
    tnLock(ec, false);
    var f1 = ec.querySelector('[data-tp="name"]');
    if (f1) f1.focus();
    return;
  }
  if ((b = t.closest('[data-tncancel]'))) {
    b.closest('.tncard').remove();
    if (!document.querySelector('#tns .tncard'))
      $('#tns').insertAdjacentHTML(
        'afterend',
        '<p class="muted" id="tnEmpty" style="margin:0 0 8px">No current tenant. Press Create tenant to add one.</p>'
      );
    updStrip();
    return;
  }
  if ((b = t.closest('[data-tnaddd]'))) {
    var cdd = b.closest('.tncard'),
      bx = cdd.querySelector('.tndirs');
    if (bx.querySelectorAll('.tnd').length < 4) {
      bx.insertAdjacentHTML('beforeend', tnDir(''));
      var li = bx.querySelectorAll('[data-td]');
      li[li.length - 1].focus();
    }
    tnCoSync(cdd);
    return;
  }
  if ((b = t.closest('[data-tnrmd]'))) {
    var cdr = b.closest('.tncard'),
      bx2 = cdr.querySelector('.tndirs');
    if (bx2.querySelectorAll('.tnd').length > 1) b.closest('.tnd').remove();
    else b.closest('.tnd').querySelector('input').value = '';
    tnCoSync(cdr);
    return;
  }
  if ((b = t.closest('[data-tnaddp]'))) {
    var cd = b.closest('.tncard');
    cd.querySelector('.tnpeople').insertAdjacentHTML('beforeend', tnPerson({}));
    return;
  }
  if ((b = t.closest('[data-tnrmp]'))) {
    var pp = b.closest('.tnpeople');
    if (pp.querySelectorAll('.tnp').length > 1) b.closest('.tnp').remove();
    else
      b.closest('.tnp')
        .querySelectorAll('input')
        .forEach(function (i) {
          i.value = '';
        });
    return;
  }
  if ((b = t.closest('[data-tnrm]'))) {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Press again to delete';
      setTimeout(function () {
        if (b.isConnected && b.classList.contains('armed')) {
          b.classList.remove('armed');
          b.textContent = 'Delete tenant';
        }
      }, 5000);
      return;
    }
    b.closest('.tncard').remove();
    tnSaveNow('Tenant deleted');
    return;
  }
  if ((b = t.closest('[data-tnag]'))) {
    e.preventDefault();
    if (!openId) {
      toast('Add the property address first. The property saves itself, then try again.');
      return;
    }
    var tid = b.getAttribute('data-tnag'),
      data = collectForm();
    patch(openId, data);
    lastAuto = JSON.stringify(data);
    setTimeout(function () {
      taOpen(openId, tid);
    }, 60);
    return;
  }
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || !t.closest || !t.closest('.tncard')) return;
  var card = t.closest('.tncard');
  if (t.hasAttribute('data-tf')) {
    var k = t.getAttribute('data-tf');
    if (t.hasAttribute('data-tfrom')) {
      if (t.value) t.setAttribute('data-auto', '0');
      else {
        t.setAttribute('data-auto', '1');
        var src = card.querySelector('[data-tf="' + t.getAttribute('data-tfrom') + '"]'),
          af = T.tByKey[k];
        t.value = src && src.value ? autoDate(src.value, af.auto) : '';
      }
    }
    card.querySelectorAll('[data-tfrom="' + k + '"]').forEach(function (dep) {
      if (dep.getAttribute('data-auto') !== '1') return;
      var f = T.tByKey[dep.getAttribute('data-tf')];
      dep.value = t.value && /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? autoDate(t.value, f.auto) : '';
    });
  }
  if (t.getAttribute('data-tp') === 'phone') {
    var pl = t.parentNode.querySelector('.pl');
    if (pl) pl.innerHTML = plinks(t.value);
  }
  if (t.getAttribute('data-tp') === 'email') {
    var el = t.parentNode.querySelector('.el');
    if (el) el.innerHTML = elinks(t.value);
  }
  updStrip();
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t && t.closest && t.closest('.tncard')) updStrip();
});
document.addEventListener('click', function (e) {
  var g = e.target && e.target.closest && e.target.closest('[data-rltog]');
  if (!g) return;
  var row = g.closest('.rlrow'),
    open = row.classList.toggle('rlc') === false;
  g.setAttribute('aria-expanded', String(open));
  g.querySelector('.rlx').textContent = open ? 'Hide' : 'Details';
});
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest && e.target.closest('[data-rlmore]');
  if (!b) return;
  var bx = b.closest('.rlrows');
  if (bx)
    bx.querySelectorAll('.rlold').forEach(function (r) {
      r.hidden = false;
    });
  b.remove();
});
