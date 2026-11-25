'use strict';
/* MySimpleDesk app: Connected clients, quick add, export, the task tray, the notebook and full backup.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- connected clients ---------- */
var curLinks = [],
  lkOpen = false;
var REL_OPTS = [
  'Spouse / partner',
  'Parent',
  'Child',
  'Grandparent',
  'Grandchild',
  'Sibling',
  'Other relative',
  'Friend',
  'Colleague',
  'Business partner',
  'Employer',
  'Employee',
  'Referred by',
  'Referred client',
  'Other'
];
var REL_INV = {
  'Spouse / partner': 'Spouse / partner',
  'Parent': 'Child',
  'Child': 'Parent',
  'Grandparent': 'Grandchild',
  'Grandchild': 'Grandparent',
  'Sibling': 'Sibling',
  'Other relative': 'Other relative',
  'Friend': 'Friend',
  'Colleague': 'Colleague',
  'Business partner': 'Business partner',
  'Employer': 'Employee',
  'Employee': 'Employer',
  'Referred by': 'Referred client',
  'Referred client': 'Referred by',
  'Other': 'Other'
};
function lkById(id) {
  return cases.filter(function (x) {
    return x.id === id;
  })[0];
}
function nkey(c) {
  return names(c).toLowerCase();
}
function lkGroup(c) {
  if (!c) return [];
  var k = nkey(c);
  return cases.filter(function (x) {
    return nkey(x) === k;
  });
}
function lkIds(g) {
  var o = {};
  g.forEach(function (x) {
    o[x.id] = 1;
  });
  return o;
}
function lkEdges() {
  var me = currentCase(),
    g = me ? lkGroup(me) : [],
    gids = lkIds(g),
    seen = {},
    list = [];
  function add(o, rel) {
    if (!o || gids[o.id] || o.id === openId) return;
    var k = nkey(o);
    if (seen[k]) return;
    seen[k] = 1;
    list.push({ o: o, rel: rel });
  }
  curLinks.forEach(function (l) {
    add(lkById(l.cid), l.rel);
  });
  g.forEach(function (x) {
    if (x.id === openId) return;
    (x.links || []).forEach(function (l) {
      add(lkById(l.cid), l.rel);
    });
  });
  cases.forEach(function (x) {
    if (gids[x.id]) return;
    (x.links || []).forEach(function (l) {
      if (gids[l.cid]) add(x, REL_INV[l.rel] || l.rel);
    });
  });
  return list;
}
function lkSave() {
  if (openId)
    patch(openId, {
      links: curLinks.map(function (l) {
        return { id: l.id, cid: l.cid, rel: l.rel };
      })
    });
}
function lkDrop(target) {
  if (!target) return;
  var me = currentCase(),
    mg = me ? lkGroup(me) : [],
    mids = lkIds(mg),
    tg = lkGroup(target),
    tids = lkIds(tg);
  curLinks = curLinks.filter(function (l) {
    return !tids[l.cid];
  });
  mg.forEach(function (x) {
    if (x.id === openId) return;
    var n = (x.links || []).filter(function (l) {
      return !tids[l.cid];
    });
    if (n.length !== (x.links || []).length) patch(x.id, { links: n });
  });
  tg.forEach(function (x) {
    var n = (x.links || []).filter(function (l) {
      return !mids[l.cid];
    });
    if (n.length !== (x.links || []).length) patch(x.id, { links: n });
  });
  lkSave();
}
function lkSet(target, rel) {
  if (!target) return;
  lkDrop(target);
  var tg =
    lkGroup(target).sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    })[0] || target;
  curLinks.push({ id: Math.random().toString(36).slice(2, 9), cid: tg.id, rel: rel });
  lkSave();
}
function lkCaseLine(x) {
  var bits = [
    STAGE_LABEL[stageOf(x)] || '',
    x.type || '',
    fmtField(x, T.sub),
    fv(x, T.value.k) !== '' ? money(fv(x, T.value.k)) : '',
    reviewOf(x) ? T.reviewWord + ' ' + fd(reviewOf(x)) : ''
  ].filter(Boolean);
  return '<div class="lkc">' + bits.map(esc).join(' · ') + '</div>';
}
function lkActivity(g) {
  var tk = 0,
    nn = 0,
    last = null;
  g.forEach(function (x) {
    (x.tasks || []).forEach(function (t) {
      if (!t.done) tk++;
    });
    (x.notes || []).forEach(function (n) {
      nn++;
      if (!last || (n.ts || 0) > (last.ts || 0)) last = n;
    });
  });
  var s = tk + ' open task' + (tk === 1 ? '' : 's') + ' · ' + nn + ' note' + (nn === 1 ? '' : 's');
  if (last)
    s +=
      ' · latest ' +
      new Date(last.ts || 0).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) +
      ': ' +
      String(last.text || '')
        .replace(/\s+/g, ' ')
        .slice(0, 90);
  return s;
}
function renderLinks() {
  var box = document.getElementById('linksBox');
  if (!box) return;
  var ed = lkEdges(),
    me = currentCase(),
    mids = lkIds(me ? lkGroup(me) : []),
    taken = {};
  ed.forEach(function (e) {
    taken[nkey(e.o)] = 1;
  });
  var opts = {};
  cases.forEach(function (x) {
    var k = nkey(x);
    if (mids[x.id] || x.id === openId || taken[k] || k === 'unnamed client') return;
    opts[names(x)] = 1;
  });
  var h = ed
    .map(function (e) {
      var g = lkGroup(e.o).sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      return (
        '<div class="lkrow"><div class="lkh"><button type="button" class="lnk" data-lkopen="' +
        e.o.id +
        '"><b>' +
        esc(names(e.o)) +
        '</b></button>' +
        '<select data-lkrel="' +
        e.o.id +
        '" aria-label="Relationship">' +
        REL_OPTS.map(function (r) {
          return '<option' + (r === e.rel ? ' selected' : '') + '>' + esc(r) + '</option>';
        }).join('') +
        '</select>' +
        '<button type="button" class="btn ghost sm" data-lkdel="' +
        e.o.id +
        '">Remove</button></div>' +
        g.map(lkCaseLine).join('') +
        '<div class="muted lkact">' +
        esc(lkActivity(g)) +
        '</div></div>'
      );
    })
    .join('');
  if (!ed.length) h = '<p class="muted" style="margin:0 0 8px">No connected clients yet.</p>';
  h +=
    '<div class="lkadd"><input id="lkQ" list="lkDL" placeholder="Search client name" autocomplete="off"><select id="lkRel" aria-label="They are this client\'s">' +
    REL_OPTS.map(function (r) {
      return '<option>' + esc(r) + '</option>';
    }).join('') +
    '</select><button type="button" class="btn sm" id="lkAdd">Add</button></div>' +
    '<datalist id="lkDL">' +
    Object.keys(opts)
      .sort()
      .map(function (n) {
        return '<option value="' + esc(n) + '">';
      })
      .join('') +
    '</datalist>' +
    '<p class="muted" style="font-size:12px;margin:6px 0 0">Pick the client, then choose who they are to this client (for example Parent). The link shows on both records.</p>';
  box.innerHTML = h;
  var lt = document.getElementById('lkTitle');
  if (lt) lt.textContent = 'Connected clients (' + ed.length + ')';
  box.style.display = lkOpen ? '' : 'none';
  var tg = document.getElementById('lkToggle');
  if (tg) {
    tg.textContent = lkOpen ? 'Hide' : 'Show';
    tg.setAttribute('aria-expanded', lkOpen ? 'true' : 'false');
  }
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('#lkToggle')) {
    lkOpen = !lkOpen;
    renderLinks();
    return;
  }
  var b = t.closest('[data-lkopen]');
  if (b) {
    e.preventDefault();
    var id = b.getAttribute('data-lkopen');
    if (openId && document.getElementById('caseForm')) patch(openId, collectForm());
    openDrawer(id);
    return;
  }
  b = t.closest('[data-lkdel]');
  if (b) {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Confirm remove';
      return;
    }
    lkDrop(lkById(b.getAttribute('data-lkdel')));
    renderLinks();
    setTimeout(renderLinks, 200);
    toast('Connection removed');
    return;
  }
  if (t.closest('#lkAdd')) {
    var q = document.getElementById('lkQ'),
      r = document.getElementById('lkRel'),
      nm = ((q && q.value) || '').trim().toLowerCase();
    var me = currentCase(),
      mids = lkIds(me ? lkGroup(me) : []);
    var cand = cases.filter(function (x) {
      return nkey(x) === nm && !mids[x.id] && x.id !== openId;
    });
    if (!nm || !cand.length) {
      toast('Choose a client from the list');
      return;
    }
    lkSet(cand[0], r.value);
    renderLinks();
    setTimeout(renderLinks, 200);
    toast('Clients connected');
  }
});
document.addEventListener('change', function (e) {
  var s = e.target;
  if (s && s.hasAttribute && s.hasAttribute('data-lkrel')) {
    lkSet(lkById(s.getAttribute('data-lkrel')), s.value);
    renderLinks();
    setTimeout(renderLinks, 200);
  }
});

