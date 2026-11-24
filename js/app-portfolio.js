'use strict';
/* MySimpleDesk app: Mortgage adviser: Portfolio summary. Fills in a client\'s buy to let cases for the Personal Portfolio Summary form,
   as a PDF or a table to paste into a spreadsheet. The values typed in (property type, year purchased, rental income, service charge,
   ground rent, missed payments) are held only while the window is open and are never saved.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */

/* ---------- a small PDF writer (landscape A4 tables) ---------- */
var HWID = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556,
  556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278,
  500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469,
  556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
  278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];
function pwid(s, sz, b) {
  var w = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    w += c >= 32 && c <= 126 ? HWID[c - 32] : 556;
  }
  return ((w * sz) / 1000) * (b ? 1.07 : 1);
}
function pwrap(s, w, sz, b) {
  var out = [];
  String(s)
    .split('\n')
    .forEach(function (par) {
      var words = par.split(/\s+/).filter(Boolean),
        line = '';
      if (!words.length) {
        out.push('');
        return;
      }
      words.forEach(function (wd) {
        while (pwid(wd, sz, b) > w && wd.length > 1) {
          var k = wd.length;
          while (k > 1 && pwid(wd.slice(0, k), sz, b) > w) k--;
          if (line) {
            out.push(line);
            line = '';
          }
          out.push(wd.slice(0, k));
          wd = wd.slice(k);
        }
        if (!line) line = wd;
        else if (pwid(line + ' ' + wd, sz, b) <= w) line += ' ' + wd;
        else {
          out.push(line);
          line = wd;
        }
      });
      out.push(line);
    });
  return out;
}
function pesc(s) {
  s = String(s == null ? '' : s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/→/g, '->')
    .replace(/…/g, '...')
    .replace(/ /g, ' ');
  var o = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c > 255) o += '?';
    else if (c === 40 || c === 41 || c === 92) o += '\\' + s.charAt(i);
    else if (c < 32) o += ' ';
    else o += s.charAt(i);
  }
  return o;
}
var PDF_TINT = {
  'st-enquiry': [0.89, 0.93, 0.97],
  'st-factfind': [0.93, 0.89, 0.97],
  'st-dip': [1, 0.95, 0.74],
  'st-application': [1, 0.88, 0.76],
  'st-offer': [0.83, 0.94, 0.88],
  'st-completed': [0.89, 0.9, 0.91],
  'st-lost': [0.96, 0.86, 0.86]
};

