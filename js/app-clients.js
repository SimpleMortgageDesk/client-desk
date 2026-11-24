'use strict';
/* MySimpleDesk app: Clients and appointments.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- clients: one line per person, with all their records ---------- */
function plural(n, w) {
  return n + ' ' + w + (n === 1 ? '' : 's');
}
function CL() {
  return T.person[1] === 'Applicants' ? 'Clients' : T.person[1];
}
var clQuery = '',
  clOpen = {},
  clSort = 'name';
function clKey(a) {
  var nm = String(a.name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '),
    ph = String(a.phone || '')
      .replace(/\D/g, '')
      .slice(-10),
    em = String(a.email || '')
      .trim()
      .toLowerCase();
  return nm + '|' + (ph || em);
}
function clPeople() {
  var map = {};
  cases.forEach(function (c) {
    (c.applicants || []).forEach(function (a) {
      if (!String(a.name || '').trim()) return;
      var k = clKey(a),
        p = map[k];
      if (!p) p = map[k] = { key: k, name: a.name.trim(), phone: '', email: '', address: '', recs: [] };
      if (!p.phone && a.phone) p.phone = a.phone;
      if (!p.email && a.email) p.email = a.email;
      if (!p.address && a.address) p.address = a.address;
      if (p.recs.indexOf(c) < 0) p.recs.push(c);
    });
  });
  return Object.keys(map).map(function (k) {
    var p = map[k];
    p.recs.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    p.live = p.recs.filter(function (c) {
      return c.stage !== 'lost' && stageOf(c) !== T.doneStage;
    }).length;
    p.value = p.recs.reduce(function (s, c) {
      return s + (+fv(c, T.value.k) || 0);
    }, 0);
    p.next = p.recs.map(reviewOf).filter(Boolean).sort()[0] || '';
    p.last = p.recs[0] ? p.recs[0].updatedAt || 0 : 0;
    p.cno = p.recs
      .map(function (c) {
        return c.clientNo;
      })
      .filter(Boolean)
      .join(', ');
    var t = iso(TODAY);
    p.appts = appts.filter(function (x) {
      return (
        (x.status || 'booked') === 'booked' &&
        x.date >= t &&
        p.recs.some(function (c) {
          return c.id === x.caseId;
        })
      );
    }).length;
    return p;
  });
}
function clShell() {
  return (
    '<div class="pagehead"><h1>' +
    esc(CL()) +
    '</h1><span class="muted" id="clCount"></span></div>' +
    '<div class="filters"><input type="search" id="clQ" class="search" style="flex:1;min-width:200px" placeholder="Search by name, phone, email or address" aria-label="Search ' +
    esc(CL().toLowerCase()) +
    '" value="' +
    esc(clQuery) +
    '"> <select id="clSort" aria-label="Sort"><option value="name"' +
    (clSort === 'name' ? ' selected' : '') +
    '>Sort: name A–Z</option><option value="recent"' +
    (clSort === 'recent' ? ' selected' : '') +
    '>Sort: recently updated</option><option value="next"' +
    (clSort === 'next' ? ' selected' : '') +
    '>Sort: next key date</option><option value="value"' +
    (clSort === 'value' ? ' selected' : '') +
    '>Sort: highest value</option></select></div><div id="clList"></div>'
  );
}
function clRender() {
  var box = $('#clList');
  if (!box) return;
  var all = clPeople(),
    q = clQuery.trim().toLowerCase();
  var l = all.filter(function (p) {
    return !q || [p.name, p.phone, p.email, p.address, p.cno].join(' ').toLowerCase().indexOf(q) > -1;
  });
  l.sort(function (a, b) {
    if (clSort === 'recent') return b.last - a.last;
    if (clSort === 'value') return b.value - a.value || a.name.localeCompare(b.name);
    if (clSort === 'next') {
      if (!a.next && b.next) return 1;
      if (a.next && !b.next) return -1;
      return a.next < b.next ? -1 : a.next > b.next ? 1 : a.name.localeCompare(b.name);
    }
    return (
      firstName({ applicants: [{ name: a.name }] }).localeCompare(
        firstName({ applicants: [{ name: b.name }] })
      ) || a.name.localeCompare(b.name)
    );
  });
  var ct = $('#clCount');
  if (ct)
    ct.textContent =
      (l.length === all.length ? all.length : l.length + ' of ' + all.length) + ' ' + CL().toLowerCase();
  if (!all.length) {
    box.innerHTML =
      '<div class="empty"><h2>No ' +
      esc(CL().toLowerCase()) +
      ' yet</h2>Everyone you add to a ' +
      esc(N1()) +
      ' appears here, with all their ' +
      esc(NS()) +
      ' together.<br><button class="btn" data-act="new">Add your first ' +
      esc(T.person[0].toLowerCase()) +
      '</button></div>';
    return;
  }
  if (!l.length) {
    box.innerHTML = '<div class="muted" style="margin-top:12px">Nobody matches.</div>';
    return;
  }
  box.innerHTML =
    '<div class="tw" tabindex="0" role="region" aria-label="Table: scroll sideways to see more"><table class="cltab"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>' +
    esc(T.noun[1]) +
    '</th><th>' +
    esc(T.value.l.replace(/ in progress$/i, '')) +
    '</th><th>Next key date</th><th>Last updated</th></tr></thead><tbody>' +
    l
      .map(function (p) {
        var open = !!clOpen[p.key],
          wa = plinks(p.phone);
        var h =
          '<tr class="click' +
          (open ? ' clon' : '') +
          '" data-clrow="' +
          esc(p.key) +
          '"><td><b>' +
          esc(p.name) +
          '</b>' +
          (p.cno ? ' <span class="cno">' + esc(p.cno) + '</span>' : '') +
          (p.address ? '<div class="muted" style="font-size:12px">' + esc(short(p.address)) + '</div>' : '') +
          '</td>' +
          '<td class="num">' +
          esc(p.phone || '') +
          (wa ? '<div class="pl">' + wa + '</div>' : '') +
          '</td><td>' +
          esc(p.email || '') +
          (p.email ? '<div class="pl">' + elinks(p.email) + '</div>' : '') +
          '</td>' +
          '<td>' +
          p.recs.length +
          (p.live ? ' <span class="muted" style="font-size:12px">(' + p.live + ' live)</span>' : '') +
          '</td><td class="num">' +
          (p.value ? money(p.value) : '—') +
          '</td>' +
          '<td>' +
          (p.next
            ? '<span class="chip ' + tone(p.next) + '">' + fd(p.next) + '</span>'
            : '<span class="muted">—</span>') +
          '</td><td class="muted" style="font-size:12px">' +
          (p.last ? shortStamp(p.last) : '') +
          '</td></tr>';
        if (open)
          h +=
            '<tr class="cldet"><td colspan="7"><div class="clbox">' +
            '<div class="add" style="margin:0 0 8px"><button type="button" class="btn sm" data-clnew="' +
            esc(p.recs[0].id) +
            '">New ' +
            esc(N1()) +
            ' for this ' +
            esc(CL() === 'Clients' ? 'client' : T.person[0].toLowerCase()) +
            '</button><button type="button" class="btn ghost sm" data-clbook="' +
            esc(p.recs[0].id) +
            '">Book appointment</button>' +
            (p.appts
              ? '<span class="muted" style="align-self:center;font-size:12px">' +
                p.appts +
                ' appointment' +
                (p.appts === 1 ? '' : 's') +
                ' booked</span>'
              : '') +
            '</div>' +
            p.recs
              .map(function (c) {
                var v = fv(c, T.value.k),
                  rv = reviewOf(c),
                  ad = short(fv(c, T.addr));
                return (
                  '<button type="button" class="clrec" data-open="' +
                  c.id +
                  '"><b>' +
                  esc(c.type || T.noun[0]) +
                  '</b>' +
                  (c.clientNo ? ' <span class="cno">' + esc(c.clientNo) + '</span>' : '') +
                  ' <span class="chip">' +
                  esc(c.stage === 'lost' ? 'Closed lost' : STAGE_LABEL[stageOf(c)] || '') +
                  '</span>' +
                  (ad ? '<span class="muted"> · ' + esc(ad) + '</span>' : '') +
                  (v !== '' ? '<span class="num"> · ' + money(v) + '</span>' : '') +
                  (rv
                    ? ' <span class="chip ' + tone(rv) + '">' + esc(T.reviewWord) + ' ' + fd(rv) + '</span>'
                    : '') +
                  '<span class="muted" style="margin-left:auto;font-size:12px">' +
                  plural(
                    (c.tasks || []).filter(function (t) {
                      return !t.done;
                    }).length,
                    'open task'
                  ) +
                  ' · ' +
                  plural((c.notes || []).length, 'note') +
                  '</span></button>'
                );
              })
              .join('') +
            '</div></td></tr>';
        return h;
      })
      .join('') +
    '</tbody></table></div>';
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('a')) return;
  var b = t.closest('[data-clnew]');
  if (b) {
    var src = cases.filter(function (x) {
      return x.id === b.getAttribute('data-clnew');
    })[0];
    if (src) startFrom(src);
    return;
  }
  b = t.closest('[data-clbook]');
  if (b) {
    apOpen(null, iso(TODAY), b.getAttribute('data-clbook'));
    return;
  }
  b = t.closest('[data-clrow]');
  if (b) {
    var k = b.getAttribute('data-clrow');
    clOpen[k] = !clOpen[k];
    clRender();
  }
});
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'clSort') {
    clSort = e.target.value;
    clRender();
  }
});
function pickClient() {
  var list = cases.slice().sort(function (a, b) {
    return names(a).toLowerCase() < names(b).toLowerCase() ? -1 : 1;
  });
  if (!list.length) return '';
  return (
    '<label class="f" style="margin-bottom:12px">Start from an existing client (copies their details)<select id="fromClient"><option value="">Choose a client, or leave blank for a new one</option>' +
    list
      .map(function (x) {
        return (
          '<option value="' +
          esc(x.id) +
          '">' +
          esc(names(x) + (x.clientNo ? ' (' + x.clientNo + ')' : '')) +
          '</option>'
        );
      })
      .join('') +
    '</select></label>'
  );
}
function startFrom(src) {
  var ap = JSON.parse(JSON.stringify(src.applicants && src.applicants.length ? src.applicants : [{}]));
  var d = {
    stage: T.defaultStage,
    type: T.types[0],
    applicants: ap,
    oneDriveLink: src.oneDriveLink || '',
    _from: src.id,
    notes: [
      {
        ts: Date.now(),
        text:
          'New ' +
          N1() +
          ' for an existing client: ' +
          names(src) +
          (src.clientNo ? ' (see ' + src.clientNo + ')' : '') +
          '.'
      }
    ]
  };
  if (T.id === 'mortgage') d.repayment = 'repayment';
  closeDrawer();
  openDrawer(null, d);
}
/* ---------- mortgage adviser: Applying as (a person or a limited company) ---------- */
function relabelDirs() {
  var f = document.getElementById('f-borrowerType');
  if (!f) return;
  dirMode = f.value === 'spv';
  var lg = document.getElementById('dirLegend');
  if (lg) lg.textContent = dirMode ? 'Directors and residential address' : T.peopleTitle;
  var ad = document.getElementById('addApp');
  if (ad) ad.textContent = 'Add ' + (dirMode ? 'director' : T.person[0].toLowerCase());
  document.querySelectorAll('#apps .app .top2 span').forEach(function (s, i) {
    s.textContent = (dirMode ? 'Director ' : T.person[0] + ' ') + (i + 1);
  });
}
function borrowerFs(c) {
  var spv = isSpv(c);
  dirMode = spv;
  return (
    '<fieldset data-nocol="1"><legend>Applying as</legend><div class="grid"><div class="f wide"><span>Borrower</span>' +
    '<div class="btabs" role="tablist" aria-label="Applying as">' +
    '<button type="button" role="tab" class="btab pers" data-btab="personal" aria-selected="' +
    !spv +
    '">Personal name</button>' +
    '<button type="button" role="tab" class="btab spvt" data-btab="spv" aria-selected="' +
    spv +
    '">Limited company (SPV)</button></div>' +
    '<span style="display:none">' +
    sel('borrowerType', 'Borrower', spv ? 'spv' : 'personal', [
      ['personal', 'Personal name'],
      ['spv', 'Limited company (SPV)']
    ]) +
    '</span></div><span class="spvf" style="display:contents"' +
    (spv ? '' : ' hidden') +
    '>' +
    fld('companyName', 'Company name', c.companyName) +
    fld('companyNumber', 'Company number', c.companyNumber) +
    '</span></div></fieldset>'
  );
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-btab]');
  if (!b) return;
  var s = document.getElementById('f-borrowerType');
  if (!s) return;
  s.value = b.getAttribute('data-btab');
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
document.addEventListener('change', function (e) {
  var x = e.target;
  if (!x || x.id !== 'f-borrowerType') return;
  document.querySelectorAll('[data-btab]').forEach(function (b) {
    b.setAttribute('aria-selected', String(b.getAttribute('data-btab') === x.value));
  });
  relabelDirs();
  document.querySelectorAll('#caseForm .spvf').forEach(function (z) {
    z.hidden = x.value !== 'spv';
  });
});
function openDrawer(id, draft) {
  openId = id;
  ntDraft = '';
  notesAll = false;
  prDraft = '';
  protAll = false;
  editNote = null;
  editTk = null;
  ntTable = null;
  prTable = null;
  noteSug = null;
  pendingNotes = (draft && draft.notes) || [];
  var c = id
    ? cases.filter(function (x) {
        return x.id === id;
      })[0]
    : null;
  if (id && !c) {
    openId = undefined;
    return;
  }
  c =
    c ||
    Object.assign(
      { stage: T.defaultStage, type: T.types[0], applicants: [{}] },
      T.id === 'mortgage' ? { repayment: 'repayment' } : {},
      draft || {}
    );
  if (!id) colOpen[(T.sections[0].title || '').toLowerCase()] = true;
  var d = $('#drawer');
  d.hidden = false;
  d.innerHTML =
    '<div class="bk" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-label="' +
    esc(T.noun[0]) +
    '">' +
    '<div class="dh"><div style="min-width:0"><button type="button" class="btn backbtn" id="backBtn">&larr; Back</button><div class="eyebrow">' +
    (id
      ? esc(T.noun[0])
      : draft && draft._from
        ? 'New ' + N1() + ' for an existing client. Add the details, then it saves automatically'
        : 'New ' + N1()) +
    '</div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 id="dTitle" style="margin:0">' +
    esc(id ? names(c) : T.tenancyMode ? 'Add a property' : 'Add a client') +
    '</h2></div>' +
    (id
      ? '<div id="nextAppt" class="muted" style="font-size:12px;margin-top:4px">' + apNextHtml(id) + '</div>'
      : '') +
    (id && c.oneDriveLink
      ? '<div class="pl" style="margin-top:4px">' + odLink(c.oneDriveLink) + '</div>'
      : '') +
    stripHtml(c) +
    (T.tenancyMode && id ? '<div id="rentHead"></div>' : '') +
    '</div>' +
    '<div class="dhb" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center;flex:none">' +
    (id
      ? T.tenancyMode
        ? '<button type="button" class="btn ghost" id="repBtn">Repairs</button><button type="button" class="btn" id="expBtn">Receipts and expenses</button>'
        : (T.jobDocs && !T.noExp
            ? '<button type="button" class="btn ghost" id="expBtn">Receipts and expenses</button>'
            : '') +
          (T.id === 'mortgage'
            ? '<button type="button" class="btn ghost" id="docBtn" title="Read a lender document (decision in principle or mortgage offer) on this device">Read a document</button>'
            : '') +
          (T.id === 'mortgage' &&
          pfGroups().some(function (g) {
            return g.k === clientKey(c);
          })
            ? '<button type="button" class="btn ghost" id="pfBtn" title="Fill in the Personal Portfolio Summary from this client\'s buy to let cases">Portfolio summary</button>'
            : '') +
          '<button type="button" class="btn" id="bookBtn">Book appointment</button>'
      : '') +
    (id && !T.tenancyMode && N1() !== 'client'
      ? '<button type="button" class="btn" id="dupBtn" title="Same client, another ' +
        esc(N1()) +
        '">New ' +
        esc(N1()) +
        ' for this client</button>'
      : '') +
    '<button type="button" class="btn" id="saveCloseBtn">Done</button></div></div>' +
    '<form id="caseForm" class="db" autocomplete="off">' +
    (T.tenancyMode
      ? llBody(c)
      : (!id && !draft ? pickClient() : '') +
        (T.id === 'mortgage' ? borrowerFs(c) : '') +
        '<fieldset id="peopleFs"><legend id="dirLegend">' +
        esc(T.id === 'mortgage' && isSpv(c) ? 'Directors and residential address' : T.peopleTitle) +
        '</legend><div class="appsplit"><div class="appleft"><div id="apps">' +
        (c.applicants && c.applicants.length ? c.applicants : [{}]).map(appRow).join('') +
        '</div><button type="button" class="btn ghost sm" id="addApp">Add ' +
        esc(T.id === 'mortgage' && isSpv(c) ? 'director' : T.person[0].toLowerCase()) +
        '</button><div class="grid" style="margin-top:10px">' +
        fld('clientNo', 'Client number', c.clientNo) +
        '</div></div><aside class="lkpane"><div class="lkt" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span id="lkTitle">Connected clients (0)</span><button type="button" class="btn ghost sm secbtn" id="lkToggle">Show</button></div><div id="linksBox" style="display:none"></div></aside></div></fieldset>' +
        (T.securities
          ? '<fieldset class="secfs"><legend>Security addresses (buy to let and other properties)</legend><p class="muted" style="font-size:12px;margin:0 0 8px">Add the address of each property the mortgage is secured on.</p><div id="secs">' +
            (c.securities || []).map(secRow).join('') +
            '</div><button type="button" class="btn ghost sm" id="addSec">Add security address</button></fieldset>'
          : '') +
        sectionsHtml(c)) +
    '<div id="liveNotes"></div>' +
    '<div id="live"></div>' +
    (T.tenancyMode
      ? ''
      : T.jobDocs
        ? dzSide(c)
        : '<fieldset class="odfs"><legend>OneDrive folder</legend><label class="f">OneDrive folder link<input id="f-oneDriveLink" data-f="oneDriveLink" type="url" placeholder="Paste the OneDrive folder link for this client" value="' +
          esc(c.oneDriveLink) +
          '"><span class="pl" id="odl">' +
          odLink(c.oneDriveLink) +
          '</span></label></fieldset>') +
    '</form>' +
    '<div class="df"><div>' +
    (id ? '<button type="button" class="btn danger" id="delBtn">Delete ' + esc(N1()) + '</button>' : '') +
    '</div><span class="muted" id="autoMsg" role="status" style="font-size:12.5px">' +
    (id
      ? '&#10003; Saved. Changes save by themselves.'
      : 'Saves by itself once the ' + (T.tenancyMode ? 'address' : 'name') + ' is in.') +
    '</span></div></div>';
  colOpen = {};
  if (T.tenancyMode) {
    if (!id) colOpen[(T.sections[0].title || '').toLowerCase()] = 1;
    colOpen['property documents'] = true;
  } else if (!id) colOpen[(T.sections[0].title || '').toLowerCase()] = true;
  lkOpen = false;
  curLinks = ((c && c.links) || []).map(function (l) {
    return { id: l.id, cid: l.cid, rel: l.rel };
  });
  renderLive();
  renderLinks();
  var first = $('#drawer [data-a="name"]');
  if (first && !id) first.focus();
  ntDraft = (id && c.noteDraft) || '';
  prDraft = (id && c.protDraft) || '';
  lastND = ntDraft;
  lastPD = prDraft;
  renderLive();
  if (T.tenancyMode && id) rhRender();
  if (T.tenancyMode) {
    mcRender();
    tnLockAll();
    rpBtnSet();
  }
  lastAuto = id ? JSON.stringify(collectForm()) : null;
  newBase = id ? null : JSON.stringify(collectForm());
}
function closeDrawer() {
  editNote = null;
  editTk = null;
  var d = $('#drawer');
  d.hidden = true;
  d.innerHTML = '';
  openId = undefined;
  lastAuto = null;
  newBase = null;
  ntTable = null;
  prTable = null;
}
function currentCase() {
  return openId
    ? cases.filter(function (x) {
        return x.id === openId;
      })[0]
    : null;
}