function decorateSecs() {
  var f = document.getElementById('caseForm');
  if (!f) return;
  var fs = f.querySelectorAll('fieldset');
  for (var i = 0; i < fs.length; i++) {
    var x = fs[i],
      lg = x.querySelector(':scope>legend');
    if (!lg || lg.querySelector('.colbtn')) continue;
    var t = (lg.firstChild && lg.firstChild.nodeType === 3 ? lg.firstChild.nodeValue : lg.textContent)
      .replace(/\(\d+\)/, '')
      .trim()
      .toLowerCase();
    if (x.hasAttribute('data-nocol')) continue;
    if (x.id === 'peopleFs' || t.indexOf('applicants') === 0) {
      x.setAttribute('data-col', 'applicants');
      continue;
    }
    if (x.id === 'pickClient' || x.querySelector('#pickSel,#pcSel')) continue;
    x.setAttribute('data-col', t);
    var open = !!colOpen[t];
    x.classList.toggle('col-closed', !open);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ghost sm secbtn colbtn';
    b.setAttribute('data-coltoggle', t);
    b.textContent = open ? 'Hide' : 'Show';
    lg.appendChild(document.createTextNode(' '));
    lg.appendChild(b);
  }
}
function renderLive() {
  var box = $('#live');
  if (!box) return;
  if (!openId) {
    var nb0 = $('#liveNotes');
    if (nb0) nb0.innerHTML = '';
    box.innerHTML =
      '<fieldset><legend>Tasks and notes</legend><span class="muted">Add a name first. The ' +
      N1() +
      ' saves itself, then you can add tasks and notes here.</span></fieldset>';
    decorateSecs();
    return;
  }
  var c = currentCase();
  if (!c) return;
  var ts = (c.tasks || []).slice().sort(function (a, b) {
    return (
      (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
      (b.pri && !b.done ? 1 : 0) - (a.pri && !a.done ? 1 : 0) ||
      (tkKey(a) < tkKey(b) ? -1 : tkKey(a) > tkKey(b) ? 1 : 0)
    );
  });
  var ns = (c.notes || []).slice().sort(function (a, b) {
    return b.ts - a.ts;
  });
  var tasksHtml =
    T.tenancyMode || T.noTasks
      ? ''
      : '<fieldset><legend>Tasks</legend>' +
        (ts.length
          ? ts
              .map(function (t) {
                var tk0 = c.id + '|' + t.id;
                if (editTk === tk0) return '<div class="task">' + tkEditor(tk0, t) + '</div>';
                return (
                  '<div class="task' +
                  (t.done ? ' done' : '') +
                  (t.pri && !t.done ? ' pri' : '') +
                  '"><input type="checkbox" data-tk="' +
                  t.id +
                  '"' +
                  (t.done ? ' checked' : '') +
                  ' aria-label="Done"><span class="t">' +
                  esc(t.text) +
                  '</span>' +
                  (t.created
                    ? '<span class="muted" style="font-size:11px;white-space:nowrap">Added ' +
                      shortStamp(t.created) +
                      '</span>'
                    : '') +
                  (t.due
                    ? '<span class="chip ' +
                      (t.done ? '' : tone(t.due)) +
                      '">' +
                      fd(t.due) +
                      (t.time ? ' · ' + esc(t.time) : '') +
                      '</span>'
                    : '') +
                  '<button type="button" class="star' +
                  (t.pri ? ' on' : '') +
                  '" data-tkpri="' +
                  tk0 +
                  '" title="High priority" aria-label="Toggle high priority">' +
                  (t.pri ? '★' : '☆') +
                  '</button><button type="button" class="btn ghost sm" data-tkedit="' +
                  tk0 +
                  '">Edit</button><button type="button" class="x" data-rmtk="' +
                  t.id +
                  '" aria-label="Delete task">×</button></div>'
                );
              })
              .join('')
          : '<span class="muted">No tasks yet.</span>') +
        '<div class="add"><input type="text" id="tkText" placeholder="Add a task, e.g. ' +
        esc(T.taskHint) +
        '" aria-label="New task"><input type="date" id="tkDue" aria-label="Due date"><input type="time" id="tkTime" aria-label="Time"><label class="prichk"><input type="checkbox" id="tkPri"> High priority</label><button type="button" class="btn ghost" id="tkAdd">Add task</button><button type="button" class="btn" id="tkBook">Book appointment</button></div></fieldset>';
  box.innerHTML =
    (T.extraLog || (c.protection || []).length ? protFs(c) : '') +
    (T.tenancyMode ? '' : T.id === 'mortgage' ? feesFs(c) : docsFs(c));
  var nb = $('#liveNotes');
  if (nb)
    nb.innerHTML =
      (tasksHtml ? '<div style="margin-bottom:14px">' + tasksHtml + '</div>' : '') +
      '<fieldset><legend>Notes (' +
      ns.length +
      ')</legend><div class="add" style="margin:0 0 8px"><button type="button" class="btn ghost sm" id="ntHide">' +
      (notesHidden ? 'Show notes' : 'Hide notes') +
      '</button></div>' +
      (notesHidden
        ? '<span class="muted">Notes hidden.</span>'
        : '<label class="f">New note<textarea id="ntText" rows="3" placeholder="File note, call summary, next step. You can also paste a table from Excel">' +
          esc(ntDraft) +
          '</textarea></label><div class="muted" style="font-size:12px;margin:-4px 0 8px">' +
          esc(T.dontRecord) +
          '</div><div id="ntTblBox">' +
          pendHtml('nt') +
          '</div><div class="add"><button type="button" class="btn ghost" id="ntStamp">Insert date and time</button><button type="button" class="btn ghost" id="ntAdd">Add note</button></div>' +
          sugHtml() +
          (notesAll ? ns : ns.slice(0, 1))
            .map(function (n) {
              return noteItem(n, 'notes', notesAll || ns.length < 2 ? '' : ' (latest)', paras);
            })
            .join('') +
          (ns.length > 1
            ? '<button type="button" class="btn ghost sm" id="ntAll">' +
              (notesAll ? 'Show latest only' : 'Show all ' + ns.length + ' notes') +
              '</button>'
            : '')) +
      '</fieldset>';
  decorateSecs();
}
var secHidden = {};

function secFs(k, title) {
  return (
    '<fieldset data-sec="' +
    k +
    '"' +
    (secHidden[k] ? ' class="sec-hidden"' : '') +
    '><legend>' +
    title +
    ' <button type="button" class="btn ghost sm secbtn" data-sectoggle="' +
    k +
    '">' +
    (secHidden[k] ? 'Show' : 'Hide') +
    '</button></legend><div class="grid">'
  );
}
var notesHidden = false,
  notesAll = false,
  ntDraft = '';

function stampOf(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function collectForm() {
  var o = {};
  document.querySelectorAll('#caseForm [data-f]').forEach(function (el) {
    var k = el.getAttribute('data-f'),
      v = el.value;
    if (el.type === 'number') o[k] = num(v);
    else o[k] = v.trim();
  });
  if (o.postcode != null) o.postcode = pcFmt(o.postcode);
  o.applicants = [];
  document.querySelectorAll('#apps .app').forEach(function (row) {
    var a = {};
    row.querySelectorAll('[data-a]').forEach(function (i) {
      a[i.getAttribute('data-a')] = i.value.trim();
    });
    if (
      Object.keys(a).some(function (k) {
        return a[k];
      })
    )
      o.applicants.push(a);
  });
  T.fields.forEach(function (f) {
    if (f.auto && o[f.k] && o[f.k] === autoOf(o, f)) o[f.k] = '';
  });
  if ($('#secs')) o.securities = [];
  document.querySelectorAll('#secs .sec2').forEach(function (card) {
    var sid0 = card.getAttribute('data-sid'),
      old0 =
        ((currentCase() || {}).securities || []).filter(function (q) {
          return q.id === sid0;
        })[0] || {};
    var x = Object.assign({}, old0, { id: sid0 });
    card.querySelectorAll('[data-s]').forEach(function (i) {
      var k = i.getAttribute('data-s');
      x[k] = i.type === 'number' ? num(i.value) : i.value.trim();
    });
    var a2 = x.fixedUntil ? addMonths(x.fixedUntil, -REVM) : '';
    if (x.reviewDate === a2) x.reviewDate = '';
    var has = [
      'address',
      'lender',
      'lenderRef',
      'product',
      'fixedUntil',
      'reviewDate',
      'erc',
      'mortgageExpiry',
      'rate',
      'followOnRate',
      'monthlyPayment',
      'loanAmount'
    ].some(function (k) {
      return x[k];
    });
    if (has && o.securities) o.securities.push(x);
  });
  var tns = tnCollect();
  if (tns) {
    o.tenancies = tns;
    o.applicants = [];
    tns.forEach(function (tn) {
      if ((tn.status || 'current') === 'current')
        (tn.people || []).forEach(function (p) {
          if (p.name) o.applicants.push(p);
        });
    });
    var oc = occOf(o);
    o.stage = oc === 'Let' ? 'let' : oc === 'Vacant' ? 'vacant' : 'notice';
  }
  o.links = curLinks.map(function (l) {
    return { id: l.id, cid: l.cid, rel: l.rel };
  });
  return o;
}
function hasIdent(o) {
  return T.tenancyMode ? !!String(o.propertyAddress || '').trim() : o.applicants.length > 0;
}
/* ---------- quick add (landlord): four boxes make the property; everything else can be added later ---------- */
function qaOpen() {
  overlay(
    'qaOv',
    '<div class="dhd"><h2>Add a property</h2><button type="button" class="btn ghost" data-qaclose="1">Close</button></div>' +
      '<p class="muted" style="margin:6px 0 12px">Just the basics to start. Certificates, mortgage, deposit and documents can be added later, when you open the property.</p>' +
      '<form id="qaForm" autocomplete="off" novalidate><div class="grid">' +
      '<label class="f wide">Address line one (required)<input id="qa-addr" maxlength="120" placeholder="e.g. 1 Example Road"></label>' +
      '<label class="f">Postcode<input id="qa-pc" maxlength="10"></label>' +
      '<label class="f">Rent a month<span class="ig"><i>£</i><input id="qa-rent" type="number" step="any" min="0" inputmode="decimal"></span></label>' +
      '<label class="f wide">Tenant name (leave empty if the property is not let yet)<input id="qa-tn" maxlength="80"></label></div>' +
      '<p id="qaMsg" role="alert" style="margin:0 0 8px;color:#b3261e;font-size:13px;font-weight:600"></p>' +
      '<div class="add" style="justify-content:flex-end;margin:0"><button type="button" class="btn ghost" data-qamore="1">Add full details now</button><button type="submit" class="btn" id="qaGo">Add property</button></div></form>'
  );
  var a = $('#qa-addr');
  if (a) a.focus();
}
function qaRead() {
  var v = function (k) {
    return String(($('#qa-' + k) || {}).value || '').trim();
  };
  return { addr: v('addr'), pc: pcFmt(v('pc')), rent: num(v('rent')), tn: v('tn') };
}
function qaData(q) {
  var d = {
    propertyAddress: q.addr,
    postcode: q.pc,
    type: T.types[0],
    stage: q.tn ? 'let' : T.defaultStage,
    clientNo: nextClientNo(),
    tenancies: []
  };
  if (q.tn || q.rent)
    d.tenancies.push({
      id: 't' + uid(),
      status: 'current',
      tenantType: 'private',
      people: q.tn ? [{ name: q.tn }] : [],
      rent: q.rent || '',
      rentFreq: 'Monthly'
    });
  return d;
}
function qaSave() {
  var q = qaRead(),
    m = $('#qaMsg'),
    go = $('#qaGo');
  if (!q.addr) {
    if (m) m.textContent = 'Add address line one of the property.';
    var a = $('#qa-addr');
    if (a) a.focus();
    return;
  }
  if (!col) {
    if (m) m.textContent = 'Saving is not available. Sign in to store your properties.';
    return;
  }
  if (go) go.disabled = true;
  var d = tagTr(qaData(q)),
    ref = col.doc();
  d.createdAt = Date.now();
  d.updatedAt = d.createdAt;
  d.tasks = [];
  d.notes = [];
  write(ref.id, function () {
    return ref.set(d);
  }).then(
    function () {
      closeOv('qaOv');
      toast('Property added. Open it any time to add certificates, mortgage and documents.');
    },
    function () {
      if (go) go.disabled = false;
      if (m) m.textContent = 'Could not save the property. Check you are online, then try again.';
    }
  );
}
document.addEventListener('submit', function (e) {
  if (e.target && e.target.id === 'qaForm') {
    e.preventDefault();
    qaSave();
  }
});
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('[data-qaclose]') || t.id === 'qaOv') {
    closeOv('qaOv');
    return;
  }
  if (t.closest('[data-qamore]')) {
    var q = qaRead();
    closeOv('qaOv');
    openDrawer(null, { propertyAddress: q.addr, postcode: q.pc });
    return;
  }
});
function saveCase() {
  var data = collectForm();
  if (!hasIdent(data)) {
    if (!openId && JSON.stringify(data) === newBase) {
      closeDrawer();
      return;
    }
    toast(T.tenancyMode ? 'Add address line one of the property' : 'Add at least one name');
    if (T.tenancyMode) paNeed();
    return;
  }
  var btn = $('#saveCloseBtn');
  if (btn) btn.disabled = true;
  var p;
  if (openId) {
    p = patch(openId, data);
  } else {
    if (!data.clientNo) data.clientNo = nextClientNo();
    tagTr(data);
    var ref = col.doc();
    data.createdAt = Date.now();
    data.updatedAt = data.createdAt;
    data.tasks = [];
    data.notes = pendingNotes;
    p = write(ref.id, function () {
      return ref.set(data);
    }).then(function () {
      openId = ref.id;
    });
  }
  p.then(function () {
    toast(T.noun[0] + ' saved');
    closeDrawer();
  });
}

