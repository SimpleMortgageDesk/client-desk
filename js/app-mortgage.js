'use strict';
/* MySimpleDesk app: Mortgage adviser extras: where each applicant lives (the Main residence table), companies' directors' own properties,
   tidying client numbers, and numbering cases that have no client number.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */

/* ---------- people and addresses ---------- */
function pNm(p) {
  return String(p.name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^(mr|mrs|miss|ms|mx|dr|prof|sir|lady|lord)\.?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function samePerson(a, b) {
  var x = pNm(a);
  return !!x && x === pNm(b) && (!a.dob || !b.dob || a.dob === b.dob);
}
function normAddr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/* ---------- where each applicant lives now ---------- */
var RES_ST = [
  ['', 'Not asked'],
  ['owner', 'Owner (owns the property)'],
  ['renting', 'Renting'],
  ['parents', 'Living with parents'],
  ['other', 'Other']
];
function resSt(a) {
  return a.resStatus || (a.resMort ? 'owner' : '');
}
function resLabel(s) {
  var r = RES_ST.filter(function (x) {
    return x[0] === s;
  })[0];
  return s && r ? r[1].replace(' (owns the property)', '') : '';
}
function resScore(a) {
  var s = 0;
  if (resSt(a)) s += 4;
  if (a.resMort) s += 2;
  if (a.address) s += 1;
  ['resLender', 'resType', 'resDealEnd', 'resBalance', 'resOwn', 'resRate'].forEach(function (k) {
    if (a[k]) s += 1;
  });
  return s;
}
/* the extra questions under an applicant's address (owner? mortgage on it? lender, type, deal end, rate, balance, owned by) */
function resFieldsHTML(a) {
  var opt = function (list, cur) {
    return list
      .map(function (u) {
        return '<option value="' + u[0] + '"' + (cur === u[0] ? ' selected' : '') + '>' + u[1] + '</option>';
      })
      .join('');
  };
  return (
    '<label class="f">Living at this address as<select data-a="resStatus">' +
    opt(RES_ST, resSt(a)) +
    '</select></label>' +
    '<label class="f resown"' +
    (resSt(a) === 'owner' ? '' : ' hidden') +
    '>Do you have a mortgage on this address?<select data-a="resMort">' +
    opt(
      [
        ['', 'Not asked'],
        ['no', 'No (owned outright)'],
        ['yes', 'Yes']
      ],
      a.resMort || ''
    ) +
    '</select></label></div>' +
    '<div class="grid resm"' +
    (resSt(a) === 'owner' && a.resMort === 'yes' ? '' : ' hidden') +
    '>' +
    '<label class="f">Current lender<input data-a="resLender" value="' +
    esc(a.resLender) +
    '"></label>' +
    '<label class="f">Mortgage type<select data-a="resType">' +
    opt(
      [
        ['', 'Choose…'],
        ['repayment', 'Repayment'],
        ['interest-only', 'Interest only'],
        ['part-and-part', 'Part and part']
      ],
      a.resType || ''
    ) +
    '</select></label>' +
    '<label class="f">Current deal ends<input data-a="resDealEnd" type="date" value="' +
    esc(a.resDealEnd) +
    '"></label>' +
    '<label class="f">Interest rate (%)<input data-a="resRate" type="number" min="0" step="0.01" value="' +
    esc(a.resRate) +
    '"></label>' +
    '<label class="f">Approx. balance (£)<input data-a="resBalance" type="number" min="0" step="1" value="' +
    esc(a.resBalance) +
    '"></label>' +
    '<label class="f">Owned by<select data-a="resOwn">' +
    opt(
      [
        ['', 'Choose…'],
        ['sole', 'Sole name'],
        ['joint', 'Joint names']
      ],
      a.resOwn || ''
    ) +
    '</select></label></div>'
  );
}
document.addEventListener('change', function (e) {
  var x = e.target;
  if (!x || !x.getAttribute) return;
  var k = x.getAttribute('data-a');
  if (k === 'resStatus') {
    var rw = x.closest('.app');
    if (!rw) return;
    var own = x.value === 'owner',
      om = rw.querySelector('[data-a="resMort"]'),
      rl = rw.querySelector('.resown'),
      rb = rw.querySelector('.resm');
    if (rl) rl.hidden = !own;
    if (rb) rb.hidden = !(own && om && om.value === 'yes');
  } else if (k === 'resMort') {
    var row = x.closest('.app'),
      bx = row && row.querySelector('.resm');
    if (bx) {
      bx.hidden = x.value !== 'yes';
      if (x.value === 'yes') {
        var f = bx.querySelector('input');
        if (f) f.focus();
      }
    }
  }
});

/* the table header, shared by the cases table and the lists below it */
function caseHeadHTML() {
  return (
    '<div class="tw"><table><thead><tr><th class="cnoh">No.</th><th>Client</th>' +
    T.cols
      .filter(function (x) {
        return colOn(x[0]);
      })
      .map(function (x) {
        return '<th>' + esc(x[1]) + '</th>';
      })
      .join('') +
    '</tr></thead><tbody>'
  );
}
/* under a search: each person's main residence, taken from the most complete record of them on any case */
function resHTML(list) {
  if (!query.trim()) return '';
  var persons = [];
  list.forEach(function (c) {
    (c.applicants || []).forEach(function (p) {
      if (
        pNm(p) &&
        !persons.some(function (q) {
          return samePerson(q.p, p);
        })
      )
        persons.push({ p: p, c: c });
    });
  });
  var rows = [];
  persons.forEach(function (x) {
    var best = null;
    cases.forEach(function (c) {
      (c.applicants || []).forEach(function (a) {
        if (samePerson(a, x.p) && (!best || resScore(a) > resScore(best))) best = a;
      });
    });
    if (!best || (!best.address && !resSt(best))) return;
    var key =
      clientKey(x.c) +
      '|' +
      normAddr(best.address) +
      '|' +
      resSt(best) +
      '|' +
      (best.resMort || '') +
      '|' +
      (best.resLender || '');
    var ex = rows.filter(function (r) {
      return r.key === key;
    })[0];
    if (ex) {
      ex.names.push(x.p.name);
      return;
    }
    rows.push({ key: key, names: [x.p.name], a: best, c: x.c });
  });
  var h = '<div class="resprops"><h3 style="margin:18px 0 6px">Main residence</h3>';
  if (!rows.length)
    return (
      h +
      '<div class="muted">No residential details are recorded for these clients yet. Open a case and fill in "Living at this address as" under the applicant.</div></div>'
    );
  h +=
    '<div class="tw"><table><thead><tr><th class="cnoh">No.</th><th>Client</th><th>Address</th><th>Living as</th><th>Mortgage</th><th>Lender</th><th>Type</th><th>Deal ends</th><th>Rate</th><th>Balance</th><th>Owned by</th></tr></thead><tbody>';
  var dash = '<span class="muted">—</span>';
  rows.forEach(function (r) {
    var a = r.a,
      st = resSt(a),
      own = st === 'owner',
      mt = own && a.resMort === 'yes',
      typ =
        { repayment: 'Repayment', 'interest-only': 'Interest only', 'part-and-part': 'Part and part' }[
          a.resType
        ] || '';
    h +=
      '<tr class="click" data-open="' +
      r.c.id +
      '"><td class="cnocol">' +
      esc(r.c.clientNo || '') +
      '</td><td><b>' +
      esc(r.names.join(' & ')) +
      '</b></td><td>' +
      (esc(a.address) || dash) +
      '</td><td>' +
      (esc(resLabel(st)) || '<span class="muted">Not asked</span>') +
      '</td><td>' +
      (own
        ? a.resMort === 'yes'
          ? 'Yes'
          : a.resMort === 'no'
            ? 'No (owned outright)'
            : '<span class="muted">Not asked</span>'
        : dash) +
      '</td><td>' +
      (mt && a.resLender ? esc(a.resLender) : dash) +
      '</td><td>' +
      (mt && typ ? typ : dash) +
      '</td><td>' +
      (mt && a.resDealEnd ? fd(a.resDealEnd) : dash) +
      '</td><td>' +
      (mt && a.resRate ? esc(a.resRate) + '%' : dash) +
      '</td><td>' +
      (mt && a.resBalance ? '£' + Number(a.resBalance).toLocaleString('en-GB') : dash) +
      '</td><td>' +
      (own && a.resOwn ? (a.resOwn === 'joint' ? 'Joint names' : 'Sole name') : dash) +
      '</td></tr>';
  });
  return h + '</tbody></table></div></div>';
}
/* under a search that matches a company: the properties its directors hold in their own names */
function dirPropsHTML(list) {
  if (!query.trim()) return '';
  var seen = {},
    cos = [];
  list.forEach(function (c) {
    if (!isSpv(c)) return;
    var k = clientKey(c);
    if (seen[k]) return;
    seen[k] = 1;
    cos.push(c);
  });
  var out = '';
  cos.forEach(function (c0) {
    var k = clientKey(c0),
      dirs = [];
    cases
      .filter(function (x) {
        return clientKey(x) === k;
      })
      .forEach(function (x) {
        (x.applicants || []).forEach(function (p) {
          if (
            pNm(p) &&
            !dirs.some(function (d) {
              return samePerson(d, p);
            })
          )
            dirs.push(p);
        });
      });
    if (!dirs.length) return;
    var joint = [],
      sole = [],
      other = [],
      maybe = [];
    cases.forEach(function (x) {
      if (isSpv(x)) return;
      var ap = (x.applicants || []).filter(function (p) {
          return pNm(p);
        }),
        m = ap.filter(function (p) {
          return dirs.some(function (d) {
            return samePerson(d, p);
          });
        });
      if (!m.length) {
        if (
          ap.some(function (p) {
            return dirs.some(function (d) {
              return pNm(d) === pNm(p);
            });
          })
        )
          maybe.push(x);
        return;
      }
      if (m.length >= 2) joint.push(x);
      else if (ap.length === 1) sole.push(x);
      else other.push(x);
    });
    var cols = T.cols.filter(function (x) {
        return colOn(x[0]);
      }).length,
      sec = function (title, arr) {
        var hd =
          '<tr class="cg"><td colspan="' +
          (cols + 2) +
          '"><b>' +
          title +
          '</b> <span class="muted">· ' +
          arr.length +
          '</span></td></tr>';
        if (!arr.length)
          return hd + '<tr><td colspan="' + (cols + 2) + '" class="muted">None found</td></tr>';
        return (
          hd +
          arr
            .map(function (x) {
              return caseRowHTML(x, true);
            })
            .join('')
        );
      };
    var body =
      sec('Owned jointly by the directors', joint) +
      sec('Owned in a director’s sole name', sole) +
      sec('Owned by a director with someone else', other) +
      (maybe.length ? sec('Possible matches: same name, different date of birth', maybe) : '');
    out +=
      '<div class="dirprops"><h3 style="margin:18px 0 6px">Properties the directors of ' +
      esc(names(c0)) +
      ' hold personally</h3><div class="muted" style="font-size:13px;margin-bottom:6px">Directors: ' +
      esc(
        dirs
          .map(function (d) {
            return d.name;
          })
          .join(', ')
      ) +
      '</div>' +
      caseHeadHTML() +
      body +
      '</tbody></table></div></div>';
  });
  return out;
}

/* ---------- client numbers: one per client, none shared by two clients ---------- */
function noVal(s) {
  var m = /(\d+)/.exec(s || '');
  return m ? +m[1] : 1e9;
}
function planNos() {
  var grp = {};
  cases.forEach(function (c) {
    var k = clientKey(c);
    (grp[k] = grp[k] || []).push(c);
  });
  var plan = {},
    used = {},
    maxN = 0;
  cases.forEach(function (c) {
    var r = /^C(\d+)$/i.exec(c.clientNo || '');
    if (r) maxN = Math.max(maxN, +r[1]);
  });
  Object.keys(grp).forEach(function (k) {
    var g = grp[k],
      nos = [],
      seen = {};
    g.forEach(function (c) {
      if (c.clientNo && !seen[c.clientNo]) {
        seen[c.clientNo] = 1;
        nos.push(c.clientNo);
      }
    });
    nos.sort(function (a, b) {
      return noVal(a) - noVal(b);
    });
    var keep = nos[0] || '';
    if (nos.length > 1)
      plan[k] = {
        k: k,
        label: names(g[0]),
        ids: g
          .filter(function (c) {
            return c.clientNo && c.clientNo !== keep;
          })
          .map(function (c) {
            return c.id;
          }),
        from: nos.slice(1),
        to: keep,
        count: g.length,
        why: 'Same client had ' + nos.length + ' numbers (' + nos.join(', ') + ')'
      };
    if (keep)
      (used[keep] = used[keep] || []).push({
        k: k,
        t: Math.min.apply(
          null,
          g.map(function (c) {
            return c.createdAt || 0;
          })
        ),
        g: g,
        nos: nos
      });
  });
  Object.keys(used).forEach(function (no) {
    var u = used[no];
    if (u.length < 2) return;
    u.sort(function (a, b) {
      return a.t - b.t;
    });
    u.slice(1).forEach(function (x) {
      maxN++;
      var nn = 'C' + String(maxN).padStart(3, '0');
      plan[x.k] = {
        k: x.k,
        label: names(x.g[0]),
        ids: x.g.map(function (c) {
          return c.id;
        }),
        from: x.nos.slice(),
        to: nn,
        count: x.g.length,
        why: 'Number ' + no + ' was also used by another client (' + names(u[0].g[0]) + ')'
      };
    });
  });
  return Object.keys(plan)
    .map(function (k) {
      return plan[k];
    })
    .sort(function (a, b) {
      return noVal(a.to) - noVal(b.to);
    });
}
function openTidyNos() {
  var old = document.getElementById('tdOv');
  if (old) old.remove();
  var pl = planNos();
  if (!pl.length) {
    toast('Every client already has one number');
    return;
  }
  var ov = document.createElement('div');
  ov.id = 'tdOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:270;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div role="dialog" aria-modal="true" aria-label="Tidy client numbers" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(640px,100%);max-height:88vh;display:flex;flex-direction:column;border-radius:12px;padding:20px 22px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h2 style="margin:0;font-size:20px">Tidy client numbers</h2><button type="button" class="btn ghost" id="tdX">Cancel</button></div>' +
    '<div class="muted" style="font-size:13px;margin-bottom:10px">Each client keeps their lowest (oldest) number. Untick any change you do not want. Only the client number changes; nothing else on the case is touched.</div>' +
    '<div style="overflow:auto;border:1px solid var(--line,#D4DBDF);border-radius:8px">' +
    pl
      .map(function (p, i) {
        return (
          '<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--line,#E5EAED);cursor:pointer"><input type="checkbox" data-tdi="' +
          i +
          '" checked style="margin-top:3px"><span><b>' +
          esc(p.label) +
          '</b> · ' +
          esc(p.from.join(', ')) +
          ' → <b>' +
          esc(p.to) +
          '</b><br><span class="muted" style="font-size:12.5px">' +
          esc(p.why) +
          ' · ' +
          p.ids.length +
          ' case' +
          (p.ids.length === 1 ? '' : 's') +
          ' change</span></span></label>'
        );
      })
      .join('') +
    '</div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button type="button" class="btn" id="tdGo">Apply changes</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function (e) {
    if (e.target === ov) ov.remove();
  });
  ov.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.id === 'tdX') {
      ov.remove();
      return;
    }
    if (b.id !== 'tdGo') return;
    var jobs = [],
      n = 0;
    ov.querySelectorAll('[data-tdi]').forEach(function (x) {
      if (!x.checked) return;
      var p = pl[+x.getAttribute('data-tdi')];
      n++;
      p.ids.forEach(function (id) {
        jobs.push(patch(id, { clientNo: p.to }));
      });
    });
    ov.remove();
    Promise.all(jobs).then(
      function () {
        toast(n ? 'Tidied ' + n + ' client' + (n === 1 ? '' : 's') : 'No changes made');
      },
      function () {
        toast('Some changes could not be saved. Try again.');
      }
    );
  });
}
/* a case with no client number takes its client's number, or the next free one (a few seconds after the records have loaded) */
var nosReady = false,
  fillBusy = false;