/* ---------- appointments ---------- */
var apCol = null,
  appts = [],
  apMonth = { y: TODAY.getFullYear(), m: TODAY.getMonth() },
  apSel = iso(TODAY),
  apEditId = null,
  apClash = false;
var AP_MODES = ['Phone', 'Video call', 'In person', 'Office'];
var AP_DURS = [15, 30, 45, 60, 90, 120];
var AP_STATUS = { booked: 'Booked', done: 'Done', cancelled: 'Cancelled', noshow: 'No show' };
function apMin(t) {
  var m = /^(\d\d):(\d\d)$/.exec(t || '');
  return m ? +m[1] * 60 + +m[2] : 0;
}
function apHM(n) {
  n = ((n % 1440) + 1440) % 1440;
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}
function apSorted(l) {
  return l.slice().sort(function (a, b) {
    return a.date + ' ' + (a.time || '') < b.date + ' ' + (b.time || '')
      ? -1
      : a.date + ' ' + (a.time || '') > b.date + ' ' + (b.time || '')
        ? 1
        : 0;
  });
}
function apCase(a) {
  return a.caseId
    ? cases.filter(function (x) {
        return x.id === a.caseId;
      })[0]
    : null;
}
function apWho(a) {
  var c = apCase(a);
  return c ? names(c) : a.who || 'Unnamed';
}
function apWhoHtml(a) {
  var c = apCase(a);
  return c
    ? '<button type="button" class="lnk" data-open="' + c.id + '">' + esc(names(c)) + cno(c) + '</button>'
    : esc(a.who || 'Unnamed') + ' <span class="apst">not yet a case</span>';
}
function apLabel(c) {
  return c.clientNo ? c.clientNo + ' · ' + names(c) : names(c);
}
function apFindCase(v) {
  v = String(v || '').trim();
  if (!v) return null;
  var no = v.split(' · ')[0].trim().toUpperCase(),
    c = no
      ? cases.filter(function (x) {
          return (x.clientNo || '').toUpperCase() === no;
        })[0]
      : null;
  if (c) return c;
  var nm = v
    .replace(/^.* · /, '')
    .trim()
    .toLowerCase();
  return (
    cases.filter(function (x) {
      return names(x).toLowerCase() === nm;
    })[0] || null
  );
}
function apTodayN() {
  var t = iso(TODAY);
  return appts.filter(function (a) {
    return a.date === t && a.status !== 'cancelled' && a.status !== 'done' && a.status !== 'noshow';
  }).length;
}
function apCard(a, showDate) {
  var st = a.status || 'booked',
    end = apHM(apMin(a.time) + (+a.dur || 30)),
    mg = T.id === 'mortgage',
    past =
      mg &&
      st === 'booked' &&
      (a.date < iso(TODAY) ||
        (a.date === iso(TODAY) &&
          apMin(a.time) + (+a.dur || 30) < new Date().getHours() * 60 + new Date().getMinutes()));
  var dl = showDate
    ? '<span class="muted" style="font-size:12px">' +
      new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }) +
      ' · </span>'
    : '';
  var meta = [a.type, a.mode, a.where].filter(Boolean).map(esc).join(' · ');
  return (
    '<div class="apc st-' +
    st +
    '"><div class="aptm"' +
    (mg ? ' data-apdrag="' + a.id + '" title="Drag onto a day in the calendar to move it"' : '') +
    '><b>' +
    esc(a.time || '') +
    '</b>to ' +
    end +
    '</div><div class="apbody"><div class="apwho">' +
    dl +
    apWhoHtml(a) +
    (st !== 'booked' ? '<span class="apst">' + AP_STATUS[st] + '</span>' : '') +
    (past ? '<span class="apst late">Past, still marked Booked</span>' : '') +
    '</div>' +
    (meta ? '<div class="muted" style="font-size:12px">' + meta + '</div>' : '') +
    (a.notes
      ? '<div style="font-size:13px;margin-top:3px;white-space:pre-wrap">' +
        esc(String(a.notes).slice(0, 220)) +
        '</div>'
      : '') +
    '</div><div class="apact">' +
    (mg && st === 'booked'
      ? '<button type="button" class="btn ghost sm" data-apwa="' +
        a.id +
        '" title="Send the client a WhatsApp reminder">WhatsApp</button>'
      : '') +
    '<button type="button" class="btn ghost sm" data-apedit="' +
    a.id +
    '">Edit</button><button type="button" class="btn ghost sm" data-apdone="' +
    a.id +
    '">' +
    (st === 'done' ? 'Reopen' : 'Mark done') +
    '</button>' +
    (past
      ? '<button type="button" class="btn ghost sm" data-apmiss="' +
        a.id +
        '">Missed</button>' +
        (a.caseId ? '<button type="button" class="btn sm" data-aprebook="' + a.id + '">Rebook</button>' : '')
      : mg && st === 'noshow' && a.caseId
        ? '<button type="button" class="btn sm" data-aprebook="' + a.id + '">Rebook</button>'
        : '') +
    '</div></div>'
  );
}
function apHTML(home) {
  var y = apMonth.y,
    mo = apMonth.m,
    first = new Date(y, mo, 1),
    off = (first.getDay() + 6) % 7,
    tIso = iso(TODAY),
    wkS = addDays(tIso, -((TODAY.getDay() + 6) % 7)),
    wkE = addDays(wkS, 6);
  var by = {};
  appts.forEach(function (a) {
    if (a.status === 'cancelled') return;
    (by[a.date] = by[a.date] || []).push(a);
  });
  var nowMin0 = new Date().getHours() * 60 + new Date().getMinutes();
  var upAll = apSorted(
    appts.filter(function (a) {
      return (
        (a.status || 'booked') === 'booked' &&
        (a.date > tIso || (a.date === tIso && apMin(a.time) + (+a.dur || 30) >= nowMin0))
      );
    })
  );
  var upTop =
    '<section class="apup" aria-label="Coming up"><div class="aphead"><h2 style="font-size:16px">Coming up</h2><span class="muted" style="font-size:12.5px">' +
    upAll.length +
    ' appointment' +
    (upAll.length === 1 ? '' : 's') +
    '</span></div>' +
    (upAll.length
      ? '<div class="apupl">' +
        upAll
          .slice(0, 12)
          .map(function (a) {
            return apCard(a, true);
          })
          .join('') +
        '</div>' +
        (upAll.length > 12
          ? '<div class="muted" style="margin-top:6px;font-size:12.5px">+ ' +
            (upAll.length - 12) +
            ' more. Pick a day on the calendar to see them.</div>'
          : '')
      : '<div class="muted">No upcoming appointments.</div>') +
    '</section>';
  var h =
    (home
      ? ''
      : '<div class="pagehead"><h1>Appointments</h1><span class="muted">Book and track client appointments</span></div>') +
    upTop +
    '<div class="apwrap"><div>';
  h +=
    '<div class="aphead"><h2>' +
    first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) +
    '</h2><button type="button" class="btn ghost sm" data-apmonth="-1" aria-label="Previous month">‹ Prev</button><button type="button" class="btn ghost sm" data-apmonth="0">Today</button><button type="button" class="btn ghost sm" data-apmonth="1" aria-label="Next month">Next ›</button><button type="button" class="btn" data-apnew="1" style="margin-left:auto">Book appointment</button></div>';
  if (home && (T.tenancyMode || T.calTab)) {
    var wl = apSorted(
      appts.filter(function (a) {
        return a.date >= wkS && a.date <= wkE && (a.status || 'booked') !== 'cancelled';
      })
    );
    h +=
      '<div class="wkbar"><b>This week</b><span class="wkn">' +
      wl.length +
      ' appointment' +
      (wl.length === 1 ? '' : 's') +
      '</span>' +
      (wl.length
        ? wl
            .map(function (a) {
              return (
                '<button type="button" class="wkchip" data-apday="' +
                a.date +
                '">' +
                new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric'
                }) +
                ' · ' +
                esc(a.time) +
                ' ' +
                esc(apWho(a)) +
                '</button>'
              );
            })
            .join('')
        : '<span class="wkn">Nothing booked this week.</span>') +
      '</div>';
  }
  h +=
    '<div class="apgrid">' +
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map(function (d) {
        return '<div class="apdow">' + d + '</div>';
      })
      .join('');
  for (var i = 0; i < 42; i++) {
    var d = new Date(y, mo, 1 - off + i),
      di = iso(d),
      l = apSorted(by[di] || []),
      inWk = di >= wkS && di <= wkE;
    h +=
      '<button type="button" class="apcell' +
      (inWk ? ' wk' : '') +
      (d.getMonth() !== mo ? ' out' : '') +
      (di === tIso ? ' today' : '') +
      (di === apSel ? ' sel' : '') +
      '" data-apday="' +
      di +
      '" aria-label="' +
      di +
      (l.length ? ', ' + l.length + ' appointments' : '') +
      '"><span class="apn">' +
      d.getDate() +
      '</span>' +
      l
        .slice(0, 3)
        .map(function (a) {
          var late = T.id === 'mortgage' && (a.status || 'booked') === 'booked' && di < tIso;
          return (
            '<span class="apchip' +
            (a.status === 'done' ? ' done' : '') +
            (T.id === 'mortgage' && a.status === 'noshow' ? ' miss' : '') +
            (late ? ' late' : '') +
            '">' +
            esc(a.time) +
            ' ' +
            esc(apWho(a)) +
            '</span>'
          );
        })
        .join('') +
      (l.length > 3 ? '<span class="apmore">+' + (l.length - 3) + ' more</span>' : '') +
      (l.length
        ? '<span class="apdots">' +
          l
            .slice(0, 6)
            .map(function () {
              return '<span class="apdot"></span>';
            })
            .join('') +
          '</span>'
        : '') +
      '</button>';
  }
  h += '</div></div><div>';
  var day = apSorted(
    appts.filter(function (a) {
      return a.date === apSel;
    })
  );
  h +=
    '<div class="aphead"><h2>' +
    new Date(apSel + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }) +
    '</h2><button type="button" class="btn ghost sm" data-apnew="1">Book on this day</button></div>';
  h += day.length
    ? day
        .map(function (a) {
          return apCard(a, false);
        })
        .join('')
    : '<div class="muted" style="margin-bottom:10px">Nothing booked on this day.</div>';
  return h + '</div></div>';
}
function apHome() {
  if (homeMonth)
    return (
      '<div class="aphead" style="margin-bottom:6px"><h2 style="font-size:' +
      (T.tenancyMode || T.calTab ? '20' : '15') +
      'px">' +
      (T.id === 'mortgage' ? 'Month view' : 'Calendar') +
      '</h2><button type="button" class="btn ghost sm" data-hmtog="0">' +
      (T.id === 'mortgage' ? 'Back to agenda' : 'List view') +
      '</button></div>' +
      apHTML(true)
    );
  var tI = iso(TODAY),
    h =
      '<div class="aphead"><h2>Today and next 7 days</h2><button type="button" class="btn ghost sm" data-hmtog="1">' +
      (T.id === 'mortgage' ? 'Month view' : 'Calendar view') +
      '</button><button type="button" class="btn" data-apnew="1" style="margin-left:auto">Book appointment</button></div>',
    any = 0;
  for (var i = 0; i < 8; i++) {
    var di = addDays(tI, i),
      l = apSorted(
        appts.filter(function (a) {
          return a.date === di && (a.status || 'booked') !== 'cancelled';
        })
      );
    if (!l.length && i > 0) continue;
    any += l.length;
    var sec =
      '<div class="agd"><b>' +
      (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : '') +
      (i < 2 ? ' · ' : '') +
      new Date(di + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }) +
      '</b><span class="muted"> · ' +
      l.length +
      ' appointment' +
      (l.length === 1 ? '' : 's') +
      '</span></div>' +
      (l.length
        ? l
            .map(function (a) {
              return apCard(a, false);
            })
            .join('')
        : '<div class="muted" style="margin:0 0 8px">Nothing booked today.</div>');
    h += i === 0 && T.id === 'mortgage' ? '<div class="agtoday">' + sec + '</div>' : sec;
  }
  if (!any) h += '<div class="muted" style="margin-top:6px">No appointments in the next 7 days.</div>';
  return h;
}
function apNextHtml(cid) {
  var nowMin = new Date().getHours() * 60 + new Date().getMinutes(),
    t = iso(TODAY);
  var up = apSorted(
    appts.filter(function (a) {
      return (
        a.caseId === cid &&
        (a.status || 'booked') === 'booked' &&
        (a.date > t || (a.date === t && apMin(a.time) + (+a.dur || 30) >= nowMin))
      );
    })
  );
  if (!up.length) return '';
  var a = up[0];
  return (
    'Next appointment: <b>' +
    new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }) +
    ', ' +
    esc(a.time) +
    '</b>' +
    (a.mode ? ' · ' + esc(a.mode) : '') +
    (up.length > 1 ? ' · +' + (up.length - 1) + ' more' : '')
  );
}
function apClose() {
  var o = $('#apOv');
  if (o) o.remove();
  apEditId = null;
  apClash = false;
  apDpM = null;
}
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'apDur') {
    apClash = false;
    apDpRender();
  }
});
var apDpM = null;
function apT(m) {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function apDpRender() {
  var box = $('#apDp');
  if (!box) return;
  var oldSl = $('#apSl'),
    keep = oldSl ? oldSl.scrollTop : null;
  var dv = $('#apDate').value || iso(TODAY),
    tv = $('#apTime').value || '10:00',
    dur = +($('#apDur') || {}).value || 30,
    pp = dv.split('-');
  if (!apDpM) apDpM = { y: +pp[0], m: +pp[1] - 1 };
  var first = new Date(apDpM.y, apDpM.m, 1),
    off = (first.getDay() + 6) % 7,
    dim = new Date(apDpM.y, apDpM.m + 1, 0).getDate(),
    tIso = iso(TODAY);
  var live = appts.filter(function (x) {
      return (x.status || 'booked') === 'booked' && x.id !== apEditId;
    }),
    cnt = {};
  live.forEach(function (x) {
    cnt[x.date] = (cnt[x.date] || 0) + 1;
  });
  var cal =
    '<div class="apdh"><button type="button" class="btn ghost sm" data-apdm="-1" aria-label="Previous month">&#8249;</button><b>' +
    first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) +
    '</b><button type="button" class="btn ghost sm" data-apdm="1" aria-label="Next month">&#8250;</button></div><div class="apdg">' +
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map(function (h) {
        return '<span class="apdw">' + h + '</span>';
      })
      .join('');
  for (var i = 0; i < off; i++) cal += '<span></span>';
  for (var d = 1; d <= dim; d++) {
    var ds = apDpM.y + '-' + String(apDpM.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    cal +=
      '<button type="button" class="apdd' +
      (ds === dv ? ' sel' : '') +
      (ds === tIso ? ' today' : '') +
      '" data-apdd="' +
      ds +
      '" aria-label="' +
      ds +
      (cnt[ds] ? ', ' + cnt[ds] + ' booked' : '') +
      '">' +
      d +
      (cnt[ds] ? '<i class="apdot"></i>' : '') +
      '</button>';
  }
  cal +=
    '</div><button type="button" class="btn ghost sm" data-apdd="' +
    tIso +
    '" style="margin-top:6px">Today</button>';
  var s0 = apMin(tv),
    lo = Math.min(7 * 60, s0),
    hi = Math.max(21 * 60 + 45, s0),
    day = live.filter(function (x) {
      return x.date === dv;
    });
  var sl = '';
  for (var m = lo; m <= hi; m += 15) {
    var busy = day.filter(function (x) {
      return apMin(x.time) < m + 15 && apMin(x.time) + (+x.dur || 30) > m;
    })[0];
    sl +=
      '<button type="button" class="apts' +
      (m === s0 ? ' sel' : m > s0 && m < s0 + dur ? ' span' : '') +
      (busy ? ' busy' : '') +
      '" data-apts="' +
      apT(m) +
      '"' +
      (busy ? ' title="Already booked: ' + esc(apWho(busy)) + '"' : '') +
      '>' +
      apT(m) +
      '</button>';
  }
  var dd = new Date(+pp[0], +pp[1] - 1, +pp[2]),
    sum =
      dd.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ', ' +
      apT(s0) +
      ' to ' +
      apT(s0 + dur);
  var bk = day
    .slice()
    .sort(function (a, b) {
      return apMin(a.time) - apMin(b.time);
    })
    .map(function (x) {
      return x.time + ' ' + esc(apWho(x));
    })
    .join(' &middot; ');
  box.innerHTML =
    '<div class="apdwrap"><div class="apdcal">' +
    cal +
    '</div><div class="apdslots"><div class="apdlbl">Time (15-minute slots)</div><div class="apdsl" id="apSl">' +
    sl +
    '</div></div></div>' +
    '<div class="apdsum"><b>' +
    esc(sum) +
    '</b>' +
    (bk
      ? '<div class="muted">Already booked that day: ' + bk + '</div>'
      : '<div class="muted">Nothing else booked that day.</div>') +
    '</div>';
  var se = box.querySelector('.apts.sel'),
    sc = $('#apSl');
  if (sc) {
    if (keep != null) sc.scrollTop = keep;
    else if (se) sc.scrollTop = Math.max(0, se.offsetTop - sc.offsetTop - 60);
  }
}
function apOpen(id, date, preCase) {
  apDpM = null;
  var a = id
    ? appts.filter(function (x) {
        return x.id === id;
      })[0]
    : null;
  if (id && !a) return;
  apEditId = a ? a.id : null;
  apClash = false;
  var c = a && apCase(a),
    who = a ? (c ? apLabel(c) : a.who || '') : '';
  if (!a && preCase) {
    var pc = cases.filter(function (x) {
      return x.id === preCase;
    })[0];
    if (pc) who = apLabel(pc);
  }
  var opt = function (list, sel) {
    return list
      .map(function (v) {
        return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>';
      })
      .join('');
  };
  var o = $('#apOv');
  if (!o) {
    o = document.createElement('div');
    o.id = 'apOv';
    document.body.appendChild(o);
  }
  o.innerHTML =
    '<div class="apm" role="dialog" aria-label="Appointment"><h2>' +
    (a ? 'Edit appointment' : 'Book appointment') +
    '</h2><div class="apf">' +
    '<label class="full">Client<input type="text" id="apWho" list="apCases" value="' +
    esc(who) +
    '" placeholder="Pick a client or case number, or type a new name" autocomplete="off"></label><datalist id="apCases">' +
    cases
      .slice()
      .sort(function (x, y) {
        return cnum(x) - cnum(y);
      })
      .map(function (x) {
        return '<option value="' + esc(apLabel(x)) + '"></option>';
      })
      .join('') +
    '</datalist>' +
    '<input type="hidden" id="apDate" value="' +
    esc(a ? a.date : date || iso(TODAY)) +
    '"><input type="hidden" id="apTime" value="' +
    esc(a ? a.time : '10:00') +
    '"><div class="full apdp" id="apDp"></div>' +
    '<label>Type<select id="apType">' +
    opt(AP_TYPES, a && a.type) +
    '</select></label><label>Length<select id="apDur">' +
    AP_DURS.map(function (v) {
      return (
        '<option value="' +
        v +
        '"' +
        (v === (a ? +a.dur : 30) ? ' selected' : '') +
        '>' +
        v +
        ' minutes</option>'
      );
    }).join('') +
    '</select></label>' +
    '<label>How<select id="apMode">' +
    opt(AP_MODES, a && a.mode) +
    '</select></label><label>Where or link<input type="text" id="apWhere" value="' +
    esc((a && a.where) || '') +
    '" placeholder="Address, phone number or meeting link"></label>' +
    (a
      ? '<label class="full">Status<select id="apStatus">' +
        Object.keys(AP_STATUS)
          .map(function (k) {
            return (
              '<option value="' +
              k +
              '"' +
              (k === (a.status || 'booked') ? ' selected' : '') +
              '>' +
              AP_STATUS[k] +
              '</option>'
            );
          })
          .join('') +
        '</select></label>'
      : '') +
    '<label class="full">Notes<textarea id="apNotes" rows="3" placeholder="What to cover, documents to bring">' +
    esc((a && a.notes) || '') +
    '</textarea></label></div>' +
    '<p id="apMsg" class="muted" style="min-height:18px;margin:8px 0 0"></p><div class="add" style="margin-top:8px"><button type="button" class="btn" id="apSave">' +
    (a ? 'Save changes' : 'Book it') +
    '</button><button type="button" class="btn ghost" data-apclose="1">Cancel</button>' +
    (a ? '<button type="button" class="btn danger" id="apDel">Delete</button>' : '') +
    '</div></div>';
  apDpRender();
  setTimeout(function () {
    var w = $('#apWho');
    if (w) w.focus();
  }, 50);
}
function apSave() {
  var msg = $('#apMsg'),
    wv = $('#apWho').value.trim(),
    date = $('#apDate').value,
    time = $('#apTime').value;
  if (!wv) {
    msg.textContent = 'Choose or type who the appointment is with.';
    return;
  }
  if (!date || !time) {
    msg.textContent = 'Choose a date and a time.';
    return;
  }
  var c = apFindCase(wv),
    ex = apEditId
      ? appts.filter(function (x) {
          return x.id === apEditId;
        })[0]
      : null,
    ref = apEditId ? apCol.doc(apEditId) : apCol.doc(),
    id = ref.id;
  var d = {
    caseId: c ? c.id : '',
    who: c ? names(c) : wv,
    type: $('#apType').value,
    date: date,
    time: time,
    dur: +$('#apDur').value || 30,
    mode: $('#apMode').value,
    where: $('#apWhere').value.trim(),
    notes: $('#apNotes').value.trim(),
    status: apEditId ? $('#apStatus').value : 'booked',
    created: (ex && ex.created) || Date.now(),
    updatedAt: Date.now()
  };
  var s0 = apMin(time),
    e0 = s0 + d.dur,
    clash =
      d.status === 'booked'
        ? appts.filter(function (x) {
            return (
              x.id !== id &&
              x.date === date &&
              (x.status || 'booked') === 'booked' &&
              apMin(x.time) < e0 &&
              apMin(x.time) + (+x.dur || 30) > s0
            );
          })
        : [];
  if (clash.length && !apClash) {
    apClash = true;
    msg.textContent =
      'That overlaps with ' +
      apWho(clash[0]) +
      ' at ' +
      clash[0].time +
      '. Press the button again to book it anyway.';
    return;
  }
  write('ap-' + id, function () {
    return apEditId ? ref.update(d) : ref.set(d);
  });
  apSel = date;
  var pd = date.split('-');
  apMonth = { y: +pd[0], m: +pd[1] - 1 };
  var was = apEditId;
  apClose();
  toast(was ? 'Appointment updated' : 'Appointment booked');
  if (T.id === 'mortgage' && !was && c && d.status === 'booked' && d.date >= iso(TODAY)) {
    var wa0 = Object.assign({ id: id }, d);
    setTimeout(function () {
      waOpen(wa0, 'confirm');
    }, 350);
  }
  setTimeout(function () {
    if (view === 'appointments' || view === 'tasks') render();
    renderNav();
  }, 30);
}