function pdfBuildReport(tabs, filters, opts) {
  opts = opts || {};
  var W = 842,
    H = 595,
    M = 28,
    BOT = 40,
    SZ = 7,
    LH = 8.8,
    PAD = 3,
    pages = [''],
    y = H - M,
    AW = W - 2 * M,
    stamp = new Date().toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  function op(s) {
    pages[pages.length - 1] += s + '\n';
  }
  function np() {
    pages.push('');
    y = H - M;
  }
  function txt(x, yy, s, b, sz, col) {
    op(
      (col || '0 g') +
        ' BT /' +
        (b ? 'F2' : 'F1') +
        ' ' +
        sz +
        ' Tf 1 0 0 1 ' +
        x.toFixed(1) +
        ' ' +
        yy.toFixed(1) +
        ' Tm (' +
        pesc(s) +
        ') Tj ET'
    );
  }
  function rect(x, yy, w, h, rgb) {
    op(
      rgb[0] +
        ' ' +
        rgb[1] +
        ' ' +
        rgb[2] +
        ' rg ' +
        x.toFixed(1) +
        ' ' +
        yy.toFixed(1) +
        ' ' +
        w.toFixed(1) +
        ' ' +
        h.toFixed(1) +
        ' re f 0 g'
    );
  }
  txt(M, y - 12, opts.title || 'MySimpleDesk', true, 15, '0.18 0.29 0.25 rg');
  y -= 20;
  (opts.lines || []).forEach(function (l) {
    txt(M, y - 9, l, true, 10);
    y -= 14;
  });
  txt(
    M,
    y - 8,
    'Generated ' +
      stamp +
      (filters.length
        ? '   |   ' + filters.join('   |   ')
        : opts.lines
          ? ''
          : '   |   Everything shown on screen'),
    false,
    8,
    '0.35 0.4 0.45 rg'
  );
  y -= 16;
  tabs.forEach(function (sec, si) {
    // column widths from content
    var want = sec.cols.map(function (h, i) {
      var m = pwid(h, SZ, true) + 2 * PAD;
      sec.rows.forEach(function (r) {
        if (!r.cells || !r.cells[i]) return;
        r.cells[i].t.split('\n').forEach(function (l) {
          m = Math.max(m, Math.min(pwid(l, SZ, r.cells[i].b) + 2 * PAD, 190));
        });
      });
      return m;
    });
    var mn = sec.cols.map(function (h, i) {
      var m = 0;
      h.toUpperCase()
        .split(/\s+/)
        .forEach(function (wd) {
          m = Math.max(m, pwid(wd, SZ - 0.5, true) + 2 * PAD);
        });
      sec.rows.forEach(function (r) {
        if (!r.cells || !r.cells[i]) return;
        r.cells[i].t.split(/\s+/).forEach(function (wd) {
          m = Math.max(m, Math.min(pwid(wd, SZ, r.cells[i].b) + 2 * PAD, 120));
        });
      });
      return m;
    });
    want = want.map(function (w, i) {
      return Math.max(w, mn[i]);
    });
    var tot = want.reduce(function (a, b) {
        return a + b;
      }, 0),
      sm = mn.reduce(function (a, b) {
        return a + b;
      }, 0),
      ws;
    if (tot <= AW || sm >= AW)
      ws = want.map(function (w) {
        return (w * AW) / tot;
      });
    else
      ws = want.map(function (w, i) {
        return mn[i] + ((w - mn[i]) * (AW - sm)) / (tot - sm);
      });
    function head() {
      var hl = sec.cols.map(function (h, i) {
          return pwrap(h.toUpperCase(), ws[i] - 2 * PAD, SZ - 0.5, true);
        }),
        hh =
          Math.max.apply(
            null,
            hl.map(function (l) {
              return l.length;
            })
          ) *
            LH +
          2 * PAD;
      if (y - hh < BOT) {
        np();
      }
      rect(M, y - hh, AW, hh, [0.93, 0.95, 0.96]);
      var x = M;
      hl.forEach(function (lines, i) {
        lines.forEach(function (l, k) {
          txt(x + PAD, y - PAD - SZ - k * LH + 0.5, l, true, SZ - 0.5, '0.3 0.36 0.4 rg');
        });
        x += ws[i];
      });
      y -= hh;
    }
    if (y - 60 < BOT) np();
    y -= 6;
    if (sec.title) {
      txt(M, y - 11, sec.title, true, 11);
      y -= 16;
    }
    if (sec.sub) {
      txt(M, y - 7, sec.sub, false, 8, '0.35 0.4 0.45 rg');
      y -= 13;
    }
    head();
    sec.rows.forEach(function (r) {
      if (r.group) {
        var gl = pwrap(r.group, AW - 2 * PAD, SZ, true),
          gh = gl.length * LH + 2 * PAD;
        if (y - gh < BOT) {
          np();
          head();
        }
        rect(M, y - gh, AW, gh, [0.94, 0.95, 0.96]);
        gl.forEach(function (l, k) {
          txt(M + PAD, y - PAD - SZ - k * LH + 0.5, l, true, SZ);
        });
        y -= gh;
        return;
      }
      var cl = r.cells.map(function (c, i) {
        var lines = [],
          parts = c.t.split('\n');
        parts.forEach(function (p, k) {
          pwrap(p, ws[i] - 2 * PAD, SZ, c.b && k === 0).forEach(function (l) {
            lines.push({ t: l, b: c.b && k === 0 });
          });
        });
        return lines;
      });
      var rh =
        Math.max.apply(
          null,
          cl.map(function (l) {
            return l.length;
          })
        ) *
          LH +
        2 * PAD;
      if (y - rh < BOT) {
        np();
        head();
      }
      if (r.tint) rect(M, y - rh, AW, rh, r.tint);
      if (r.edge) rect(M, y - rh, 3, rh, r.edge === 'r' ? [0.78, 0.16, 0.16] : [0.94, 0.63, 0]);
      op(
        '0.82 0.85 0.87 RG 0.4 w ' +
          M +
          ' ' +
          (y - rh).toFixed(1) +
          ' m ' +
          (M + AW) +
          ' ' +
          (y - rh).toFixed(1) +
          ' l S'
      );
      var x = M;
      cl.forEach(function (lines, i) {
        lines.forEach(function (l, k) {
          txt(x + PAD + (r.edge && i === 0 ? 3 : 0), y - PAD - SZ - k * LH + 0.5, l.t, l.b, SZ);
        });
        x += ws[i];
      });
      y -= rh;
    });
    y -= 4;
  });
  var N = pages.length,
    out = '%PDF-1.4\n',
    offs = [];
  function obj(i, body) {
    offs[i] = out.length;
    out += i + ' 0 obj\n' + body + '\nendobj\n';
  }
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(
    2,
    '<< /Type /Pages /Kids [' +
      pages
        .map(function (p, i) {
          return 5 + 2 * i + ' 0 R';
        })
        .join(' ') +
      '] /Count ' +
      N +
      ' >>'
  );
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  pages.forEach(function (p, i) {
    var cs =
      p +
      '0.45 0.5 0.55 rg BT /F1 7 Tf 1 0 0 1 ' +
      M +
      ' 22 Tm (' +
      pesc(
        (opts.footer || 'MySimpleDesk') +
          '  |  Contains client information: store it securely and delete it when no longer needed  |  page ' +
          (i + 1) +
          ' of ' +
          N
      ) +
      ') Tj ET\n';
    obj(
      5 + 2 * i,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        W +
        ' ' +
        H +
        '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' +
        (6 + 2 * i) +
        ' 0 R >>'
    );
    obj(6 + 2 * i, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
  });
  var total = 5 + 2 * N,
    xref = out.length;
  out += 'xref\n0 ' + total + '\n0000000000 65535 f \n';
  for (var k = 1; k < total; k++) out += ('0000000000' + offs[k]).slice(-10) + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  var u = new Uint8Array(out.length);
  for (var m = 0; m < out.length; m++) u[m] = out.charCodeAt(m) & 255;
  return u;
}

/* ---------- Portfolio summary: fills in the Personal Portfolio Summary form from a client's buy to let cases ---------- */
var PF_COLS = [
  ['addr', 'Buy to Let property address (not residential)', 1],
  ['ptype', 'Property Type', 1],
  ['year', 'Year Purchased', 1],
  ['value', 'Current Estimated Value', 1],
  ['rent', 'Rental Income Per Month', 1],
  ['pay', 'Mortgage Payment Per Month', 1],
  ['owners', 'Owner(s)', 1],
  ['lender', 'Name of Current Lender', 1],
  ['mdate', 'Date of Mortgage', 1],
  ['bal', 'Mortgage Balance Outstanding', 1],
  ['svc', 'Annual Service Charge Amount', 1],
  ['gr', 'Annual Ground Rent Amount', 1],
  ['miss', 'Current number of missed payments', 1]
];
var PF_SUM = ['value', 'rent', 'pay', 'bal', 'svc', 'miss'],
  PF_MAX = 20,
  PF_MANUAL = ['ptype', 'year', 'rent', 'svc', 'gr', 'miss'];
var pfState = null;
function btlOf(c) {
  return !isSpv(c) && c.stage !== 'lost' && (c.propUse === 'btl' || /buy.?to.?let/i.test(c.type || ''));
}
function dmy(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] : s || '';
}
function pfPersons(g) {
  var ps = [];
  g.forEach(function (c) {
    (c.applicants || []).forEach(function (p) {
      if (
        pNm(p) &&
        !ps.some(function (q) {
          return samePerson(q, p);
        })
      )
        ps.push(p);
    });
  });
  return ps;
}
function pfCases(ps) {
  return cases.filter(function (c) {
    return (
      btlOf(c) &&
      (c.applicants || []).some(function (a) {
        return ps.some(function (p) {
          return samePerson(p, a);
        });
      })
    );
  });
}
function pfGroups() {
  var g = {};
  cases.forEach(function (c) {
    var k = clientKey(c);
    (g[k] = g[k] || []).push(c);
  });
  return Object.keys(g)
    .map(function (k) {
      var cs = g[k],
        ps = pfPersons(cs),
        n = pfCases(ps).length;
      return {
        k: k,
        label:
          (isSpv(cs[0]) ? 'Directors of ' : '') +
          (isSpv(cs[0]) ? names(cs[0]) : people(cs[0]) || names(cs[0])),
        no: cs[0].clientNo || '',
        ps: ps,
        n: n
      };
    })
    .filter(function (x) {
      return x.n > 0 && x.ps.length;
    })
    .sort(function (a, b) {
      return a.label.localeCompare(b.label);
    });
}
function pfRowFor(c) {
  var done = c.stage === 'completed' || /remortgage|product|further/i.test(c.type || '');
  return {
    id: c.id,
    inc: done,
    note: done ? '' : 'not completed',
    addr: c.propertyAddress || '',
    ptype: '',
    year: '',
    value: c.propertyValue || '',
    rent: '',
    pay: c.monthlyPayment || '',
    owners: people(c),
    lender: c.lender || '',
    mdate: dmy(c.completionDate),
    bal: c.loanAmount || '',
    svc: '',
    gr: '',
    miss: ''
  };
}
function pfLoad(k) {
  var grp = pfGroups().filter(function (x) {
    return x.k === k;
  })[0];
  if (!grp) return;
  var cs = pfCases(grp.ps);
  var kens = cs.filter(function (c) {
    return /kensington/i.test(c.lender || '') && c.lenderRef;
  })[0];
  pfState = {
    k: k,
    applicant:
      (isSpv(
        cases.filter(function (c) {
          return clientKey(c) === k;
        })[0]
      )
        ? ''
        : '') +
      grp.ps
        .map(function (p) {
          return p.name;
        })
        .join(' & '),
    ref: kens ? kens.lenderRef : '',
    rows: cs.slice(0, PF_MAX).map(pfRowFor)
  };
}
function pfNum(v) {
  var n = parseFloat(String(v || '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function pfTotals() {
  var T = {};
  PF_SUM.forEach(function (k) {
    var s = 0;
    pfState.rows.forEach(function (r) {
      if (r.inc) s += pfNum(r[k]);
    });
    T[k] = s;
  });
  return T;
}
function pfMoney(k, v) {
  return k === 'miss' ? String(v) : '£' + Number(v).toLocaleString('en-GB', { maximumFractionDigits: 2 });
}
function pfBody() {
  var grps = pfGroups(),
    h = '';
  h +=
    '<div class="pfhd"><label class="f">Client<select id="pfCl">' +
    grps
      .map(function (x) {
        return (
          '<option value="' +
          esc(x.k) +
          '"' +
          (pfState && pfState.k === x.k ? ' selected' : '') +
          '>' +
          esc((x.no ? x.no + '  ' : '') + x.label + ' (' + x.n + ')') +
          '</option>'
        );
      })
      .join('') +
    '</select></label>' +
    '<label class="f">Applicant name (one summary per application)<input id="pfApp" value="' +
    esc(pfState.applicant) +
    '"></label>' +
    '<label class="f">Kensington account reference number<input id="pfRef" value="' +
    esc(pfState.ref) +
    '"></label></div>';
  h +=
    '<div class="muted" style="font-size:12px;margin:6px 0">Filled in from the cases. Property type, year purchased, rental income, service charge, ground rent and missed payments are not stored in the app: type them here before you save. They are lost when you close this window. Untick a property to leave it out.</div>';
  h +=
    '<div style="overflow:auto;border:1px solid var(--line,#D4DBDF);border-radius:8px"><table class="pftab"><thead><tr><th></th>' +
    PF_COLS.map(function (c) {
      return '<th>' + esc(c[1]) + '</th>';
    }).join('') +
    '<th></th></tr></thead><tbody>';
  pfState.rows.forEach(function (r, i) {
    h +=
      '<tr' +
      (r.inc ? '' : ' class="pfoff"') +
      '><td><input type="checkbox" data-pfinc="' +
      i +
      '"' +
      (r.inc ? ' checked' : '') +
      ' aria-label="Include this property"></td>' +
      PF_COLS.map(function (c) {
        return (
          '<td><input data-pf="' +
          i +
          '.' +
          c[0] +
          '" value="' +
          esc(r[c[0]]) +
          '"' +
          (['value', 'rent', 'pay', 'bal', 'svc', 'gr', 'miss'].indexOf(c[0]) > -1
            ? ' inputmode="decimal"'
            : '') +
          (PF_MANUAL.indexOf(c[0]) > -1 ? ' class="pfman"' : '') +
          '></td>'
        );
      }).join('') +
      '<td class="muted" style="font-size:11px;white-space:nowrap">' +
      esc(r.note || '') +
      '</td></tr>';
  });
  h +=
    '<tr class="pftot"><td></td><td><b>Totals</b></td>' +
    PF_COLS.map(function (c, i) {
      return i === 0 ? '' : '<td data-pft="' + c[0] + '"></td>';
    })
      .slice(1)
      .join('') +
    '<td></td></tr></tbody></table></div>';
  h +=
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
    (pfState.rows.length < PF_MAX
      ? '<button type="button" class="btn ghost" id="pfAdd">Add a row</button>'
      : '') +
    '<button type="button" class="btn ghost" id="pfCopy">Copy table</button><button type="button" class="btn" id="pfPdf">Save as PDF</button></div>';
  return h;
}
function pfRefreshTotals() {
  var T = pfTotals();
  document.querySelectorAll('#pfOv [data-pft]').forEach(function (td) {
    var k = td.getAttribute('data-pft');
    td.innerHTML = PF_SUM.indexOf(k) > -1 && T[k] ? '<b>' + pfMoney(k, T[k]) + '</b>' : '';
  });
}
function pfUsed() {
  return pfState.rows.filter(function (r) {
    return r.inc && (r.addr || r.value || r.bal || r.lender);
  });
}
function pfCopyText() {
  var T = pfTotals(),
    L = [
      ['Applicant name:', pfState.applicant, '', 'Kensington account reference number:', pfState.ref].join(
        '\t'
      ),
      PF_COLS.map(function (c) {
        return c[1];
      }).join('\t')
    ];
  pfUsed().forEach(function (r) {
    L.push(
      PF_COLS.map(function (c) {
        return String(r[c[0]] || '').replace(/[\t\n]+/g, ' ');
      }).join('\t')
    );
  });
  L.push(
    PF_COLS.map(function (c, i) {
      return i === 0 ? 'Totals' : PF_SUM.indexOf(c[0]) > -1 && T[c[0]] ? String(T[c[0]]) : '';
    }).join('\t')
  );
  return L.join('\n');
}
function pfPdf() {
  var rows = pfUsed();
  if (!rows.length) {
    toast('Tick at least one property first');
    return;
  }
  var T = pfTotals(),
    grey = [0.93, 0.95, 0.96];
  var sec = {
    title: '',
    sub: '',
    cols: PF_COLS.map(function (c) {
      return c[1];
    }),
    rows: rows.map(function (r) {
      return {
        cells: PF_COLS.map(function (c, i) {
          var v = String(r[c[0]] || '');
          if (v && ['value', 'rent', 'pay', 'bal', 'svc', 'gr'].indexOf(c[0]) > -1 && !isNaN(pfNum(v)))
            v = '£' + Number(pfNum(v)).toLocaleString('en-GB', { maximumFractionDigits: 2 });
          return { t: v, b: i === 0 };
        })
      };
    })
  };
  sec.rows.push({
    tint: grey,
    cells: PF_COLS.map(function (c, i) {
      return {
        t: i === 0 ? 'Totals' : PF_SUM.indexOf(c[0]) > -1 && T[c[0]] ? pfMoney(c[0], T[c[0]]) : '',
        b: true
      };
    })
  });
  var data = pdfBuildReport([sec], [], {
    title: 'PERSONAL PORTFOLIO SUMMARY',
    lines: [
      'Applicant name: ' + (pfState.applicant || ''),
      'Kensington account reference number: ' + (pfState.ref || '')
    ],
    footer: 'Personal Portfolio Summary'
  });
  var nm =
    (pfState.applicant || 'client')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'client';
  var blob = new Blob([data], { type: 'application/pdf' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'portfolio-summary-' + nm + '-' + iso(TODAY) + '.pdf';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
  toast('PDF saved');
}
function openPortfolio(key) {
  var old = document.getElementById('pfOv');
  if (old) old.remove();
  var grps = pfGroups();
  if (!grps.length) {
    toast('No buy to let cases found for personal clients');
    return;
  }
  var q = (document.getElementById('q') || {}).value || '',
    pick = grps[0].k;
  if (key) {
    if (
      !grps.some(function (x) {
        return x.k === key;
      })
    ) {
      toast('This client has no buy to let cases to put in a portfolio summary');
      return;
    }
    pick = key;
  } else if (q.trim()) {
    var ql = q.trim().toLowerCase(),
      hit = cases.filter(function (c) {
        return (
          [names(c), people(c), c.companyName, c.companyNumber, coNo(c), c.propertyAddress, c.clientNo]
            .join(' ')
            .toLowerCase()
            .indexOf(ql) > -1
        );
      })[0];
    if (
      hit &&
      grps.some(function (x) {
        return x.k === clientKey(hit);
      })
    )
      pick = clientKey(hit);
  }
  pfLoad(pick);
  var ov = document.createElement('div');
  ov.id = 'pfOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:270;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:12px';
  ov.innerHTML =
    '<div role="dialog" aria-modal="true" aria-label="Portfolio summary" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(1500px,100%);max-height:94vh;display:flex;flex-direction:column;border-radius:12px;padding:18px 20px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:14px system-ui,sans-serif"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0;font-size:20px">Portfolio summary</h2><button type="button" class="btn ghost" id="pfX">Close</button></div><div id="pfBody" style="overflow:auto"></div></div>';
  document.body.appendChild(ov);
  function draw() {
    document.getElementById('pfBody').innerHTML = pfBody();
    pfRefreshTotals();
  }
  draw();
  ov.addEventListener('mousedown', function (e) {
    if (e.target === ov) ov.remove();
  });
  ov.addEventListener('change', function (e) {
    var x = e.target;
    if (x.id === 'pfCl') {
      pfLoad(x.value);
      draw();
      return;
    }
    if (x.getAttribute('data-pfinc') != null) {
      pfState.rows[+x.getAttribute('data-pfinc')].inc = x.checked;
      draw();
    }
  });
  ov.addEventListener('input', function (e) {
    var x = e.target,
      d = x.getAttribute && x.getAttribute('data-pf');
    if (x.id === 'pfApp') {
      pfState.applicant = x.value;
      return;
    }
    if (x.id === 'pfRef') {
      pfState.ref = x.value;
      return;
    }
    if (d) {
      var p = d.split('.');
      pfState.rows[+p[0]][p[1]] = x.value;
      pfRefreshTotals();
    }
  });
  ov.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.id === 'pfX') {
      ov.remove();
      return;
    }
    if (b.id === 'pfAdd') {
      pfState.rows.push({
        id: '',
        inc: true,
        note: 'added',
        addr: '',
        ptype: '',
        year: '',
        value: '',
        rent: '',
        pay: '',
        owners: '',
        lender: '',
        mdate: '',
        bal: '',
        svc: '',
        gr: '',
        miss: ''
      });
      draw();
      return;
    }
    if (b.id === 'pfCopy') {
      var tx = pfCopyText();
      (navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(tx)
        : Promise.reject()
      ).then(
        function () {
          toast('Copied. Paste it into Excel.');
        },
        function () {
          toast('Could not copy');
        }
      );
      return;
    }
    if (b.id === 'pfPdf') {
      pfPdf();
      return;
    }
  });
}