if (window.CD_firstPull)
  window.CD_firstPull.then(function () {
    nosReady = true;
  });
function fillClientNos() {
  if (T.id !== 'mortgage' || fillBusy || !nosReady || !col || !cases.length) return;
  var miss = cases
    .filter(function (c) {
      return !c.clientNo;
    })
    .sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  if (!miss.length) return;
  fillBusy = true;
  var done = [],
    local = cases.map(function (c) {
      return { id: c.id, clientNo: c.clientNo, applicants: c.applicants };
    }),
    nextLocal = function () {
      var m = 0;
      local.forEach(function (c) {
        var r = /^C(\d+)$/i.exec(c.clientNo || '');
        if (r) m = Math.max(m, +r[1]);
      });
      return 'C' + String(m + 1).padStart(3, '0');
    };
  miss.forEach(function (c) {
    var k = clientKey(c),
      sib = local.filter(function (x) {
        return x.clientNo && clientKey(x) === k;
      })[0],
      no = sib ? sib.clientNo : nextLocal();
    local.filter(function (x) {
      return x.id === c.id;
    })[0].clientNo = no;
    done.push(patch(c.id, { clientNo: no }));
  });
  Promise.all(done).then(
    function () {
      fillBusy = false;
    },
    function () {
      fillBusy = false;
    }
  );
}
setInterval(fillClientNos, 8000);
