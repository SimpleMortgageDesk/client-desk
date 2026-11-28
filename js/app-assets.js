'use strict';
/* MySimpleDesk app: Deleting uploads, documents for cars and the home, and the My Properties and Cars page.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- deleting uploads: the file moves to the storage's recycle bin and is taken off the record ---------- */
function binName() {
  var w = (window.CD_files && window.CD_files.where && window.CD_files.where()) || 'your storage';
  return w === 'Google Drive' ? 'Google Drive bin' : w + ' recycle bin';
}
/* resolves 'ok' (moved to the bin), 'none' (an old record with no file id), 'offline' or 'fail' (nothing was deleted) */
function fileDelete(fid) {
  if (!fid) return Promise.resolve('none');
  if (!window.CD_files || !window.CD_files.trash || !window.CD_files.can()) return Promise.resolve('offline');
  return window.CD_files.trash(fid).then(
    function () {
      return 'ok';
    },
    function (e) {
      return navigator.onLine === false || e instanceof TypeError || (e && e.renew) ? 'offline' : 'fail';
    }
  );
}
function delFailMsg(r) {
  return r === 'offline'
    ? 'Could not reach your file storage. Check you are online, then try Delete again.'
    : 'Could not delete the file. Try again.';
}
function delTell(r) {
  return r === 'ok'
    ? 'Deleted. The file is in your ' + binName() + ' if you need it back.'
    : 'Removed from the list. This file was added in an older version, so delete the file itself from your folder.';
}
/* ---------- documents for cars and the residential property: a folder in the person's own storage, like a rental property ---------- */
var DS_SLOTS = {
  car: [
    ['insurance', 'Insurance certificate', 'ins', 'Insurance renewal', 'insurance', ''],
    ['mot', 'MOT certificate', 'mot', 'MOT due', 'MOT', ''],
    ['service', 'Service record', 'service', 'Service due', 'service', 'is due'],
    ['v5', 'V5C logbook', '', '', '', ''],
    ['other', 'Other document', '', '', '', '']
  ],
  home: [
    ['insurance', 'Home insurance certificate', 'insRenewal', 'Home insurance renewal', 'insurance', ''],
    ['boiler', 'Boiler service record', 'boilerDue', 'Boiler service due', 'boiler service', 'is due'],
    [
      'eicr',
      'Electrical (EICR) report',
      'eicrDue',
      'Electrical check due',
      'electrical safety report (EICR)',
      ''
    ],
    ['mortgage', 'Mortgage offer or statement', 'dealEnd', 'Mortgage deal ends', 'mortgage deal', ''],
    ['energy', 'Energy contract', 'energyEnd', 'Energy deal ends', 'energy contract', ''],
    ['other', 'Other document', '', '', '', '']
  ]
};
function dsKind(id) {
  return id === '__home' ? 'home' : 'car';
}
function dsSubj(id) {
  if (id === '__home') return HOME && HOME.addr1 ? HOME : null;
  if (String(id).indexOf('__car:') === 0)
    return (
      carItems.filter(function (x) {
        return x.id === String(id).slice(6);
      })[0] || null
    );
  return null;
}
function dsPatch(id, up) {
  if (id === '__home') {
    homeWrite(Object.assign({}, HOME, up));
    return;
  }
  var cid = String(id).slice(6);
  carSave(
    carItems.map(function (x) {
      return x.id === cid ? Object.assign({}, x, up) : x;
    })
  );
}
function dsRoot(id) {
  return id === '__home' ? 'Home' : 'Cars';
}
function dsFolder(id, s) {
  return (
    (s.folder && s.folder.name) ||
    (id === '__home'
      ? pfClean(String(s.addr1 || '').split(/[\n,]/)[0]) || 'My home'
      : pfClean(carWho(s)) || 'Car')
  );
}
function dsTitle(id, s) {
  return id === '__home' ? 'Residential property · ' + short(s.addr1) : 'Car · ' + carWho(s);
}
function dsBody(id) {
  var s = dsSubj(id);
  if (!s) return '<p class="muted">Not found.</p>';
  var fl = s.files || [],
    w = (window.CD_files && window.CD_files.where && window.CD_files.where()) || 'your file storage',
    slots = DS_SLOTS[dsKind(id)];
  var h =
    '<p class="dxsrc">' +
    esc(dsTitle(id, s)) +
    '. Saved in your ' +
    esc(w) +
    ': <b>' +
    esc(dsRoot(id)) +
    ' › ' +
    esc(dsFolder(id, s)) +
    '</b>' +
    (s.folder && s.folder.url
      ? ' · <a href="' + esc(s.folder.url) + '" target="_blank" rel="noopener">Open folder</a>'
      : '') +
    '</p>';
  slots.forEach(function (sl) {
    var mine = fl
      .filter(function (f) {
        return f.k === sl[0];
      })
      .slice()
      .reverse();
    h +=
      '<section class="dsslot"><div class="dshd"><b>' +
      esc(sl[1]) +
      '</b><span>' +
      (dzTouch()
        ? '<button type="button" style="' +
          DZ_BTN +
          '" data-dsup="' +
          esc(sl[0]) +
          '" data-dscam="1">Take photo</button>'
        : '') +
      '<button type="button" style="' +
      DZ_BTN +
      '" data-dsup="' +
      esc(sl[0]) +
      '">Upload</button></span></div>' +
      mine
        .map(function (f) {
          return (
            '<div class="dsf"><span class="dsn"><a class="doclink" href="' +
            esc(f.url) +
            '" target="_blank" rel="noopener">' +
            esc(f.name) +
            '</a>' +
            (f.at ? '<small>Added ' + esc(fd(iso(new Date(f.at)))) + '</small>' : '') +
            '</span><button type="button" class="btn ghost sm danger" data-dsdel="' +
            esc(f.id) +
            '" aria-label="Delete ' +
            esc(f.name) +
            '">Delete</button></div>'
          );
        })
        .join('') +
      (sl[2] && !mine.length
        ? '<small class="muted">Upload it and we will read the date and set the reminder.</small>'
        : '') +
      '</section>';
  });
  return h;
}
function dsDraw(id) {
  var b = $('#dsBody'),
    bi = $('#dsBodyIn');
  if (b && $('#dsOv') && $('#dsOv').getAttribute('data-id') === id) b.innerHTML = dsBody(id);
  if (bi && $('#dsInline') && $('#dsInline').getAttribute('data-id') === id) bi.innerHTML = dsBody(id);
}
function dsOpen(id) {
  if (!dsSubj(id)) return;
  var old = $('#dsOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'dsOv';
  ov.className = 'dxov';
  ov.setAttribute('data-id', id);
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'dsT');
  ov.innerHTML =
    '<div class="dxbox dsbox"><div class="dshead"><h2 id="dsT">Documents</h2><button type="button" class="btn" data-dsclose="1">Done</button></div><div id="dsBody">' +
    dsBody(id) +
    '</div></div>';
  document.body.appendChild(ov);
  var kd = function (e) {
    if (e.key === 'Escape' && !$('#dxOv')) {
      ov.remove();
      document.removeEventListener('keydown', kd);
    }
  };
  document.addEventListener('keydown', kd);
}
function dsPick(id, k, cam) {
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
  inp.id = 'dsFile';
  inp.accept = cam
    ? 'image/*'
    : '.pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.xls,.xlsx,.txt,image/*,application/pdf';
  if (cam) inp.setAttribute('capture', 'environment');
  inp.style.display = 'none';
  var o = $('#dsFile');
  if (o) o.remove();
  document.body.appendChild(inp);
  inp.addEventListener('change', function () {
    var f = inp.files && inp.files[0];
    inp.remove();
    if (f) dsSend(id, k, f, cam);
  });
  inp.click();
}
function dsSend(id, k, file, cam) {
  var s = dsSubj(id);
  if (!s) return;
  if (!file.size) {
    toast('That file is empty.');
    return;
  }
  if (file.size > window.CD_files.max) {
    toast('That file is over 50 MB. Choose a smaller file.');
    return;
  }
  var slot = DS_SLOTS[dsKind(id)].filter(function (x) {
      return x[0] === k;
    })[0] || ['other', 'Other document', '', ''],
    oext = (/\.[A-Za-z0-9]{1,8}$/.exec(file.name) || [''])[0].toLowerCase(),
    folder = dsFolder(id, s),
    root = dsRoot(id),
    sent = null;
  dzBusy = true;
  toast('Uploading ' + (cam ? 'the photo' : file.name) + '…', true);
  rcPrep(file)
    .then(function (pp) {
      var blob = pp.blob,
        ext = pp.ext || oext,
        d = new Date(),
        z = function (n) {
          return String(n).padStart(2, '0');
        };
      sent = { blob: blob, name: file.name, type: blob.type || file.type || '' };
      var base = cam
        ? 'Photo ' + iso(TODAY) + ' ' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds())
        : pfClean(file.name.slice(0, file.name.length - oext.length), 100) || 'Document';
      var fname = k === 'other' ? base + ext : slot[1] + ' ' + iso(TODAY) + ext;
      if (
        (s.files || []).some(function (f) {
          return String(f.name).toLowerCase() === fname.toLowerCase();
        })
      )
        fname =
          fname.slice(0, fname.length - ext.length) +
          ' (added ' +
          z(d.getHours()) +
          z(d.getMinutes()) +
          z(d.getSeconds()) +
          ')' +
          ext;
      if (blob.size > window.CD_files.max) throw { big: true };
      return window.CD_files.upload(folder, fname, blob, undefined, root);
    })
    .then(
      function (res) {
        dzBusy = false;
        var cur = dsSubj(id) || s;
        var files = (cur.files || []).concat([
            {
              id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              k: k,
              name: res.name,
              url: res.url,
              fid: res.id,
              size: sent.blob.size,
              at: Date.now()
            }
          ]),
          up = { files: files };
        if (res.folder && res.folder.name && !(cur.folder && cur.folder.url)) up.folder = res.folder;
        dsPatch(id, up);
        toast('Uploaded to ' + root + ' › ' + folder);
        dsDraw(id);
        if (slot[0] !== 'v5') dsAfter(id, slot, sent, res);
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
/* a car or home document: read it, and set the date and the reminder */
function dsAfter(id, slot, sent, res) {
  var ref = id === '__home' ? { t: 'home' } : { t: 'car', id: String(id).slice(6) },
    fld = slot[2];
  expAfter({
    ref: ref,
    sent: sent,
    fid: res && res.id,
    fname: res && res.name,
    kind: 'end',
    word: slot[4] || null,
    verb: slot[5] || '',
    field: fld,
    fieldLabel: slot[3],
    cur: (dsSubj(id) || {})[fld] || '',
    applyField: function (v) {
      var cur = dsSubj(id);
      if (!cur) return;
      var up = {};
      up[fld] = v;
      if (cur.remDone && cur.remDone[fld]) {
        var nr = Object.assign({}, cur.remDone);
        delete nr[fld];
        up.remDone = nr;
      }
      dsPatch(id, up);
    }
  });
}
document.addEventListener(
  'click',
  function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b;
    if ((b = t.closest('[data-dsopen]'))) {
      e.preventDefault();
      dsOpen(b.getAttribute('data-dsopen'));
      return;
    }
    var ov = t.closest('#dsOv,#dsInline');
    if (!ov) return;
    var id = ov.getAttribute('data-id');
    if (ov.id === 'dsOv' && (t.closest('[data-dsclose]') || t === ov)) {
      ov.remove();
      return;
    }
    if ((b = t.closest('[data-dsup]'))) {
      e.preventDefault();
      var k = b.getAttribute('data-dsup'),
        cam = b.hasAttribute('data-dscam');
      dsPick(id, k, cam);
      return;
    }
    if ((b = t.closest('[data-dsdel]'))) {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Delete?';
        return;
      }
      var fid = b.getAttribute('data-dsdel'),
        s = dsSubj(id),
        f =
          s &&
          (s.files || []).filter(function (x) {
            return x.id === fid;
          })[0];
      if (!f) return;
      toast('Deleting…', true);
      fileDelete(f.fid).then(function (r) {
        if (r === 'offline' || r === 'fail') {
          toast(delFailMsg(r));
          b.classList.remove('armed');
          b.textContent = 'Delete';
          return;
        }
        var cur = dsSubj(id) || s,
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
        dsPatch(id, up);
        dsDraw(id);
        toast(delTell(r) + (up.expRems ? ' Its reminder was removed too.' : ''));
      });
    }
  },
  true
);
/* ---------- My Properties and Cars: one list for the home, rental properties and cars ---------- */
var carItems = [],
  carPageId = '',
  CAR_F = [
    ['mot', 'MOT due'],
    ['ins', 'Insurance renewal'],
    ['tax', 'Road tax due'],
    ['service', 'Service due']
  ];