/* ---------- export ---------- */
function exportCsv() {
  claude.use('downloads').then(function (dl) {
    if (!dl) {
      toast('Downloads are not available in this view');
      return;
    }
    var flds = T.fields;
    function q(v) {
      return '"' + csvCell(v).replace(/"/g, '""') + '"';
    }
    if (T.tenancyMode)
      flds = flds.concat([
        { k: '_tenants', l: 'Current tenants' },
        { k: '_rent', l: 'Rent a month' }
      ]);
    var lines = [
      ['Client', 'Client number', 'Stage', 'Type', 'Phones', 'Emails']
        .concat(
          flds.map(function (f) {
            return f.l.replace(/\s*\((?=[^)]*\s)[^)]*\)$/, '');
          })
        )
        .map(q)
        .join(',')
    ];
    cases.forEach(function (c) {
      var ap = c.applicants || [];
      lines.push(
        [
          names(c),
          c.clientNo,
          STAGE_LABEL[stageOf(c)],
          c.type,
          ap
            .map(function (a) {
              return a.phone || '';
            })
            .filter(Boolean)
            .join(' | '),
          ap
            .map(function (a) {
              return a.email || '';
            })
            .filter(Boolean)
            .join(' | ')
        ]
          .concat(
            flds.map(function (f) {
              return f.k === '_tenants'
                ? tnCurrent(c).map(tnNames).join(' | ')
                : f.k === '_rent'
                  ? Math.round(rentSum(c) * 100) / 100
                  : fv(c, f.k);
            })
          )
          .map(q)
          .join(',')
      );
    });
    return dl.save({ filename: NS() + '-' + iso(TODAY) + '.csv', data: '\ufeff' + lines.join('\r\n') }).then(
      function () {
        toast('CSV saved');
      },
      function (e) {
        if (e && e.code !== 'declined') toast('Could not save the file');
      }
    );
  });
}

