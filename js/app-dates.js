'use strict';
/* MySimpleDesk app: Reading dates from uploaded documents, and the expiry reminders made from them.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- dates read from uploaded documents. Everything happens on this device: the document is never sent anywhere. ---------- */
var DX_MON = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};
function dxMk(y, m, d) {
  y = +y;
  m = +m;
  d = +d;
  if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100)) return null;
  var t = new Date(y, m - 1, d);
  return t.getMonth() === m - 1 ? iso(t) : null;
}
function dxMonN(s) {
  return DX_MON[String(s).slice(0, 3).toLowerCase()];
}
/* every date written in the text, with the words just before and after it */
function dxDates(text) {
  var s = String(text || '').replace(/\s+/g, ' '),
    out = [],
    taken = [];
  var MON =
    '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  var pats = [
    [
      new RegExp(
        '\\b(\\d{1,2})(?:st|nd|rd|th)?[ \\-\\/\\.]+' + MON + '\\.?,?[ \\-\\/\\.]+(\\d{4}|\\d{2})\\b',
        'gi'
      ),
      function (m) {
        return dxMk(m[3], dxMonN(m[2]), m[1]);
      }
    ],
    [
      new RegExp('\\b' + MON + '\\.? (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})\\b', 'gi'),
      function (m) {
        return dxMk(m[3], dxMonN(m[1]), m[2]);
      }
    ],
    [
      /\b(\d{4})-(\d{2})-(\d{2})\b/g,
      function (m) {
        return dxMk(m[1], m[2], m[3]);
      }
    ],
    [
      /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})\b/g,
      function (m) {
        var a = +m[1],
          b = +m[2];
        return b > 12 && a <= 12 ? dxMk(m[3], a, b) : dxMk(m[3], b, a);
      }
    ]
  ];
  pats.forEach(function (p) {
    var re = p[0],
      m;
    while ((m = re.exec(s))) {
      var st = m.index,
        en = st + m[0].length;
      if (
        taken.some(function (t) {
          return st < t[1] && en > t[0];
        })
      )
        continue;
      var v = p[1](m);
      if (!v) continue;
      taken.push([st, en]);
      out.push({
        iso: v,
        at: st,
        txt: m[0],
        before: s.slice(Math.max(0, st - 90), st).toLowerCase(),
        after: s.slice(en, en + 30).toLowerCase()
      });
    }
  });
  return out.sort(function (a, b) {
    return a.at - b.at;
  });
}
var DX_END =
  /(renewal|renews?|renew on|expiry|expires?|expiring|expiration|valid (?:until|till|to)|cover (?:ends?|until|to)|policy (?:ends?|expires)|end date|ends on|runs out|due (?:date|on|by)|next (?:due|inspection|review|test|service)|review date|until)/;
var DX_STARTW =
  /(issued?|issue date|date of issue|inception|start date|starts?|commenc\w*|effective(?: from| date)?|from|born|birth|dob|printed|statement|payment|premium|invoice)/;
var DX_ISS =
  /(date of (?:inspection|issue|test|assessment|check|service|certificate|report)|inspection date|issue date|issued(?: on)?|completed(?: on)?|tested(?: on)?|carried out(?: on)?|certificate date)/;