function carReg(c) {
  return String(c.reg || '')
    .toUpperCase()
    .trim();
}
/* the registration drawn like a UK number plate; a car without one shows its make and model as plain bold text */
function carPlate(c) {
  return carReg(c) ? '<span class="plate">' + esc(carReg(c)) + '</span>' : esc(carWho(c));
}
function carWho(c) {
  return carReg(c) || [c.make, c.model].filter(Boolean).join(' ') || 'Car';
}
function carEvents() {
  var out = [];
  carItems.forEach(function (c) {
    CAR_F.forEach(function (f) {
      var exp = c[f[0]];
      if (!exp || !/^\d{4}-\d{2}-\d{2}$/.test(exp) || expHas(c, f[0], exp)) return;
      out.push({
        date: remDue(c.remDone && c.remDone[f[0]], exp, 1),
        label: f[1] + ' ' + fd(exp),
        kind: 'review',
        id: '__car:' + c.id,
        who: 'Car · ' + carWho(c),
        key: f[0],
        rep: 1,
        exp: exp
      });
    });
    expItems(c, 'car').forEach(function (i) {
      out.push({
        date: i.date,
        label: i.label,
        kind: 'review',
        id: '__car:' + c.id,
        who: 'Car · ' + carWho(c) + ' · ' + i.sx,
        key: i.key,
        rep: 1,
        exp: i.exp
      });
    });
  });
  return out;
}
function carSave(items) {
  carItems = items;
  if (setCol)
    write('set-cars', function () {
      return setCol.doc('cars').set({ items: items, updatedAt: Date.now() });
    });
  if ((view === 'assets' || view === 'mycar') && !$('#carOv')) render();
  renderSide();
  renderRem();
  renderNav();
}
function carOpen(id) {
  var c = id
    ? carItems.filter(function (x) {
        return x.id === id;
      })[0]
    : null;
  if (id && !c) return;
  c = c || {};
  var old = $('#carOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'carOv';
  ov.className = 'dxov';
  document.body.appendChild(ov);
  var dt = function (k, l, extra) {
    return (
      '<label class="dxf">' +
      l +
      '<input id="car-' +
      k +
      '" type="date" value="' +
      esc(c[k] || '') +
      '"></label>' +
      (extra || '')
    );
  };
  ov.innerHTML =
    '<form class="dxbox" id="carForm" role="dialog" aria-modal="true" aria-labelledby="carT" novalidate><h2 id="carT">' +
    (id ? 'Edit car' : 'Add a car') +
    '</h2>' +
    '<label class="dxf">Registration<input id="car-reg" maxlength="12" autocomplete="off" style="text-transform:uppercase" placeholder="For example: AB12 CDE" value="' +
    esc(c.reg || '') +
    '"></label>' +
    '<div class="carrow"><label class="dxf">Make<input id="car-make" maxlength="40" autocomplete="off" placeholder="Ford" value="' +
    esc(c.make || '') +
    '"></label><label class="dxf">Model<input id="car-model" maxlength="40" autocomplete="off" placeholder="Focus" value="' +
    esc(c.model || '') +
    '"></label></div>' +
    '<p class="dxnote" style="margin:0 0 10px">We remind you a month before each date. Leave any you do not need empty.</p>' +
    dt('mot', 'MOT due') +
    dt(
      'ins',
      'Insurance renewal',
      '<p class="dxo" style="margin:-6px 0 12px"><button type="button" class="btn ghost sm" id="carRead">Read the date from an insurance document</button> <input type="file" id="carFile" accept=".pdf,image/*" hidden> <span class="muted" style="font-size:12px">Read on this device. Nothing is sent anywhere.</span></p>'
    ) +
    dt('tax', 'Road tax due') +
    dt('service', 'Service due') +
    (id
      ? '<p class="dxo" style="margin:0 0 12px"><button type="button" class="btn ghost sm" data-dsopen="__car:' +
        esc(id) +
        '">Documents' +
        ((c.files || []).length ? ' (' + (c.files || []).length + ')' : '') +
        '</button> <span class="muted" style="font-size:12px">Insurance, MOT, service and logbook.</span></p>'
      : '<p class="dxnote" style="margin:0 0 12px">After you add the car, press <b>Documents</b> on its row to upload its insurance, MOT and other papers.</p>') +
    '<p id="carErr" role="alert" class="dxerr"></p><div class="dxbtns"><button type="submit" class="btn">' +
    (id ? 'Save changes' : 'Add car') +
    '</button><button type="button" class="btn ghost" id="carX">Cancel</button></div></form>';
  var close = function () {
      ov.remove();
      document.removeEventListener('keydown', kd);
    },
    kd = function (e) {
      if (e.key === 'Escape' && !$('#dxOv')) close();
    };
  document.addEventListener('keydown', kd);
  setTimeout(function () {
    /* focus the first box, unless the person has already started in another one */
    var ae = document.activeElement;
    if (ae && ae !== document.body && ov.contains(ae)) return;
    try {
      $('#car-reg').focus();
    } catch (e) {}
  }, 30);
  $('#carX').onclick = close;
  $('#carRead').onclick = function () {
    $('#carFile').click();
  };
  $('#carFile').onchange = function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    var pdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name),
      go = function (b) {
        dxAsk({
          title: 'Insurance renewal date',
          label: 'Insurance renewal',
          kind: 'end',
          blob: b,
          isPdf: pdf,
          cur: ($('#car-ins') || {}).value || '',
          apply: function (v) {
            var i = $('#car-ins');
            if (i) i.value = v;
          }
        });
      };
    if (pdf) go(f);
    else
      rcPrep(f).then(
        function (pp) {
          go(pp.blob);
        },
        function () {
          go(f);
        }
      );
  };
  $('#carForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var g = function (k) {
        return (($('#car-' + k) || {}).value || '').trim();
      },
      er = $('#carErr');
    var reg = g('reg').toUpperCase(),
      make = g('make'),
      model = g('model');
    if (!reg && !make && !model) {
      er.textContent = 'Add the registration, or the make and model.';
      $('#car-reg').focus();
      return;
    }
    var nc = {
      id: c.id || 'car' + uid() + Date.now().toString(36),
      reg: reg,
      make: make,
      model: model,
      remDone: Object.assign({}, c.remDone || {})
    };
    CAR_F.forEach(function (f) {
      var v = g(f[0]);
      nc[f[0]] = v;
      if (c[f[0]] !== v) delete nc.remDone[f[0]];
    });
    close();
    carSave(
      id
        ? carItems.map(function (x) {
            return x.id === id ? nc : x;
          })
        : carItems.concat([nc])
    );
    toast(id ? 'Saved' : 'Car added');
  });
}
function asChips(c, ks, t) {
  return ks
    .map(function (f) {
      var d = c[f[0]];
      return d && /^\d{4}-\d{2}-\d{2}$/.test(d)
        ? '<span class="aschip' +
            (d < t ? ' bad' : diff(d) <= 30 ? ' warn' : '') +
            '">' +
            esc(f[1].replace(/ (due|renewal)$/, '')) +
            ' ' +
            esc(fd(d)) +
            '</span>'
        : '';
    })
    .join('');
}
/* one car on its own page, like a rental property: its dates, Edit and Delete, and its documents */
function carPageHTML() {
  var c = carItems.filter(function (x) {
    return x.id === carPageId;
  })[0];
  if (!c) {
    view = 'assets';
    return assetsHTML();
  }
  var id = '__car:' + c.id;
  return (
    '<div class="pagehead"><h1>' +
    carPlate(c) +
    '</h1><button type="button" class="btn backbtn" data-asback="1">&larr; Back to My Properties and Cars</button></div>' +
    '<section class="ass"><h2>' +
    (carReg(c) && (c.make || c.model) ? esc([c.make, c.model].filter(Boolean).join(' ')) : 'Car') +
    '</h2><span class="aschips">' +
    (asChips(c, CAR_F, iso(TODAY)) || '<small>No dates added yet</small>') +
    '</span><p class="asact" style="margin:12px 0 0"><button type="button" class="btn ghost sm" data-ascar="' +
    esc(c.id) +
    '">Edit details and dates</button><button type="button" class="btn ghost sm danger" data-ascardel="' +
    esc(c.id) +
    '">Delete</button></p></section>' +
    '<section class="ass" style="margin-top:14px"><h2>Documents</h2><div id="dsInline" data-id="' +
    esc(id) +
    '"><div id="dsBodyIn">' +
    dsBody(id) +
    '</div></div></section>'
  );
}
function assetsHTML() {
  var t = iso(TODAY),
    hasHome = !!(HOME && HOME.addr1),
    landlordOther = !T.tenancyMode && (TRADES || []).indexOf('landlord') > -1;
  var h =
    '<div class="pagehead"><h1>My Properties and Cars</h1><div class="asadd"><button type="button" class="btn" id="asAdd" aria-haspopup="true" aria-expanded="false" aria-controls="asMenu">Add</button>' +
    '<div id="asMenu" class="asmenu" role="menu" hidden><button type="button" role="menuitem" data-asnew="res">Residential Property</button><button type="button" role="menuitem" data-asnew="inv">Investment Property</button><button type="button" role="menuitem" data-asnew="car">Car</button></div></div></div><div class="aswrap">';
  var due = function (c, ks) {
    return asChips(c, ks, t);
  };
  /* residential property */
  h += '<section class="ass" aria-labelledby="asH1"><h2 id="asH1">Residential property</h2>';
  if (hasHome) {
    var hev = homeEvents().sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    })[0];
    h +=
      '<button type="button" class="asrow" data-asopen="res"><span class="asic" aria-hidden="true">&#127968;</span><span class="astx"><b>' +
      esc(short(HOME.addr1)) +
      '</b><small>' +
      (hev
        ? esc(hev.label) + (hev.date < t ? ' · overdue' : '')
        : 'Open to add insurance, mortgage and service dates') +
      '</small></span><span class="asgo" aria-hidden="true">&rsaquo;</span></button>';
  } else
    h +=
      '<p class="muted astip">None yet. Press <b>Add</b>, then <b>Residential Property</b>, to keep your own home’s insurance, mortgage, boiler and energy dates.</p>';
  h += '</section>';
  /* cars */
  h += '<section class="ass" aria-labelledby="asH2"><h2 id="asH2">Cars</h2>';
  if (carItems.length)
    h += carItems
      .slice()
      .sort(function (a, b) {
        return carWho(a).localeCompare(carWho(b));
      })
      .map(function (c) {
        return (
          '<button type="button" class="asrow" data-ascarpage="' +
          esc(c.id) +
          '"><span class="asic" aria-hidden="true">&#128663;</span><span class="astx"><b>' +
          carPlate(c) +
          '</b>' +
          (carReg(c) && (c.make || c.model)
            ? '<small>' + esc([c.make, c.model].filter(Boolean).join(' ')) + '</small>'
            : '') +
          '<span class="aschips">' +
          (due(c, CAR_F) || '<small>No dates added yet</small>') +
          '</span></span><span class="asgo" aria-hidden="true">&rsaquo;</span></button>'
        );
      })
      .join('');
  else
    h +=
      '<p class="muted astip">None yet. Press <b>Add</b>, then <b>Car</b>, to be reminded about the MOT, insurance, road tax and service.</p>';
  h += '</section>';
  /* investment properties */
  if (T.tenancyMode)
    h += '<section class="ass asinv" aria-label="Investment properties">' + casesHTML(true) + '</section>';
  else if (landlordOther)
    h +=
      '<section class="ass" aria-labelledby="asH3"><h2 id="asH3">Investment properties</h2><button type="button" class="asrow" data-asinv="open"><span class="asic" aria-hidden="true">&#127969;</span><span class="astx"><b>Your rental properties are in your Landlord view</b><small>Open it to see them or add one</small></span><span class="asgo" aria-hidden="true">&rsaquo;</span></button></section>';
  return h + '</div>';
}
document.addEventListener(
  'click',
  function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b,
      m = $('#asMenu'),
      ab = $('#asAdd');
    if (m && !m.hidden && !t.closest('.asadd')) {
      m.hidden = true;
      if (ab) ab.setAttribute('aria-expanded', 'false');
    }
    if ((b = t.closest('#asAdd'))) {
      var open = m.hidden;
      m.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      if (open) {
        var f = m.querySelector('button');
        if (f) f.focus();
      }
      return;
    }
    if ((b = t.closest('[data-asnew]'))) {
      var k = b.getAttribute('data-asnew');
      if (m) m.hidden = true;
      if (ab) ab.setAttribute('aria-expanded', 'false');
      if (k === 'car') {
        carOpen(null);
        return;
      }
      if (k === 'res') {
        if (HOME && HOME.addr1) {
          toast('This is your residential property. Opening it.');
          view = 'myhome';
          render();
          window.scrollTo(0, 0);
        } else homeOpen();
        return;
      }
      if (k === 'inv') {
        if (T.tenancyMode) {
          qaOpen();
          return;
        }
        if ((TRADES || []).indexOf('landlord') > -1) {
          switchTrade('landlord');
          view = 'assets';
          render();
          setTimeout(qaOpen, 250);
          return;
        }
        toast('Investment properties are for landlords. Add Landlord to your trades first.');
        if (window.CD_openTrade) window.CD_openTrade();
        return;
      }
    }
    if (t.closest('[data-asopen="res"]')) {
      view = 'myhome';
      render();
      window.scrollTo(0, 0);
      return;
    }
    if ((b = t.closest('[data-ascarpage]'))) {
      carPageId = b.getAttribute('data-ascarpage');
      view = 'mycar';
      render();
      window.scrollTo(0, 0);
      return;
    }
    if (t.closest('[data-asinv="open"]')) {
      switchTrade('landlord');
      view = 'assets';
      render();
      window.scrollTo(0, 0);
      return;
    }
    if ((b = t.closest('[data-ascar]'))) {
      carOpen(b.getAttribute('data-ascar'));
      return;
    }
    if ((b = t.closest('[data-ascardel]'))) {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Delete?';
        return;
      }
      var id = b.getAttribute('data-ascardel'),
        dc = carItems.filter(function (x) {
          return x.id === id;
        })[0];
      if (
        dc &&
        (dc.files || []).length &&
        !confirm(
          'This car has ' +
            dc.files.length +
            ' uploaded document' +
            (dc.files.length === 1 ? '' : 's') +
            '. They stay in your Cars folder unless you delete them first. Delete the car anyway?'
        )
      ) {
        b.classList.remove('armed');
        b.textContent = 'Delete';
        return;
      }
      carSave(
        carItems.filter(function (x) {
          return x.id !== id;
        })
      );
      if (view === 'mycar') {
        view = 'assets';
        render();
        window.scrollTo(0, 0);
      }
      toast('Deleted');
      return;
    }
    if (t.closest('[data-asback]')) {
      view = 'assets';
      render();
      window.scrollTo(0, 0);
    }
  },
  true
);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var m = $('#asMenu');
    if (m && !m.hidden) {
      m.hidden = true;
      var ab = $('#asAdd');
      if (ab) {
        ab.setAttribute('aria-expanded', 'false');
        ab.focus();
      }
    }
  }
});