/* ---------- task tray ---------- */
var trayOpen = false,
  trFilter = 'open',
  trQuery = '',
  trOpen = {};
function allTasks() {
  var out = [];
  cases.forEach(function (c) {
    if (c.stage === 'lost') return;
    (c.tasks || []).forEach(function (t) {
      out.push({ c: c, t: t });
    });
  });
  return out;
}
function trBucket(x) {
  var d = x.t.due;
  if (x.t.done) return 'done';
  if (!d) return 'none';
  var n = diff(d);
  return n < 0 ? 'over' : n === 0 ? 'today' : n <= 7 ? 'week' : 'later';
}
function updTrayBtn() {
  var b = $('#trayBtn');
  if (!b) return;
  if (T && (T.tenancyMode || T.noTasks)) {
    b.style.display = 'none';
    return;
  }
  b.style.display = '';
  var od = allTasks().filter(function (x) {
    return trBucket(x) === 'over';
  }).length;
  b.innerHTML = 'Tasks' + (od ? '<span class="tbadge">' + od + ' overdue</span>' : '');
}
var TR_LABEL = {
  pri: 'High priority',
  over: 'Overdue',
  today: 'Due today',
  week: 'Next 7 days',
  later: 'Later',
  none: 'No due date',
  done: 'Done'
};
function trItem(x) {
  var c = x.c,
    t = x.t,
    b = trBucket(x),
    k = c.id + '|' + t.id;
  if (editTk === k)
    return (
      '<div class="tt"><div class="tm">' +
      tkEditor(k, t) +
      '<div><button type="button" class="lnk" data-open="' +
      c.id +
      '">' +
      esc(names(c)) +
      cno(c) +
      '</button></div></div></div>'
    );
  var open = !!trOpen[k],
    dchip = t.due
      ? '<span class="chip ' +
        (b === 'over' ? 'bad' : b === 'today' ? 'warn' : '') +
        '">' +
        (b === 'today' ? 'Today' : fd(t.due)) +
        (t.time ? ' ' + esc(t.time) : '') +
        '</span>'
      : '<span class="muted" style="font-size:12px">No date</span>';
  return (
    '<div class="tt ' +
    (b === 'over' ? 'bad' : b === 'today' ? 'warn' : '') +
    (t.done ? ' done' : '') +
    (t.pri && !t.done ? ' pri' : '') +
    (open ? ' open' : '') +
    '"><input type="checkbox" data-trk="' +
    k +
    '"' +
    (t.done ? ' checked' : '') +
    ' aria-label="Mark done"><div class="tm"><div class="trow" data-trtog="' +
    k +
    '" role="button" tabindex="0" aria-expanded="' +
    open +
    '"><div class="tx">' +
    (t.pri && !t.done ? '<span class="prtag">HIGH</span> ' : '') +
    esc(t.text) +
    '</div>' +
    dchip +
    '</div><div><button type="button" class="lnk" data-open="' +
    c.id +
    '">' +
    esc(names(c)) +
    cno(c) +
    '</button></div>' +
    (open
      ? (t.created
          ? '<div class="muted" style="font-size:12px">Added ' + shortStamp(t.created) + '</div>'
          : '') +
        '<div class="tact"><input type="date" data-trd="' +
        k +
        '" value="' +
        esc(t.due || '') +
        '" aria-label="Due date"><input type="time" data-trt="' +
        k +
        '" value="' +
        esc(t.time || '') +
        '" aria-label="Time"><button type="button" class="star' +
        (t.pri ? ' on' : '') +
        '" data-tkpri="' +
        k +
        '" title="High priority" aria-label="Toggle high priority">' +
        (t.pri ? '★' : '☆') +
        '</button><button type="button" class="btn ghost sm" data-tkedit="' +
        k +
        '">Edit</button><button type="button" class="btn ghost sm" data-snz="' +
        k +
        '|1">+1 day</button><button type="button" class="btn ghost sm" data-snz="' +
        k +
        '|7">+1 week</button></div>'
      : '') +
    '</div></div>'
  );
}
var sideOn = true;
var mqSide = window.matchMedia('(min-width:760px)');
function placeAcct() {}
function applySide() {
  document.body.classList.toggle('side-on', sideOn);
  renderNav();
  placeAcct();
  var h = document.querySelector('header.top');
  if (h) document.documentElement.style.setProperty('--hh', h.offsetHeight + 'px');
  renderSide();
  renderRem();
}
if (mqSide.addEventListener)
  mqSide.addEventListener('change', function () {
    if (appReady) applySide();
  });