/* kind: 'end' = a renewal or expiry date; 'issue' = the date the certificate was done or issued */
function dxFind(text, kind) {
  var lo, hi;
  if (kind === 'issue') {
    lo = iso(new Date(TODAY.getFullYear() - 11, TODAY.getMonth(), TODAY.getDate()));
    hi = iso(new Date(Date.now() + 30 * 864e5));
  } else {
    lo = iso(new Date(TODAY.getFullYear() - 1, TODAY.getMonth(), TODAY.getDate()));
    hi = iso(new Date(TODAY.getFullYear() + 11, TODAY.getMonth(), TODAY.getDate()));
  }
  var list = dxDates(text)
    .filter(function (d) {
      return d.iso >= lo && d.iso <= hi;
    })
    .map(function (d) {
      var tail = d.before.slice(-45),
        near = d.before,
        sc = 0;
      if (kind === 'issue') {
        if (DX_ISS.test(tail)) sc += 6;
        else if (DX_ISS.test(near)) sc += 3;
        else if (/date\W{0,4}$/.test(tail)) sc += 2;
        if (DX_END.test(tail)) sc -= 5;
      } else {
        if (DX_END.test(tail)) sc += 6;
        else if (DX_END.test(near)) sc += 3;
        if (/(?:\bto|\buntil|-|–|—)\s*$/.test(tail) && /\d/.test(near.slice(0, -3))) sc += 4;
        if (DX_STARTW.test(tail.slice(-22)) && !DX_END.test(tail.slice(-22))) sc -= 5;
        if (/^\s*(?:to|-|–|—|until)\s+\S/.test(d.after)) sc -= 3;
      }
      return { iso: d.iso, score: sc, snip: (d.before.slice(-32) + d.txt).replace(/^\W+/, '').trim() };
    });
  list.sort(function (a, b) {
    return b.score - a.score || (kind === 'issue' ? (a.iso < b.iso ? -1 : 1) : a.iso < b.iso ? 1 : -1);
  });
  var seen = {},
    all = list.filter(function (d) {
      if (seen[d.iso]) return false;
      seen[d.iso] = 1;
      return true;
    });
  return { best: all.length && all[0].score >= 3 ? all[0] : null, all: all.slice(0, 4) };
}
var dxLib = {};
var PDFJS_WASM = '/lib/pdfjs/wasm/';
function dxLoad(src, asModule) {
  return (
    dxLib[src] ||
    (dxLib[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      if (asModule) s.type = 'module';
      s.src = src;
      s.onload = res;
      s.onerror = function () {
        delete dxLib[src];
        rej(new Error('Could not load the reader'));
      };
      document.head.appendChild(s);
    }))
  );
}
function dxPdf(blob) {
  return dxLoad('/lib/pdfjs/load.mjs', true)
    .then(function () {
      return blob.arrayBuffer();
    })
    .then(function (buf) {
      return window.pdfjsLib.getDocument({ data: buf, wasmUrl: PDFJS_WASM }).promise;
    })
    .then(function (doc) {
      var n = Math.min(doc.numPages, 4),
        out = '',
        i = 1;
      return (function next() {
        if (i > n) return { text: out, doc: doc };
        return doc
          .getPage(i++)
          .then(function (pg) {
            return pg.getTextContent();
          })
          .then(function (tc) {
            out +=
              tc.items
                .map(function (x) {
                  return x.str;
                })
                .join(' ') + '\n';
            return next();
          });
      })();
    });
}
/* a scanned PDF has no text: its first page is drawn to a picture so the photo reader can use it */
function dxPdfPic(doc) {
  return doc.getPage(1).then(function (pg) {
    var vp = pg.getViewport({ scale: 2 }),
      c = document.createElement('canvas');
    c.width = vp.width;
    c.height = vp.height;
    return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
      return new Promise(function (r) {
        c.toBlob(r, 'image/png');
      });
    });
  });
}
function dxOcr(blob, onp) {
  return dxLoad('/lib/tesseract/tesseract.min.js')
    .then(function () {
      return window.Tesseract.createWorker('eng', 1, {
        workerPath: '/lib/tesseract/worker.min.js',
        corePath: '/lib/tesseract/',
        langPath: '/lib/tesseract/lang/',
        workerBlobURL: false,
        logger: function (m) {
          if (onp && m && typeof m.progress === 'number') onp(m.status, m.progress);
        }
      });
    })
    .then(function (w) {
      return w.recognize(blob).then(
        function (r) {
          return w.terminate().then(
            function () {
              return r.data.text || '';
            },
            function () {
              return r.data.text || '';
            }
          );
        },
        function (e) {
          try {
            w.terminate();
          } catch (x) {}
          throw e;
        }
      );
    });
}
function dxField(k) {
  var f = ((T && T.fields) || []).filter(function (x) {
    return x.k === k;
  })[0];
  return f && f.t === 'date' ? f : null;
}
function dxKind(label) {
  return /renew|expir|runs out|due/i.test(label || '') ? 'end' : 'issue';
}
function dxLead(days) {
  return days === 0 ? 'On the day' : days + ' days before';
}
/* the question shown after an upload (or when someone asks to be reminded about a document) */
function dxAsk(o) {
  var old = $('#dxOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'dxOv';
  ov.className = 'dxov';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'dxT');
  document.body.appendChild(ov);
  var st = {
    iso: o.pre && o.pre.best ? o.pre.best.iso : o.cur || '',
    snip: o.pre && o.pre.best ? o.pre.best.snip : '',
    all: (o.pre && o.pre.all) || [],
    busy: '',
    ocr: false,
    note: '',
    lead: o.lead != null ? o.lead : 60
  };
  var doc = null,
    done = false;
  function close() {
    done = true;
    ov.remove();
    document.removeEventListener('keydown', esc2);
  }
  function esc2(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', esc2);
  function chips() {
    var a = st.all.filter(function (x) {
      return x.iso !== st.iso;
    });
    return a.length
      ? '<p class="dxo">Other dates in the document: ' +
          a
            .map(function (x) {
              return (
                '<button type="button" class="dxchip" data-dxpick="' +
                x.iso +
                '">' +
                esc(fd(x.iso)) +
                '</button>'
              );
            })
            .join(' ') +
          '</p>'
      : '';
  }
  function draw(keep) {
    var d0 = keep && $('#dxDate') ? $('#dxDate').value : st.iso;
    var msg = st.busy
      ? '<p class="dxsrc" role="status"><span class="dxspin" aria-hidden="true"></span> ' +
        esc(st.busy) +
        '</p>'
      : st.snip
        ? '<p class="dxsrc">We read this in your document: <i>&ldquo;' +
          esc(st.snip) +
          '&rdquo;</i>. Check it is right.</p>'
        : st.note
          ? '<p class="dxsrc">' + esc(st.note) + '</p>'
          : '<p class="dxsrc">' +
            (o.todo
              ? 'Choose the date it renews or runs out and we will remind you before.'
              : 'Choose the date, or leave it and add it later.') +
            '</p>';
    var ocr =
      st.ocr && !st.busy
        ? '<div class="dxocr"><p>' +
          (o.isPdf ? 'This PDF is a scan, so it has no text to read.' : 'This is a photo.') +
          ' We can try to read the date from the picture. The first time this downloads a small reader (about 4 MB) to this device.</p><button type="button" class="btn sm" data-dxocr="1">Read the date from it</button></div>'
        : '';
    var extra = o.done
      ? '<label class="dxf">Remind me<select id="dxLead">' +
        [90, 60, 30, 14, 0]
          .map(function (n) {
            return (
              '<option value="' + n + '"' + (n === st.lead ? ' selected' : '') + '>' + dxLead(n) + '</option>'
            );
          })
          .join('') +
        '</select></label>'
      : '';
    ov.innerHTML =
      '<div class="dxbox"><h2 id="dxT">' +
      esc(o.title) +
      '</h2>' +
      msg +
      ocr +
      (o.head ? '<p class="dxhead"><b>Reminder:</b> ' + esc(o.head) + '</p>' : '') +
      '<label class="dxf">' +
      esc(o.label || 'Date') +
      '<input id="dxDate" type="date" value="' +
      esc(d0) +
      '"></label>' +
      chips() +
      extra +
      '<p class="dxnote">Read on your device. Nothing from your document is sent anywhere.</p><p id="dxErr" role="alert" class="dxerr"></p>' +
      '<div class="dxbtns"><button type="button" class="btn" data-dxsave="1">' +
      (o.done ? 'Save and set reminder' : 'Save date') +
      '</button><button type="button" class="btn ghost" data-dxskip="1">Skip</button></div></div>';
    var di = $('#dxDate');
    if (di && !keep)
      try {
        di.focus();
      } catch (e) {}
  }
  function setBusy(m) {
    st.busy = m;
    draw(true);
  }
  function found(r, srcNote) {
    st.pre = r;
    st.all = r.all;
    if (r.best) {
      st.iso = r.best.iso;
      st.snip = r.best.snip;
      st.note = '';
    } else {
      st.snip = '';
      st.note = r.all.length
        ? 'We found dates but could not tell which one this is. Choose one below or type it.'
        : srcNote || 'We could not find a date in this document. Type it below.';
    }
    st.busy = '';
    draw(false);
  }
  ov.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var b;
    if (t === ov) {
      return;
    }
    if (t.closest('[data-dxskip]')) {
      close();
      return;
    }
    if ((b = t.closest('[data-dxpick]'))) {
      st.iso = b.getAttribute('data-dxpick');
      st.snip = '';
      draw(false);
      return;
    }
    if (t.closest('[data-dxocr]')) {
      setBusy('Getting the reader ready…');
      var go = function (blob) {
        return dxOcr(blob, function (s, p) {
          if (!done && st.busy)
            setBusy(
              (s === 'recognizing text' ? 'Reading the picture… ' : 'Getting the reader ready… ') +
                Math.round(p * 100) +
                '%'
            );
        }).then(
          function (txt) {
            if (done) return;
            found(dxFind(txt, o.kind || 'end'), 'We could not read a date from the picture. Type it below.');
          },
          function () {
            if (done) return;
            st.busy = '';
            st.note = 'The reader could not start on this device. Type the date below.';
            draw(false);
          }
        );
      };
      if (o.isPdf && doc)
        dxPdfPic(doc).then(go, function () {
          st.busy = '';
          st.note = 'Could not open the PDF. Type the date below.';
          draw(false);
        });
      else if (o.blob) go(o.blob);
      else {
        st.busy = '';
        draw(false);
      }
      return;
    }
    if (t.closest('[data-dxsave]')) {
      var iso0 = ($('#dxDate') || {}).value || '',
        er = $('#dxErr');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso0)) {
        er.textContent = 'Choose the date first.';
        return;
      }
      if (o.apply) {
        o.apply(iso0);
        close();
        toast(o.applyMsg || 'Date filled in. Press Save to keep it.');
        return;
      }
      if (o.done) {
        var lead = +(($('#dxLead') || {}).value || 60);
        close();
        o.done(iso0, lead);
        return;
      }
    }
  });
  draw(false);
  /* start reading */
  if (o.blob && o.isPdf) {
    setBusy('Reading your document…');
    dxPdf(o.blob).then(
      function (r) {
        if (done) return;
        doc = r.doc;
        if (r.text.replace(/\s/g, '').length < 40) {
          st.busy = '';
          st.ocr = true;
          st.note = '';
          draw(false);
          return;
        }
        found(dxFind(r.text, o.kind || 'end'));
      },
      function () {
        if (done) return;
        st.busy = '';
        st.note = 'Could not read this PDF. Type the date below.';
        draw(false);
      }
    );
  } else if (o.blob) {
    st.ocr = true;
    draw(false);
  }
}
/* puts the date into the record's field (the open form if it is open, so that it is not overwritten) */
function dxApply(o, v) {
  var el = $('#f-' + o.k);
  if (openId === o.id && el) {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(function () {
      try {
        autoSave();
      } catch (e) {}
    }, 400);
  }
  var up = {};
  up[o.k] = v;
  patch(o.id, up);
}
/* ---------- expiry reminders made from uploaded documents ---------- */
var EXP_LEAD = 60;
var EXP_WORDS = [
  [/insur/, 'insurance'],
  [/\bmot\b/, 'MOT'],
  [/gas safe|gas safety|cp12/, 'gas safety certificate'],
  [/eicr|electrical installation condition|electrical safety/, 'electrical safety report (EICR)'],
  [/energy performance|\bepc\b/, 'EPC'],
  [/licen[cs]e/, 'licence'],
  [/warrant|guarantee/, 'warranty'],
  [/\bdbs\b|disclosure and barring/, 'DBS certificate'],
  [/passport/, 'passport'],
  [/road tax|vehicle tax|\bved\b/, 'road tax'],
  [/breakdown|recovery cover/, 'breakdown cover'],
  [/boiler service|annual service/, 'boiler service'],
  [/mortgage/, 'mortgage deal'],
  [/tenancy agreement|assured shorthold/, 'tenancy agreement'],
  [/certificate/, 'certificate'],
  [/contract|agreement/, 'contract']
];
var EXP_FIELD_WORD = {
  insuranceRenewal: 'insurance',
  gsrDate: 'gas safety certificate',
  eicrDate: 'electrical safety report (EICR)',
  epcDate: 'EPC',
  licenceExpiry: 'licence'
};
function expWordFrom(text, name) {
  var t = (String(name || '') + ' ' + String(text || '').slice(0, 6000)).toLowerCase();
  for (var i = 0; i < EXP_WORDS.length; i++) if (EXP_WORDS[i][0].test(t)) return EXP_WORDS[i][1];
  return pfClean(String(name || '').replace(/\.[A-Za-z0-9]{1,5}$/, ''), 40).toLowerCase() || 'document';
}
function expSubjLabel(type, s) {
  if (type === 'car') return 'this car (' + carWho(s) + ')';
  if (type === 'home') return 'your home (' + short(s.addr1) + ')';
  return 'this ' + (T.tenancyMode ? 'property' : N1().toLowerCase()) + ' (' + names(s) + ')';
}
function expHead(type, s, r) {
  return (
    'Your ' +
    (r.word || 'document') +
    ' for ' +
    expSubjLabel(type, s) +
    ' ' +
    (r.verb || 'is due for renewal')
  );
}
/* the reminders for a record (a rental property or job, the home, or a car): 60 days before the expiry date, then every 30 days until dealt with */
function expItems(s, type) {
  return ((s && s.expRems) || []).map(function (r) {
    var lead = r.lead == null ? EXP_LEAD : r.lead,
      base = addDays(r.exp, -lead),
      key = 'ex:' + r.id,
      sn = s.remDone && s.remDone[key],
      date = /^\d{4}-\d{2}-\d{2}$/.test(sn || '') && sn >= base ? addDays(sn, 30) : base;
    var hd = expHead(type, s, r);
    return {
      date: date,
      label: hd,
      head: hd,
      sx: 'expires ' + fd(r.exp),
      key: key,
      sec: false,
      rep: 1,
      exp: r.exp
    };
  });
}
/* the older date-field reminder for the same date is not shown as well */
function expHas(s, fk, exp) {
  return (
    !!fk &&
    ((s && s.expRems) || []).some(function (r) {
      return r.fk === fk && r.exp === exp;
    })
  );
}
function expSubjOf(ref) {
  return ref.t === 'home'
    ? HOME && HOME.addr1
      ? HOME
      : null
    : ref.t === 'car'
      ? dsSubj('__car:' + ref.id)
      : cases.filter(function (x) {
          return x.id === ref.id;
        })[0] || null;
}
function expWrite(ref, list) {
  if (ref.t === 'home') homeWrite(Object.assign({}, HOME, { expRems: list }));
  else if (ref.t === 'car') dsPatch('__car:' + ref.id, { expRems: list });
  else patch(ref.id, { expRems: list });
}
function expCreate(ref, o) {
  var s = expSubjOf(ref);
  if (!s) return null;
  var rem = {
    id: 'er' + uid() + Date.now().toString(36),
    fk: o.fk || '',
    exp: o.exp,
    word: o.word || 'document',
    verb: o.verb || 'is due for renewal',
    lead: o.lead == null ? EXP_LEAD : o.lead,
    fid: o.fid || '',
    fname: o.fname || '',
    at: Date.now()
  };
  /* a renewed document replaces the earlier reminder for the same thing */
  var list = (s.expRems || [])
    .filter(function (r) {
      return !((rem.fk && r.fk === rem.fk) || (r.word === rem.word && r.exp <= rem.exp));
    })
    .concat([rem]);
  expWrite(ref, list);
  return rem;
}
function expTell(ref, rem) {
  var due = addDays(rem.exp, -rem.lead);
  return (
    'Your ' +
    rem.word +
    ' expires on ' +
    fd(rem.exp) +
    '. ' +
    (due <= iso(TODAY)
      ? 'The reminder is in your Reminders now.'
      : 'We will remind you on ' + fd(due) + ' (' + rem.lead + ' days before).')
  );
}
/* sets the date (when the document sits next to a date field) and the reminder */
function expDone(o, found, lead) {
  var exp = found,
    fk = '';
  if (o.field) {
    if (o.applyField) o.applyField(found);
    fk = o.field;
  }
  if (o.kind === 'issue') {
    if (!o.months) return null;
    exp = addMonths(found, o.months);
    fk = o.dueKey || '';
    if (o.applyDue) o.applyDue(exp);
  }
  return expCreate(o.ref, {
    fk: fk,
    exp: exp,
    word: o.word,
    verb: o.verb,
    fid: o.fid,
    fname: o.fname,
    lead: lead
  });
}
/* after an upload: read the document, and when it clearly names an expiry date set the reminder automatically; otherwise ask */
function expAfter(o) {
  var sent = o.sent;
  if (!sent) return;
  var isPdf = /pdf/i.test(sent.type || '') || /\.pdf$/i.test(sent.name || ''),
    isImg = /^image\//.test(sent.type || ''),
    linked = !!o.field;
  var ask = function (oo) {
    var s = expSubjOf(oo.ref),
      head = s
        ? expHead(oo.ref.t === 'home' ? 'home' : oo.ref.t === 'car' ? 'car' : 'case', s, {
            word: oo.word,
            verb: oo.verb
          })
        : '';
    dxAsk({
      title: linked ? 'When is the date on this document?' : 'Remind you about this document?',
      label: oo.fieldLabel || 'Expiry or renewal date',
      kind: oo.kind,
      head: head,
      blob: isPdf || isImg ? sent.blob : null,
      isPdf: isPdf,
      cur: oo.cur || '',
      lead: EXP_LEAD,
      done: function (v, lead) {
        var rem = expDone(oo, v, lead);
        if (rem) toast(expTell(oo.ref, rem));
      }
    });
  };
  if (isPdf) {
    toast('Reading your document for an expiry date…');
    dxPdf(sent.blob).then(
      function (r) {
        var oo = Object.assign({}, o, { word: o.word || expWordFrom(r.text, sent.name) }),
          b = dxFind(r.text, oo.kind).best;
        if (b && b.score >= 6) {
          var rem = expDone(oo, b.iso, EXP_LEAD);
          if (rem) toast(expTell(oo.ref, rem));
          return;
        }
        if (linked) ask(oo);
      },
      function () {
        if (linked) ask(Object.assign({}, o, { word: o.word || expWordFrom('', sent.name) }));
      }
    );
  } else if (linked) ask(Object.assign({}, o, { word: o.word || expWordFrom('', sent.name) }));
}
/* a reminder asked for by hand on a document (the Remind me link) */
function expManual(ref, f) {
  var s = expSubjOf(ref),
    word = expWordFrom('', f.name);
  dxAsk({
    title: 'Remind you about this document?',
    label: 'Expiry or renewal date',
    kind: 'end',
    head: s ? expHead(ref.t || 'case', s, { word: word }) : '',
    lead: EXP_LEAD,
    done: function (v, lead) {
      var rem = expCreate(ref, { fk: '', exp: v, word: word, lead: lead, fid: f.fid, fname: f.name });
      if (rem) toast(expTell(ref, rem));
    }
  });
}
/* called after a document has been uploaded to a rental property or a job */
function dxAfter(id, k, sent, res) {
  if (!sent) return;
  var f = k === 'other' ? null : dxField(k),
    o = { ref: { t: 'case', id: id }, sent: sent, fid: res && res.id, fname: res && res.name, kind: 'end' };
  if (f) {
    o.field = k;
    o.fieldLabel = f.l;
    o.kind = dxKind(f.l);
    o.word = EXP_FIELD_WORD[k] || null;
    o.cur =
      (cases.filter(function (x) {
        return x.id === id;
      })[0] || {})[k] || '';
    o.applyField = function (v) {
      dxApply({ id: id, k: k }, v);
    };
    if (o.kind === 'issue') {
      var due = (T.fields || []).filter(function (x) {
        return x.auto && x.auto.from === k;
      })[0];
      if (due) {
        o.months = due.auto.m;
        o.dueKey = due.k;
        o.applyDue = function (v) {
          dxApply({ id: id, k: due.k }, v);
        };
      }
    }
  }
  expAfter(o);
}
window.CD_dxFind = dxFind;
window.CD_dxAfter = dxAfter;
window.CD_dxAsk = dxAsk;
