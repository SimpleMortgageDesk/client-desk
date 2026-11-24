/* MySimpleDesk app: Duplicate finder.
   Looks through the records of the trade you are working in, finds records that look like the same thing entered twice,
   and offers to merge them. Nothing is changed until the user presses Merge, and the last merge can be undone.
   (A client with two different properties is NOT a duplicate: the property address must also match.) */
var dupMemo = { sig: '', groups: [] };
var DUP_SKIP = { id: 1, notes: 1, tasks: 1, protection: 1, applicants: 1, updatedAt: 1, createdAt: 1, tr: 1 };

function dupLS(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (e) {}
  return null;
}
function dupTxt(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function dupPerson(n) {
  return dupTxt(n)
    .replace(/\b(mr|mrs|miss|ms|mx|dr|prof|sir|lady|lord|rev)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
/* "Mr A Smith & Mrs B Smith" and "B SMITH, A SMITH" count as the same people */
function dupNameKey(c) {
  var list = [];
  if (isSpv(c) && String(c.companyName || '').trim()) list = [String(c.companyName)];
  else if (T && T.tenancyMode) list = [];
  else
    list = (c.applicants || []).map(function (x) {
      return x.name;
    });
  var ks = list.map(dupPerson).filter(Boolean).sort();
  return ks.join('|');
}
function dupAddr(c) {
  var a = String(c.propertyAddress || (typeof paddr === 'function' ? paddr(c) : '') || c.address || '');
  var pc = (a.toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/) || [''])[0].replace(/\s+/g, '');
  var no = (a.match(/\b\d+[a-zA-Z]?\b/) || [''])[0].toLowerCase();
  if (pc) return pc + '|' + no;
  return dupTxt(a).replace(/ /g, '');
}
function dupFilled(c) {
  var n = 0;
  Object.keys(c).forEach(function (k) {
    var v = c[k];
    if (DUP_SKIP[k]) return;
    if (v !== '' && v != null && !(Array.isArray(v) && !v.length)) n++;
  });
  (c.applicants || []).forEach(function (a) {
    n += Object.keys(a).filter(function (k) {
      return a[k];
    }).length;
  });
  return n + 3 * ((c.notes || []).length + (c.tasks || []).length);
}
function dupGroups() {
  var mine = cases.filter(function (c) {
    return trOf(c) === T.id;
  });
  var sig =
    T.id +
    '|' +
    mine.length +
    '|' +
    mine.reduce(function (m, c) {
      return Math.max(m, c.updatedAt || 0);
    }, 0);
  if (dupMemo.sig === sig) return dupMemo.groups;
  var by = {},
    out = [];
  mine.forEach(function (c) {
    var nk = dupNameKey(c),
      ak = dupAddr(c);
    if (!nk && !ak) return;
    (by[nk + '#' + ak] = by[nk + '#' + ak] || []).push(c);
  });
  var seen = {};
  Object.keys(by).forEach(function (k) {
    if (by[k].length < 2) return;
    by[k].forEach(function (c) {
      seen[c.id] = 1;
    });
    out.push({
      ids: by[k].map(function (c) {
        return c.id;
      }),
      why: k.split('#')[1] ? 'Same name and same address' : 'Same name, no address on any of them'
    });
  });
  /* same name where one has an address and the other has none: probably the same client entered twice */
  var byName = {};
  mine.forEach(function (c) {
    var nk = dupNameKey(c);
    if (nk && !(T && T.tenancyMode)) (byName[nk] = byName[nk] || []).push(c);
  });
  Object.keys(byName).forEach(function (nk) {
    var l = byName[nk];
    if (l.length < 2) return;
    var blank = l.filter(function (c) {
      return !dupAddr(c);
    });
    var rest = l.filter(function (c) {
      return dupAddr(c);
    });
    blank = blank.filter(function (c) {
      return !seen[c.id];
    });
    if (blank.length && rest.length) {
      /* only the blank ones join the nearest record; skip if the client clearly has several addresses */
      var target = rest.length === 1 ? rest[0] : null;
      if (target)
        out.push({
          ids: [target.id].concat(
            blank.map(function (c) {
              return c.id;
            })
          ),
          why: 'Same name, but one has no address'
        });
    }
  });
  var no = [];
  try {
    no = JSON.parse(dupLS('cd.dupNo') || '[]');
  } catch (e) {}
  out = out.filter(function (g) {
    return no.indexOf(g.ids.slice().sort().join(',')) < 0;
  });
  dupMemo = { sig: sig, groups: out };
  return out;
}
function dupBar() {
  if (!(typeof cases !== 'undefined' && cases.length > 1)) return '';
  var n = dupGroups().length;
  if (!n) return '';
  var until = +(dupLS('cd.dupSnooze') || 0);
  if (until > Date.now()) return '';
  return (
    '<div class="dupbar" role="status"><span><b>' +
    n +
    '</b> possible duplicate' +
    (n === 1 ? '' : 's') +
    ' found. Merging them keeps your list tidy.</span><button class="btn" data-act="dupes">Review</button><button class="btn ghost" data-act="dupsnooze">Not now</button></div>'
  );
}
function dupBtn() {
  var n = dupGroups().length;
  return (
    '<button class="btn ghost" data-act="dupes" title="Look for records entered twice and merge them">Find duplicates' +
    (n ? ' (' + n + ')' : '') +
    '</button>'
  );
}
function dupLine(c) {
  var bits = [];
  var ad = c.propertyAddress || (typeof paddr === 'function' ? paddr(c) : '') || c.address;
  if (c.clientNo) bits.push(esc(c.clientNo));
  if (ad) bits.push(esc(String(ad)));
  if (c.lender) bits.push(esc(c.lender));
  if (c.loanAmount) bits.push('£' + Number(c.loanAmount).toLocaleString('en-GB'));
  bits.push((c.notes || []).length + ' notes, ' + (c.tasks || []).length + ' tasks');
  if (c.updatedAt) bits.push('updated ' + new Date(c.updatedAt).toLocaleDateString('en-GB'));
  return bits.join(' · ');
}
function dupMerge(keep, others) {
  var m = JSON.parse(JSON.stringify(keep));
  var blank = function (v) {
    return v === '' || v == null || (Array.isArray(v) && !v.length);
  };
  others.forEach(function (o) {
    Object.keys(o).forEach(function (k) {
      if (DUP_SKIP[k]) return;
      if (blank(m[k]) && !blank(o[k])) m[k] = o[k];
      else if (
        o[k] &&
        m[k] &&
        typeof o[k] === 'object' &&
        typeof m[k] === 'object' &&
        !Array.isArray(o[k]) &&
        !Array.isArray(m[k])
      )
        Object.keys(o[k]).forEach(function (kk) {
          if (blank(m[k][kk])) m[k][kk] = o[k][kk];
        });
    });
    m.applicants = m.applicants || [];
    (o.applicants || []).forEach(function (a, i) {
      var key = dupPerson(a.name);
      var mine = m.applicants.filter(function (x) {
        return key && dupPerson(x.name) === key;
      })[0];
      if (!mine && !key) mine = m.applicants[i];
      if (mine)
        Object.keys(a).forEach(function (k) {
          if (!mine[k] && a[k]) mine[k] = a[k];
        });
      else if (key) m.applicants.push(a);
    });
    var same = function (arr, f) {
      var seen = {};
      arr.forEach(function (x) {
        seen[f(x)] = 1;
      });
      return seen;
    };
    ['notes', 'tasks', 'protection'].forEach(function (k) {
      if (!(o[k] || []).length) return;
      m[k] = m[k] || [];
      var f =
        k === 'notes'
          ? function (x) {
              return dupTxt(x.text) + '|' + (x.ts || '');
            }
          : k === 'tasks'
            ? function (x) {
                return dupTxt(x.text) + '|' + (x.due || x.date || '');
              }
            : function (x) {
                return JSON.stringify(x);
              };
      var seen = same(m[k], f);
      o[k].forEach(function (x) {
        if (!seen[f(x)]) {
          seen[f(x)] = 1;
          m[k].push(x);
        }
      });
    });
    if (blank(m.clientNo) && o.clientNo) m.clientNo = o.clientNo;
  });
  m.updatedAt = Date.now();
  delete m.id;
  return m;
}
function dupOpen() {
  var ov = $('#dupOv');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'dupOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:275;background:rgba(8,14,18,.6);display:flex;align-items:center;justify-content:center;padding:16px';
  document.body.appendChild(ov);
  var msg = '';
  var byId = function (id) {
    return cases.filter(function (c) {
      return c.id === id;
    })[0];
  };
  var draw = function () {
    var gs = dupGroups(),
      h = '';
    var undo = null;
    try {
      undo = JSON.parse(dupLS('cd.dupUndo') || 'null');
    } catch (e) {}
    gs.forEach(function (g, gi) {
      var recs = g.ids.map(byId).filter(Boolean);
      if (recs.length < 2) return;
      var best = recs.slice().sort(function (a, b) {
        return dupFilled(b) - dupFilled(a);
      })[0];
      h +=
        '<div class="dupg" style="border:1px solid #D4DDE5;border-radius:10px;padding:12px;margin:0 0 12px"><div style="font-size:12.5px;color:#58697A;margin-bottom:6px">' +
        esc(g.why) +
        '</div>' +
        recs
          .map(function (c) {
            return (
              '<label style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;cursor:pointer"><input type="radio" name="dk' +
              gi +
              '" value="' +
              esc(c.id) +
              '"' +
              (c.id === best.id ? ' checked' : '') +
              ' style="margin-top:4px"><span><b>' +
              esc(names(c)) +
              '</b><br><span style="font-size:13px;color:#58697A">' +
              dupLine(c) +
              '</span></span></label>'
            );
          })
          .join('') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" data-dm="' +
        gi +
        '">Merge into the selected one</button><button class="btn ghost" data-dn="' +
        gi +
        '">These are different</button></div></div>';
    });
    if (!h) h = '<p style="margin:8px 0 16px">No duplicates found. Everything looks tidy.</p>';
    ov.innerHTML =
      '<div role="dialog" aria-modal="true" aria-label="Find duplicates" style="background:#fff;color:#101C26;width:min(600px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:22px 24px;font:14.5px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,28,38,.3)"><h2 style="margin:0 0 6px;font-size:20px">Possible duplicates</h2><p style="margin:0 0 14px;color:#58697A;font-size:13.5px">Tick the record to keep. Merging fills its empty boxes from the others, brings across their notes and tasks, then removes the others. You can undo the last merge. A client with two different properties is not a duplicate.</p>' +
      (msg ? '<p style="margin:0 0 12px;font-weight:600;color:#0A6B50">' + msg + '</p>' : '') +
      h +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
      (undo ? '<button class="btn ghost" data-du="1">Undo last merge</button>' : '') +
      '<button class="btn" data-dx="1">Close</button></div></div>';
    ov.querySelectorAll('[data-dm]').forEach(function (b) {
      b.onclick = function () {
        var g = gs[+b.getAttribute('data-dm')];
        var sel = ov.querySelector('input[name="dk' + b.getAttribute('data-dm') + '"]:checked');
        if (!g || !sel) return;
        var keep = byId(sel.value),
          others = g.ids
            .filter(function (i) {
              return i !== sel.value;
            })
            .map(byId)
            .filter(Boolean);
        if (!keep || !others.length) return;
        var merged = dupMerge(keep, others);
        dupLS(
          'cd.dupUndo',
          JSON.stringify({
            keep: JSON.parse(JSON.stringify(keep)),
            removed: JSON.parse(JSON.stringify(others))
          })
        );
        var kid = keep.id;
        write(kid, function () {
          return col.doc(kid).update(merged);
        })
          .then(function () {
            return Promise.all(
              others.map(function (o) {
                return write(o.id, function () {
                  return col.doc(o.id).delete();
                });
              })
            );
          })
          .then(function () {
            dupMemo.sig = '';
            msg = 'Merged ' + (others.length + 1) + ' records into ' + esc(names(keep)) + '.';
            setTimeout(draw, 250);
          });
      };
    });
    ov.querySelectorAll('[data-dn]').forEach(function (b) {
      b.onclick = function () {
        var g = gs[+b.getAttribute('data-dn')];
        if (!g) return;
        var no = [];
        try {
          no = JSON.parse(dupLS('cd.dupNo') || '[]');
        } catch (e) {}
        no.push(g.ids.slice().sort().join(','));
        dupLS('cd.dupNo', JSON.stringify(no));
        dupMemo.sig = '';
        msg = 'Noted. These will not be suggested again.';
        draw();
      };
    });
    var u = ov.querySelector('[data-du]');
    if (u)
      u.onclick = function () {
        if (!undo) return;
        var all = [undo.keep].concat(undo.removed);
        Promise.all(
          all.map(function (d) {
            var id = d.id,
              body = JSON.parse(JSON.stringify(d));
            delete body.id;
            return write(id, function () {
              return col.doc(id).set(body);
            });
          })
        ).then(function () {
          dupLS('cd.dupUndo', null);
          dupMemo.sig = '';
          msg = 'The last merge was undone.';
          setTimeout(draw, 250);
        });
      };
    ov.querySelector('[data-dx]').onclick = function () {
      ov.remove();
      render();
    };
  };
  ov.onclick = function (ev) {
    if (ev.target === ov) {
      ov.remove();
      render();
    }
  };
  draw();
}