window.addEventListener('resize', function () {
  if (!appReady) return;
  renderNav();
  var h = document.querySelector('header.top');
  if (h) document.documentElement.style.setProperty('--hh', h.offsetHeight + 'px');
});
function sideItem(e, g) {
  if (e.kind === 'appt')
    return (
      '<div class="si' +
      (g === 'over' ? ' over' : '') +
      '"><div style="min-width:0;flex:1"><button type="button" class="lnk st" data-apedit="' +
      esc(e.id) +
      '">' +
      esc(e.who) +
      '</button><div class="sc">' +
      esc(e.label) +
      '</div><div class="sd">' +
      fd(e.date) +
      ' · ' +
      esc(rel(e.date)) +
      ' · in your calendar</div></div></div>'
    );
  return (
    '<div class="si' +
    (g === 'over' ? ' over' : '') +
    '"><div style="min-width:0;flex:1"><button type="button" class="lnk st" data-open="' +
    e.id +
    '">' +
    esc(e.who) +
    '</button><div class="sc">' +
    esc(e.label) +
    '</div><div class="sd">' +
    fd(e.date) +
    ' · ' +
    esc(rel(e.date)) +
    '</div></div><button type="button" class="btn ghost sm" data-remdone="' +
    e.id +
    '|' +
    esc(e.key) +
    '|' +
    e.date +
    '"' +
    (e.rep
      ? ' data-rep="1" title="Remind me again in 30 days. Update the date when it is renewed.">In 30 days'
      : ' title="Hide this reminder">Done') +
    '</button></div>'
  );
}
var sideLater = false;
function renderSide() {
  var s = $('#sideTasks');
  if (!s || !document.body.classList.contains('side-on')) {
    if (s) s.innerHTML = '';
    return;
  }
  var bt = bdCounts(bdPeople().list).today;
  if (T.tenancyMode) {
    var an = bizName() || profA().name || '',
      lm = (window.CD_loginMail && window.CD_loginMail()) || '';
    s.innerHTML =
      '<div id="sideTools"><div class="sh acctname"><b>Account</b>' +
      (an ? '<strong class="an">' + esc(an) + '</strong>' : '') +
      (lm ? '<span class="am">Logged in with<br><b>' + esc(lm) + '</b></span>' : '') +
      '</div><button type="button" class="sbtn" data-v="tradesmen"' +
      (view === 'tradesmen' ? ' aria-current="page"' : '') +
      '>My tradesmen</button><button type="button" class="sbtn" data-gnopen="1">Reports and agreements</button><button type="button" class="sbtn" data-v="more" aria-expanded="' +
      (navMore || view === 'notebook') +
      '">More<span aria-hidden="true" style="font-size:10px;margin-left:8px">' +
      (navMore || view === 'notebook' ? '&#9650;' : '&#9660;') +
      '</span></button>' +
      (navMore || view === 'notebook'
        ? '<button type="button" class="sbtn" data-v="notebook"' +
          (view === 'notebook' ? ' aria-current="page"' : '') +
          '>Notebook</button><button type="button" class="sbtn" data-bookappt="1">Book appointment</button>'
        : '') +
      '<button type="button" class="sbtn acct" data-sideacct="1" style="margin:auto 0 6px">Settings</button><button type="button" class="sbtn logout" id="logoutBtn">Log out</button></div>';
    return;
  }
  var items = toolItems(
    T.calTab
      ? [
          ['tasks', 'Calendar'],
          ['todo', 'To do'],
          ['reminders', 'Reminders'],
          ['calculator', 'Calculator'],
          ['invoices', 'Quotes & invoices'],
          ['notebook', 'Notebook'],
          ['birthdays', 'Birthdays'],
          ['marketing', 'Marketing']
        ]
      : T.id === 'mortgage'
        ? [
            ['calculator', 'Mortgage Calculator'],
            ['appointments', 'Calendar'],
            ['notebook', 'Notebook'],
            ['birthdays', 'Birthdays'],
            ['marketing', 'Marketing']
          ]
        : [
            ['invoices', 'Quotes & invoices'],
            ['calculator', T.calcKind === 'tax' ? 'Calculator' : 'Mortgage Calculator'],
            ['notebook', 'Notebook'],
            ['birthdays', 'Birthdays'],
            ['marketing', 'Marketing']
          ]
  );
  var assetsBtn =
    '<button type="button" class="sbtn" data-v="assets"' +
    (view === 'assets' || view === 'myhome' || view === 'mycar' ? ' aria-current="page"' : '') +
    '>My Properties and Cars</button>';
  var an2 = bizName() || profA().name || '',
    lm2 = (window.CD_loginMail && window.CD_loginMail()) || '';
  s.innerHTML =
    '<div id="sideTools"><div class="sh acctname"><b>Account</b>' +
    (an2 ? '<strong class="an">' + esc(an2) + '</strong>' : '') +
    (lm2 ? '<span class="am">Logged in with<br><b>' + esc(lm2) + '</b></span>' : '') +
    '</div>' +
    (T.id === 'mortgage' ? '' : assetsBtn) +
    '<div class="sh"><b>Tools</b></div>' +
    items
      .map(function (i) {
        return (
          '<button type="button" class="sbtn" data-v="' +
          i[0] +
          '"' +
          (view === i[0] ? ' aria-current="page"' : '') +
          '>' +
          i[1] +
          (i[0] === 'birthdays' && bt
            ? '<span class="badge" style="background:#fde4ee;color:#c2185b">' + bt + ' today</span>'
            : '') +
          (i[0] === 'todo' && tdDue() ? '<span class="badge">' + tdDue() + ' today</span>' : '') +
          '</button>'
        );
      })
      .join('') +
    '<button type="button" class="sbtn acct" data-sideacct="1">Settings</button><button type="button" class="sbtn logout" id="logoutBtn">Log out</button></div>';
}
function renderRem() {
  var s = $('#homeRem');
  if (!s) return;
  var ev = reviewEvents();
  var h =
    '<div class="sh"><b>Reminders</b><span class="muted" style="font-size:12px">' +
    ev.length +
    (T.id === 'mortgage' ? ' review' : ' key date') +
    (ev.length === 1 ? '' : 's') +
    '</span></div>';
  [
    [
      'over',
      'Overdue',
      function (n) {
        return n < 0;
      }
    ],
    [
      'week',
      'Next 7 days',
      function (n) {
        return n >= 0 && n <= 7;
      }
    ],
    [
      'month',
      'Next 30 days',
      function (n) {
        return n > 7 && n <= 30;
      }
    ],
    [
      'q',
      '31 to 90 days',
      function (n) {
        return n > 30 && n <= 90;
      }
    ],
    [
      'later',
      'Later',
      function (n) {
        return n > 90;
      }
    ]
  ].forEach(function (g) {
    var gi = ev.filter(function (e) {
      return g[2](diff(e.date));
    });
    if (g[0] === 'later') {
      if (gi.length)
        h +=
          '<button type="button" class="sg sglater" data-sidelater="1" aria-expanded="' +
          sideLater +
          '">Later · ' +
          gi.length +
          ' <span>' +
          (sideLater ? '▾' : '▸') +
          '</span></button>' +
          (sideLater
            ? gi
                .map(function (e) {
                  return sideItem(e, g[0]);
                })
                .join('')
            : '');
      return;
    }
    if (gi.length)
      h +=
        '<div class="sg' +
        (g[0] === 'over' ? ' bad' : '') +
        '">' +
        g[1] +
        ' · ' +
        gi.length +
        '</div>' +
        gi
          .map(function (e) {
            return sideItem(e, g[0]);
          })
          .join('');
  });
  if (!ev.length) h += '<div class="muted" style="font-size:13px">Nothing due.</div>';
  s.innerHTML = h;
}
function renderTray() {
  var box = $('#trList');
  if (!box) return;
  bdBanner();
  var aeT = document.activeElement;
  if (editTk && aeT && aeT.closest && aeT.closest('[data-tkbox]')) return;
  var q = trQuery.trim().toLowerCase(),
    all = allTasks();
  var cnt = { open: 0, over: 0, today: 0, week: 0, none: 0, done: 0 };
  all.forEach(function (x) {
    var b = trBucket(x);
    if (b === 'done') cnt.done++;
    else {
      cnt.open++;
      if (b === 'over') cnt.over++;
      if (b === 'today') {
        cnt.today++;
        cnt.week++;
      }
      if (b === 'week') cnt.week++;
      if (b === 'none') cnt.none++;
    }
  });
  var chips = [
    ['open', 'All open'],
    ['over', 'Overdue'],
    ['today', 'Today'],
    ['week', 'Next 7 days'],
    ['none', 'No date'],
    ['done', 'Done']
  ];
  var tbk = $('#trBulk');
  if (tbk)
    tbk.innerHTML = cnt.over
      ? '<span><b>' +
        cnt.over +
        ' overdue.</b> Move them all to:</span> <button type="button" class="btn ghost sm" data-trbulk="today">Today</button><button type="button" class="btn ghost sm" data-trbulk="tomorrow">Tomorrow</button><button type="button" class="btn ghost sm" data-trbulk="monday">Next Monday</button>'
      : '';
  $('#trChips').innerHTML = chips
    .map(function (c) {
      return (
        '<button type="button" data-trf="' +
        c[0] +
        '" aria-pressed="' +
        (trFilter === c[0]) +
        '">' +
        c[1] +
        ' ' +
        cnt[c[0]] +
        '</button>'
      );
    })
    .join('');
  var dl = $('#trCases');
  if (dl)
    dl.innerHTML = cases
      .slice()
      .sort(function (a, b) {
        return cnum(a) - cnum(b);
      })
      .map(function (c) {
        return '<option value="' + esc((c.clientNo || '') + ' · ' + names(c)) + '"></option>';
      })
      .join('');
  var items = all.filter(function (x) {
    var b = trBucket(x);
    if (trFilter === 'done') {
      if (b !== 'done') return false;
    } else {
      if (b === 'done') return false;
      if (trFilter === 'over' && b !== 'over') return false;
      if (trFilter === 'today' && b !== 'today') return false;
      if (trFilter === 'week' && b !== 'today' && b !== 'week') return false;
      if (trFilter === 'none' && b !== 'none') return false;
    }
    if (q && (x.t.text + ' ' + names(x.c) + ' ' + (x.c.clientNo || '')).toLowerCase().indexOf(q) < 0)
      return false;
    return true;
  });
  items.sort(function (a, b) {
    var da = tkKey(a.t),
      db2 = tkKey(b.t);
    return da < db2 ? -1 : da > db2 ? 1 : (a.t.created || 0) - (b.t.created || 0) || cnum(a.c) - cnum(b.c);
  });
  if (!items.length) {
    box.innerHTML = '<div class="empty">Nothing here.</div>';
    return;
  }
  var order = ['pri', 'today', 'over', 'week', 'later', 'none', 'done'],
    h = '';
  var isP = function (x) {
    return !x.t.done && !!x.t.pri;
  };
  order.forEach(function (g) {
    var gi = items.filter(function (x) {
      return g === 'pri' ? isP(x) : !isP(x) && trBucket(x) === g;
    });
    if (!gi.length) return;
    h +=
      '<div class="tgh ' +
      (g === 'over' ? 'bad' : g === 'pri' ? 'prh' : '') +
      '">' +
      TR_LABEL[g] +
      ' · ' +
      gi.length +
      '</div>' +
      gi.map(trItem).join('');
  });
  box.innerHTML = h;
}
function trBulk(w) {
  var d =
      w === 'today'
        ? iso(TODAY)
        : w === 'tomorrow'
          ? addDays(iso(TODAY), 1)
          : addDays(iso(TODAY), (8 - TODAY.getDay()) % 7 || 7),
    n = 0;
  cases.forEach(function (c) {
    if (
      c.stage === 'lost' ||
      !(c.tasks || []).some(function (t) {
        return !t.done && t.due && diff(t.due) < 0;
      })
    )
      return;
    var nt = (c.tasks || []).map(function (t) {
      if (!t.done && t.due && diff(t.due) < 0) {
        n++;
        return Object.assign({}, t, { due: d });
      }
      return t;
    });
    patch(c.id, { tasks: nt });
  });
  toast(n + ' task' + (n === 1 ? '' : 's') + ' moved to ' + fd(d));
}
function taskShell() {
  return (
    '<input type="search" id="trQ" class="search" style="width:100%;margin-top:10px" placeholder="Search tasks or clients" aria-label="Search tasks" value="' +
    esc(trQuery) +
    '"><div id="trBulk" class="trbulk"></div><div id="trChips" class="chips" style="margin:10px 0"></div><div id="trList"></div>'
  );
}
function openTray() {
  trayOpen = true;
  var t = $('#tray');
  t.hidden = false;
  t.innerHTML =
    '<div class="th"><div><div class="eyebrow">Task tray</div><h2>Tasks</h2></div><button type="button" class="btn ghost" data-trclose>Close</button></div><div class="tb"><div class="tadd"><input type="text" id="trNewText" class="wide2" placeholder="New task, e.g. ' +
    esc(T.taskHint) +
    '" aria-label="New task"><input type="text" id="trNewCase" list="trCases" placeholder="Client (name or C number)" aria-label="Client"><datalist id="trCases"></datalist><input type="date" id="trNewDue" aria-label="Due date"><input type="time" id="trNewTime" aria-label="Time"><label class="prichk"><input type="checkbox" id="trNewPri"> High priority</label><button type="button" class="btn wide2" id="trAdd">Add task</button></div><input type="search" id="trQ" class="search" style="width:100%" placeholder="Search tasks or clients" aria-label="Search tasks" value="' +
    esc(trQuery) +
    '"><div id="trChips" class="chips"></div><div id="trList"></div></div>';
  renderTray();
}
function closeTray() {
  trayOpen = false;
  var t = $('#tray');
  t.hidden = true;
  t.innerHTML = '';
}
function trFind(key) {
  var p = String(key).split('|');
  var c = cases.filter(function (x) {
    return x.id === p[0];
  })[0];
  if (!c) return null;
  var t = (c.tasks || []).filter(function (x) {
    return x.id === p[1];
  })[0];
  return t ? { c: c, t: t, n: +p[2] } : null;
}
function trSet(f, change) {
  patch(f.c.id, {
    tasks: (f.c.tasks || []).map(function (x) {
      return x.id === f.t.id ? Object.assign({}, x, change) : x;
    })
  });
}
function trAddTask() {
  var tx = $('#trNewText').value.trim(),
    cv = $('#trNewCase').value,
    due = $('#trNewDue').value,
    tmv = $('#trNewTime').value;
  if (tmv && !due) due = iso(TODAY);
  if (!tx) {
    toast('Type the task first');
    return;
  }
  var no = cv.split(' · ')[0].trim().toUpperCase();
  var c = cases.filter(function (x) {
    return (x.clientNo || '').toUpperCase() === no;
  })[0];
  if (!c) {
    toast('Pick a client from the list');
    return;
  }
  patch(c.id, {
    tasks: (c.tasks || []).concat([
      {
        id: uid(),
        text: tx,
        due: due || '',
        time: tmv || '',
        done: false,
        created: Date.now(),
        pri: !!$('#trNewPri').checked
      }
    ])
  });
  $('#trNewText').value = '';
  $('#trNewDue').value = '';
  $('#trNewTime').value = '';
  $('#trNewPri').checked = false;
  toast('Task added to ' + names(c));
}

/* ---------- notebook (general notes, not linked to any client) ---------- */
var nbCol = null,
  notes = [],
  nbSel = null,
  nbShown = null,
  nbQuery = '',
  nbTimer = null;
function nbSorted() {
  return notes.slice().sort(function (a, b) {
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}
function nbTitleOf(n) {
  var t = (n.title || '').trim();
  if (t) return t;
  var l = String(n.body || '')
    .split('\n')
    .filter(function (x) {
      return x.trim();
    })[0];
  return l ? l.slice(0, 60) : 'Untitled note';
}
function nbShell() {
  return (
    '<div class="pagehead"><h1>Notebook</h1><span class="muted">General notes, not linked to any client</span></div><div class="nb"><aside class="nbside"><button type="button" class="btn" id="nbNew" style="width:100%">New note</button><input type="search" id="nbQ" class="search" style="width:100%;margin-top:8px" placeholder="Search notes" aria-label="Search notes" value="' +
    esc(nbQuery) +
    '"><div id="nbList"></div></aside><section class="nbmain" id="nbMain"></section></div>'
  );
}
/* delete a note from the Notebook (the button asks twice, so a stray tap cannot lose a note) */
function nbDelete(id) {
  if (!id) return;
  if (nbSel === id) nbSel = null;
  if (nbShown === id) nbShown = null;
  write('nb-' + id, function () {
    return nbCol.doc(id).delete();
  }).then(function () {
    toast('Note deleted');
  });
}
function nbList() {
  var box = $('#nbList');
  if (!box) return;
  var q = nbQuery.trim().toLowerCase();
  var l = nbSorted().filter(function (n) {
    return !q || ((n.title || '') + ' ' + (n.body || '')).toLowerCase().indexOf(q) > -1;
  });
  box.innerHTML = l.length
    ? l
        .map(function (n) {
          var sn = String(n.body || '')
            .replace(/\s+/g, ' ')
            .slice(0, 80);
          return (
            '<button type="button" class="nbi' +
            (n.id === nbSel ? ' on' : '') +
            '" data-nbsel="' +
            n.id +
            '"><b>' +
            esc(nbTitleOf(n)) +
            '</b><span class="muted">' +
            stampOf(n.updatedAt || n.createdAt || Date.now()) +
            '</span><span class="muted">' +
            esc(sn) +
            '</span></button>'
          );
        })
        .join('')
    : '<div class="muted" style="padding:10px">' +
      (notes.length ? 'No notes match.' : 'No notes yet. Click New note.') +
      '</div>';
}
var NB_FONTS = {
  'Arial': 'Arial, Helvetica, sans-serif',
  'Georgia': 'Georgia, serif',
  'Times New Roman': '"Times New Roman", Times, serif',
  'Verdana': 'Verdana, Geneva, sans-serif',
  'Trebuchet MS': '"Trebuchet MS", sans-serif',
  'Courier New': '"Courier New", monospace'
};
var NB_SIZES = { 1: 10, 2: 13, 3: 16, 4: 19, 5: 24, 6: 32, 7: 44 };
var NB_NAMED = {
  'x-small': 10,
  'small': 13,
  'medium': 16,
  'large': 19,
  'x-large': 24,
  'xx-large': 32,
  'xxx-large': 44
};
function nbColor(v) {
  v = String(v || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(v))
    v = '#' + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2) + v.charAt(3) + v.charAt(3);
  var h = safeColor(v) || rgbHex(v);
  return h ? h.toLowerCase() : '';
}
function nbFontOf(v) {
  var f = String(v || '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
    .toLowerCase();
  for (var k in NB_FONTS) if (k.toLowerCase() === f) return NB_FONTS[k];
  return '';
}
function nbSizeOf(v) {
  v = String(v || '')
    .trim()
    .toLowerCase();
  if (NB_NAMED[v]) return NB_NAMED[v];
  var m = /^([\d.]+)px$/.exec(v);
  if (m) {
    var n = Math.round(+m[1]);
    return n >= 8 && n <= 72 ? n : 0;
  }
  return 0;
}
function nbClean(html) {
  var doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html'),
    out = document.createElement('div');
  var TAG = {
    b: 'b',
    strong: 'b',
    i: 'i',
    em: 'i',
    u: 'u',
    s: 's',
    strike: 's',
    del: 's',
    ul: 'ul',
    ol: 'ol',
    li: 'li',
    div: 'div',
    p: 'div',
    h1: 'div',
    h2: 'div',
    h3: 'div',
    span: 'span',
    font: 'span'
  };
  function walk(src, dst, depth) {
    if (depth > 30) return;
    Array.prototype.forEach.call(src.childNodes, function (n) {
      if (n.nodeType === 3) {
        dst.appendChild(document.createTextNode(n.nodeValue));
        return;
      }
      if (n.nodeType !== 1) return;
      var tg = n.tagName.toLowerCase();
      if (tg === 'br') {
        dst.appendChild(document.createElement('br'));
        return;
      }
      if (
        /^(script|style|iframe|object|embed|svg|math|template|noscript|textarea|select|button|input|img|video|audio|link|meta)$/.test(
          tg
        )
      )
        return;
      if (!TAG[tg]) {
        walk(n, dst, depth + 1);
        return;
      }
      var el = document.createElement(TAG[tg]),
        st = [],
        sd = n.style || {};
      var col = nbColor(sd.color || (tg === 'font' ? n.getAttribute('color') : '')),
        bg = nbColor(sd.backgroundColor),
        fam = nbFontOf(sd.fontFamily || (tg === 'font' ? n.getAttribute('face') : '')),
        sz = nbSizeOf(sd.fontSize) || (tg === 'font' ? NB_SIZES[+n.getAttribute('size')] || 0 : 0);
      if (col && (lum(col) < 0.1 || lum(col) > 0.95)) col = '';
      if (bg) {
        st.push('background-color:' + bg);
        if (!col) col = '#101c26';
      }
      if (col) st.push('color:' + col);
      if (fam) st.push('font-family:' + fam);
      if (sz) st.push('font-size:' + sz + 'px');
      var fw = sd.fontWeight;
      if (fw === 'bold' || +fw >= 600) st.push('font-weight:700');
      if (sd.fontStyle === 'italic') st.push('font-style:italic');
      var td = String(sd.textDecorationLine || sd.textDecoration || '');
      if (/underline|line-through/.test(td))
        st.push(
          'text-decoration:' +
            (
              (/underline/.test(td) ? 'underline ' : '') + (/line-through/.test(td) ? 'line-through' : '')
            ).trim()
        );
      if (st.length) el.setAttribute('style', st.join(';'));
      walk(n, el, depth + 1);
      dst.appendChild(el);
    });
  }
  walk(doc.body, out, 0);
  return out.innerHTML;
}
function nbBodyHtml(n) {
  return n.html ? nbClean(n.html) : esc(n.body || '').replace(/\r?\n/g, '<br>');
}
function nbToolbar() {
  var sw = function (kind, c) {
    return (
      '<button type="button" class="sw" data-rt="' +
      kind +
      ':' +
      c +
      '" style="background:' +
      c +
      '" title="' +
      (kind === 'fore' ? 'Text colour' : 'Highlight') +
      '" aria-label="' +
      (kind === 'fore' ? 'Text colour' : 'Highlight') +
      ' ' +
      c +
      '"></button>'
    );
  };
  var tc = ['#d32f2f', '#ef6c00', '#2e7d32', '#1565c0', '#6a1b9a', '#6d4c41'],
    hc = ['#fff176', '#a5d6a7', '#90caf9', '#f8bbd0', '#ffcc80'];
  return (
    '<div class="rtbar" id="nbBar">' +
    '<button type="button" data-rt="bold" title="Bold"><b>B</b></button><button type="button" data-rt="italic" title="Italic"><i>I</i></button><button type="button" data-rt="underline" title="Underline"><u>U</u></button><button type="button" data-rt="strikeThrough" title="Strikethrough"><s>S</s></button><span class="sep"></span>' +
    '<select data-rtsel="font" aria-label="Font"><option value="">Font</option>' +
    Object.keys(NB_FONTS)
      .map(function (k) {
        return '<option value="' + esc(NB_FONTS[k]) + '">' + k + '</option>';
      })
      .join('') +
    '</select>' +
    '<select data-rtsel="size" aria-label="Text size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Larger</option><option value="6">Huge</option></select><span class="sep"></span>' +
    '<label>Text</label>' +
    tc
      .map(function (c) {
        return sw('fore', c);
      })
      .join('') +
    '<input type="color" data-rtinput="fore" value="#1565c0" aria-label="Custom text colour"><span class="sep"></span>' +
    '<label>Highlight</label>' +
    hc
      .map(function (c) {
        return sw('hilite', c);
      })
      .join('') +
    '<input type="color" data-rtinput="hilite" value="#fff176" aria-label="Custom highlight colour"><button type="button" data-rt="hilite:none" title="Remove highlight">No highlight</button><span class="sep"></span>' +
    '<button type="button" data-rt="insertUnorderedList" title="Bullet list">• List</button><button type="button" data-rt="insertOrderedList" title="Numbered list">1. List</button><button type="button" data-rt="removeFormat" title="Clear formatting">Clear format</button></div>'
  );
}
var nbRange = null;
document.addEventListener('selectionchange', function () {
  var sl = window.getSelection(),
    b = $('#nbBody');
  if (b && sl && sl.rangeCount && b.contains(sl.anchorNode)) nbRange = sl.getRangeAt(0).cloneRange();
});
function nbExec(cmd, val) {
  var b = $('#nbBody');
  if (!b) return;
  b.focus();
  if (nbRange) {
    var sl = window.getSelection();
    sl.removeAllRanges();
    sl.addRange(nbRange);
  }
  try {
    document.execCommand('styleWithCSS', false, true);
  } catch (e) {}
  if (cmd === 'hilite') {
    if (val === 'none') {
      document.execCommand('hiliteColor', false, 'transparent');
    } else if (!document.execCommand('hiliteColor', false, val))
      document.execCommand('backColor', false, val);
  } else if (cmd === 'fore') {
    document.execCommand('foreColor', false, val);
  } else document.execCommand(cmd, false, val == null ? null : val);
  nbSched();
}
function nbTablesHtml(n) {
  return (n.tables || [])
    .map(function (t) {
      return '<div style="margin:12px 0">' + tblBlock({ ts: t.ts, table: t.table }, 'nbtables') + '</div>';
    })
    .join('');
}
function nbSetTables(arr) {
  var id = nbShown;
  if (!id || !nbCol) return;
  var n = notes.filter(function (x) {
    return x.id === id;
  })[0];
  if (n) n.tables = arr;
  var bx = $('#nbTables');
  if (bx && n) {
    bx.innerHTML = nbTablesHtml(n);
    bx.setAttribute('data-sig', JSON.stringify(arr));
  }
  write('nb-' + id, function () {
    return nbCol.doc(id).update({ tables: arr, updatedAt: Date.now() });
  });
}
function nbEditor() {
  var m = $('#nbMain');
  if (!m) return;
  var n = notes.filter(function (x) {
    return x.id === nbSel;
  })[0];
  if (!n) {
    m.innerHTML = '<div class="empty"><h2>Notebook</h2>Click New note to start typing.</div>';
    nbShown = null;
    return;
  }
  nbShown = n.id;
  m.innerHTML =
    '<input id="nbTitle" class="nbt" type="text" placeholder="Title (optional)" value="' +
    esc(n.title || '') +
    '" aria-label="Note title">' +
    nbToolbar() +
    '<div id="nbBody" class="nbb nbrt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note" data-ph="Type anything here. Use the toolbar for colour and font. You can also paste a table from Excel.">' +
    nbBodyHtml(n) +
    '</div><div id="nbTables" data-sig=\'' +
    esc(JSON.stringify(n.tables || [])) +
    "'>" +
    nbTablesHtml(n) +
    '</div><div class="add"><button type="button" class="btn danger" id="nbDel">Delete note</button><span class="muted" id="nbMsg" style="align-self:center;font-size:12px">Saves automatically</span></div>';
}
function renderNotebook() {
  if (!nbSel && notes.length) nbSel = nbSorted()[0].id;
  nbList();
  var n = notes.filter(function (x) {
    return x.id === nbSel;
  })[0];
  if (nbSel !== nbShown || (!n && nbShown) || (!$('#nbTitle') && n)) nbEditor();
  var bx = $('#nbTables');
  if (n && bx) {
    var sg = JSON.stringify(n.tables || []);
    if (
      bx.getAttribute('data-sig') !== sg &&
      !(document.activeElement && bx.contains(document.activeElement))
    ) {
      bx.innerHTML = nbTablesHtml(n);
      bx.setAttribute('data-sig', sg);
    }
  }
}
function nbSave() {
  nbTimer = null;
  var id = nbShown;
  if (!id || !nbCol) return;
  var t = $('#nbTitle'),
    b = $('#nbBody');
  if (!t || !b) return;
  var d = {
    title: t.value,
    body: (b.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    html: nbClean(b.innerHTML),
    updatedAt: Date.now()
  };
  write('nb-' + id, function () {
    return nbCol.doc(id).update(d);
  }).then(function () {
    var m = $('#nbMsg');
    if (m)
      m.textContent =
        'Saved ' +
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
}
function nbFlush() {
  if (nbTimer) {
    clearTimeout(nbTimer);
    nbSave();
  }
}
function nbSched() {
  var m = $('#nbMsg');
  if (m) m.textContent = 'Saving...';
  clearTimeout(nbTimer);
  nbTimer = setTimeout(nbSave, 800);
}
function nbNew() {
  if (!nbCol) return;
  nbFlush();
  var ref = nbCol.doc(),
    now = Date.now();
  nbSel = ref.id;
  nbQuery = '';
  write('nb-' + ref.id, function () {
    return ref.set({ title: '', body: '', createdAt: now, updatedAt: now });
  }).then(function () {
    setTimeout(function () {
      var b = $('#nbBody');
      if (b) b.focus();
    }, 400);
  });
}

/* ---------- full backup ---------- */
function backupAll() {
  if (!loaded || !cases.length) {
    toast('Nothing to back up yet');
    return;
  }
  claude.use('downloads').then(function (dl) {
    if (!dl) {
      toast('Downloads are not available in this view');
      return;
    }
    var an = (window.MD_CONFIG || {}).appName || 'MySimpleDesk';
    var payload = {
      app: an,
      trade: T.id,
      exportedAt: new Date().toISOString(),
      count: cases.length,
      cases: cases,
      notebook: notes,
      appointments: appts,
      marketing: [{ id: 'contacts', items: mkItems }].concat(
        mkMsgsDoc ? [{ id: 'messages', items: mkMsgsDoc }] : []
      ),
      settings: [{ id: 'trade', trade: T.id }].concat(
        BIZ.savedAt ? [Object.assign({ id: 'business' }, BIZ)] : []
      )
    };
    return dl
      .save({
        filename: an.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() + '-backup-' + iso(TODAY) + '.json',
        data: JSON.stringify(payload, null, 2)
      })
      .then(
        function () {
          toast('Backup saved: ' + cases.length + ' ' + NS());
        },
        function (e) {
          if (e && e.code !== 'declined') toast('Could not save the backup');
        }
      );
  });
}

window.CD_exportCsv = exportCsv;
