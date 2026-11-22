'use strict';
/* MySimpleDesk app: Rent payments, rent status and expense reports.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- rent payments, rent invoices and sending invoices ---------- */
function rlStep(d, freq, day) {
  if (freq === 'Weekly') return addDays(d, 7);
  if (freq === 'Every 4 weeks') return addDays(d, 28);
  var n = addMonths(d, freq === 'Quarterly' ? 3 : 1);
  if (day && day >= 1 && day <= 31) {
    var p = pd(n),
      last = new Date(p.getFullYear(), p.getMonth() + 1, 0).getDate();
    n = iso(new Date(p.getFullYear(), p.getMonth(), Math.min(day, last)));
  }
  return n;
}
function rlPeriod(due, freq) {
  if (!due) return '';
  var end = addDays(rlStep(due, freq || 'Monthly'), -1);
  return fd(due) + ' to ' + fd(end);
}
function rlState(r) {
  if (r.status === 'paid') return 'paid';
  return r.due && diff(r.due) < 0 ? 'over' : 'due';
}
/* paid months fold to one line ("Oct 2026 · £1,150 · Paid 1 Oct"); press it to see or change the details */
function rlSumLine(r) {
  var dm = function (d, o) {
    return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? pd(d).toLocaleDateString('en-GB', o) : '';
  };
  var mon = dm(r.due, { month: 'short', year: 'numeric' }) || 'No date',
    pdl = dm(r.paidDate, { day: 'numeric', month: 'short' });
  return (
    '<button type="button" class="rlsum" data-rltog="1" aria-expanded="false"><span class="rlm">' +
    esc(mon) +
    '</span><span class="rla">' +
    (r.amount != null && r.amount !== '' ? money(r.amount) : '') +
    '</span><span class="chip ok">Paid' +
    (pdl ? ' ' + esc(pdl) : '') +
    '</span>' +
    (r.invId ? '<span class="rli">Invoice</span>' : '') +
    '<span class="rlx">Details</span></button>'
  );
}
function rlRow(r, c) {
  var st = rlState(r),
    inv = r.invId
      ? docsOf(c).filter(function (d) {
          return d.id === r.invId;
        })[0]
      : null;
  return (
    '<div class="rlrow' +
    (st === 'paid' ? ' rlpaid rlc' : '') +
    '" data-rlid="' +
    esc(r.id) +
    '">' +
    (st === 'paid' ? rlSumLine(r) : '') +
    '<label class="f">Due date<input type="date" data-rl="due" value="' +
    esc(r.due || '') +
    '"></label>' +
    '<label class="f">Amount<span class="ig"><i>£</i><input type="number" step="any" data-rl="amount" value="' +
    esc(r.amount == null ? '' : r.amount) +
    '"></span></label>' +
    '<label class="f">Rent<select data-rl="status"><option value="due"' +
    (r.status !== 'paid' ? ' selected' : '') +
    '>Rent due</option><option value="paid"' +
    (r.status === 'paid' ? ' selected' : '') +
    '>Rent paid</option></select></label>' +
    '<label class="f">Payment date<input type="date" data-rl="paidDate" value="' +
    esc(r.paidDate || '') +
    '"></label><input type="hidden" data-rl="invId" value="' +
    esc(r.invId || '') +
    '">' +
    '<div class="rlact"><span class="chip ' +
    (st === 'paid' ? 'ok' : st === 'over' ? 'bad' : 'warn') +
    '">' +
    (st === 'paid' ? 'Paid' : st === 'over' ? 'Overdue' : 'Due') +
    '</span><button type="button" class="btn ghost sm" data-rlinv="1">' +
    (inv ? 'Send invoice ' + esc(inv.number) : 'Create invoice') +
    '</button><button type="button" class="x" data-rlrm="1" aria-label="Remove this rent line">×</button></div></div>'
  );
}
function rlBox(tn, c) {
  var rows = (tn.rentLog || []).slice().sort(function (a, b) {
    return a.due < b.due ? 1 : a.due > b.due ? -1 : 0;
  });
  return (
    '<div class="rlbox"><div class="rlh"><b>Rent payments</b><button type="button" class="btn ghost sm" data-rladd="1">Add next rent</button></div><div class="rlrows">' +
    (rows.length
      ? rows
          .map(function (r, i) {
            return i < 6
              ? rlRow(r, c)
              : rlRow(r, c).replace('<div class="rlrow', '<div hidden class="rlrow rlold');
          })
          .join('') +
        (rows.length > 6
          ? '<button type="button" class="btn ghost sm" data-rlmore="1">Show ' +
            (rows.length - 6) +
            ' older payment' +
            (rows.length === 7 ? '' : 's') +
            '</button>'
          : '')
      : '<p class="muted rlnone" style="margin:4px 0">No rent lines yet. Press Add next rent.</p>') +
    '</div></div>'
  );
}
function rlNextDue(card) {
  var g = function (k) {
      var e = card.querySelector('[data-tf="' + k + '"]');
      return e ? e.value : '';
    },
    freq = g('rentFreq') || 'Monthly',
    day = +g('rentDay') || 0,
    start = g('tenancyStart');
  var dues = Array.prototype.map
    .call(card.querySelectorAll('.rlrow [data-rl="due"]'), function (i) {
      return i.value;
    })
    .filter(Boolean)
    .sort();
  if (dues.length) return rlStep(dues[dues.length - 1], freq, day);
  var base = start || iso(TODAY);
  if (day && freq !== 'Weekly' && freq !== 'Every 4 weeks') {
    var p = pd(base),
      last = new Date(p.getFullYear(), p.getMonth() + 1, 0).getDate(),
      cand = iso(new Date(p.getFullYear(), p.getMonth(), Math.min(day, last)));
    if (cand < base) cand = rlStep(cand, 'Monthly', day);
    return cand;
  }
  return base;
}
function rlReminders(c) {
  var out = [];
  tnCurrent(c).forEach(function (tn) {
    (tn.rentLog || []).forEach(function (r) {
      if (r.status === 'paid' || !r.due) return;
      var k = 'r:' + r.id;
      if (c.remDone && c.remDone[k] === r.due) return;
      out.push({
        date: r.due,
        label:
          'Rent ' +
          (r.amount ? money(r.amount) + ' ' : '') +
          'due' +
          (tnNames(tn) ? ' · ' + tnNames(tn) : ''),
        key: k,
        sec: false
      });
    });
  });
  return out;
}
function rentStatusCell(c) {
  var rows = [];
  tnCurrent(c).forEach(function (tn) {
    (tn.rentLog || []).forEach(function (r) {
      rows.push(r);
    });
  });
  if (!rows.length) return '<span class="muted">—</span>';
  var unpaid = rows
      .filter(function (r) {
        return r.status !== 'paid' && r.due;
      })
      .sort(function (a, b) {
        return a.due < b.due ? -1 : 1;
      }),
    over = unpaid.filter(function (r) {
      return diff(r.due) < 0;
    });
  if (over.length)
    return (
      '<span class="chip bad">Overdue ' +
      money(
        over.reduce(function (a, r) {
          return a + (+r.amount || 0);
        }, 0)
      ) +
      '</span>'
    );
  if (unpaid.length) return '<span class="chip warn">Due ' + fd(unpaid[0].due) + '</span>';
  return '<span class="chip ok">Paid</span>';
}
/* send window: download, share, WhatsApp, email */
var snCase = null,
  snDoc = null;
function snPeople(c, d) {
  var ppl = [];
  if (d.tnId) {
    var tn = tnList(c).filter(function (t) {
      return t.id === d.tnId;
    })[0];
    if (tn) ppl = tn.people || [];
  }
  if (!ppl.length)
    ppl = T.tenancyMode
      ? [].concat.apply(
          [],
          tnCurrent(c).map(function (t) {
            return t.people || [];
          })
        )
      : c.applicants || [];
  return ppl.filter(function (p) {
    return p && (p.name || p.phone || p.email);
  });
}
function snMsg(d, p) {
  var f = bdFirst((p && p.name) || ''),
    pay =
      BIZ.payDetails && d.status !== 'paid'
        ? '\n\nHow to pay:\n' + BIZ.payDetails + '\nPlease use reference ' + d.number + '.'
        : '';
  return (
    'Hello' +
    (f ? ' ' + f : '') +
    ',\n\n' +
    (d.kind === 'quote'
      ? 'Please find your quote ' +
        d.number +
        ' for ' +
        gbp(d.total || dcTotals(d).total) +
        '. It is valid until ' +
        fd(d.due) +
        '.'
      : 'Please find your ' +
        (d.rentRow ? 'rent ' : '') +
        'invoice ' +
        d.number +
        ' for ' +
        gbp(d.total || dcTotals(d).total) +
        ', due on ' +
        fd(d.due) +
        '.') +
    pay +
    '\n\nThank you,\n' +
    (bizName() || profA().name || '')
  );
}
function snFile(d) {
  return (
    (d.kind === 'quote' ? 'Quote-' : 'Invoice-') + String(d.number).replace(/[^A-Za-z0-9-]+/g, '') + '.pdf'
  );
}
var snUrl = null;
function snOpen(caseId, docId) {
  var c = cases.filter(function (x) {
    return x.id === caseId;
  })[0];
  if (!c) return;
  var d = docsOf(c).filter(function (x) {
    return x.id === docId;
  })[0];
  if (!d) return;
  snCase = caseId;
  snDoc = docId;
  var ppl = snPeople(c, d),
    mailOn = window.CD_mail && window.CD_mail.on(),
    kind = d.kind === 'quote' ? 'Quote' : 'Invoice';
  if (snUrl) {
    try {
      URL.revokeObjectURL(snUrl);
    } catch (e) {}
    snUrl = null;
  }
  var viewer;
  if (window.CD_DEMO)
    viewer =
      '<p class="muted" style="font-size:12px;margin:0 0 6px">Claude’s preview cannot show PDF files, so the demo shows the same invoice as a page. In the real app the PDF itself appears here.</p><div class="dcprev" style="position:static;max-height:none">' +
      dcHtml(d) +
      '</div>';
  else if (navigator.pdfViewerEnabled === false)
    viewer =
      '<p class="muted" style="font-size:12px;margin:0 0 6px">This browser cannot show PDFs inside the app, so here is the same invoice as a page. Download PDF or Share PDF gives you the PDF file.</p><div class="dcprev" style="position:static;max-height:none">' +
      dcHtml(d) +
      '</div>';
  else {
    try {
      snUrl = URL.createObjectURL(new Blob([dcPdf(d)], { type: 'application/pdf' }));
    } catch (e) {}
    viewer = snUrl
      ? '<iframe class="snpdf" src="' + snUrl + '#view=FitH" title="' + kind + ' PDF"></iframe>'
      : '<div class="dcprev" style="position:static">' + dcHtml(d) + '</div>';
  }
  overlay(
    'snOv',
    '<div class="dhd"><h2>' +
      kind +
      ' ' +
      esc(d.number) +
      ' <span class="muted" style="font-size:14px;font-weight:400">' +
      gbp(d.total || dcTotals(d).total) +
      (d.kind === 'quote' ? ' · valid until ' : ' · due ') +
      fd(d.due) +
      '</span> ' +
      dcChip(d) +
      '</h2><button type="button" class="btn ghost" data-snclose="1">Close</button></div>' +
      '<div class="snbar">' +
      (ppl.length
        ? ppl
            .map(function (p, i) {
              var intl = bdIntl(p.phone),
                em = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email || ''));
              return (
                '<div class="snp"><b>' +
                esc(p.name || 'No name') +
                '</b>' +
                '<div class="snc"><span class="num">' +
                esc(p.phone || 'No mobile number') +
                '</span>' +
                (intl
                  ? '<a class="btn sm bdwa" target="_blank" rel="noopener" data-snvia="whatsapp|' +
                    i +
                    '" href="https://wa.me/' +
                    intl +
                    '?text=' +
                    encodeURIComponent(snMsg(d, p)) +
                    '">Send by WhatsApp</a>'
                  : '') +
                '</div>' +
                '<div class="snc"><span>' +
                esc(p.email || 'No email address') +
                '</span>' +
                (em
                  ? (mailOn
                      ? '<button type="button" class="btn sm" data-snmail="' +
                        i +
                        '">Send by email (PDF attached)</button>'
                      : window.CD_mail && window.CD_mail.can && !window.CD_mail.can()
                        ? ''
                        : '<button type="button" class="btn sm ghost" data-snmailon="1">Turn on emailing</button>') +
                    '<a class="btn sm ghost" data-snvia="email app|' +
                    i +
                    '" href="mailto:' +
                    esc(p.email) +
                    '?subject=' +
                    encodeURIComponent(kind + ' ' + d.number + ' from ' + (bizName() || '')) +
                    '&body=' +
                    encodeURIComponent(snMsg(d, p).replace(/\n/g, '\r\n')) +
                    '">Email app</a>'
                  : '') +
                '</div></div>'
              );
            })
            .join('')
        : '<p class="dnote" style="margin:0">No phone number or email saved for this tenant or client.</p>') +
      '</div>' +
      '<div class="add" style="margin:8px 0"><button type="button" class="btn ghost sm" data-snpdf="dl">Download PDF</button><button type="button" class="btn ghost sm" data-snpdf="share">Share PDF (phone)</button><button type="button" class="btn ghost sm" data-snprint="1">Print</button><span class="muted" style="font-size:12px;align-self:center">WhatsApp from a link cannot attach the PDF: on a phone use Share PDF and pick WhatsApp; on a computer drag the downloaded PDF into the chat.</span></div>' +
      ((d.sent || []).length
        ? '<p class="muted" style="font-size:12px;margin:0 0 6px">Sent: ' +
          d.sent
            .map(function (s) {
              return esc(s.via) + (s.to ? ' to ' + esc(s.to) : '') + ' ' + shortStamp(s.at);
            })
            .join(' · ') +
          '</p>'
        : '') +
      viewer,
    true
  );
}
function snMark(via, to) {
  var c = cases.filter(function (x) {
    return x.id === snCase;
  })[0];
  if (!c) return;
  patch(c.id, {
    docs: docsOf(c).map(function (x) {
      if (x.id !== snDoc) return x;
      var y = Object.assign({}, x);
      if (y.status === 'draft') y.status = 'sent';
      y.sent = (y.sent || []).concat([{ via: via, to: to, at: Date.now() }]);
      return y;
    })
  });
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var b;
  if ((b = t.closest('[data-rladd]'))) {
    rlAdd(b.closest('.tncard'));
    rhRender();
    return;
  }
  if ((b = t.closest('[data-rlrm]'))) {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Remove?';
      return;
    }
    b.closest('.rlrow').remove();
    return;
  }
  if ((b = t.closest('[data-rlinv]'))) {
    e.preventDefault();
    if (!openId) {
      toast('Add the property address first. The property saves itself, then try again.');
      return;
    }
    var row = b.closest('.rlrow'),
      card2 = b.closest('.tncard'),
      tnId = card2.getAttribute('data-tn'),
      rowId = row.getAttribute('data-rlid'),
      inv = row.querySelector('[data-rl="invId"]').value;
    if (
      inv &&
      docsOf(currentCase()).some(function (x) {
        return x.id === inv;
      })
    ) {
      snOpen(openId, inv);
      return;
    }
    var data = collectForm();
    patch(openId, data);
    lastAuto = JSON.stringify(data);
    var c = currentCase(),
      tn =
        (data.tenancies || []).filter(function (x) {
          return x.id === tnId;
        })[0] || {},
      r =
        (tn.rentLog || []).filter(function (x) {
          return x.id === rowId;
        })[0] || {};
    var amt = +r.amount || +tfv(tn, 'rent') || 0;
    if (!amt) {
      toast('Add the rent amount first');
      return;
    }
    if (!tnNames(tn)) {
      toast('Add the tenant’s name first');
      return;
    }
    dcCase = openId;
    dcDoc = {
      id: 'd' + uid(),
      kind: 'invoice',
      number: dcNewNumber('invoice'),
      date: iso(TODAY),
      due: r.due || iso(TODAY),
      status: r.status === 'paid' ? 'paid' : 'draft',
      paidDate: r.status === 'paid' ? r.paidDate || iso(TODAY) : '',
      toName: tnNames(tn),
      toAddr: paddr(c),
      job: '',
      lines: [
        {
          d:
            'Rent for ' +
            rlPeriod(r.due || iso(TODAY), tfv(tn, 'rentFreq')) +
            '\n' +
            String(c.propertyAddress || '').split('\n')[0],
          q: 1,
          p: amt,
          v: 0
        }
      ],
      notes: '',
      isNew: true,
      rentRow: rowId,
      tnId: tnId
    };
    var d = dcSave(true);
    if (!d) return;
    row.querySelector('[data-rl="invId"]').value = d.id;
    b.textContent = 'Send invoice ' + d.number;
    var d2 = collectForm();
    patch(openId, { tenancies: d2.tenancies });
    lastAuto = JSON.stringify(d2);
    setTimeout(function () {
      snOpen(openId, d.id);
    }, 80);
    return;
  }
  if ((b = t.closest('[data-dcsend]'))) {
    var ds = dcSave(true);
    if (ds) {
      closeOv('dcOv');
      setTimeout(function () {
        snOpen(dcCase, ds.id);
      }, 80);
    }
    return;
  }
  if (t.closest('[data-snclose]') || t.id === 'snOv') {
    closeOv('snOv');
    if (snUrl) {
      try {
        URL.revokeObjectURL(snUrl);
      } catch (e) {}
      snUrl = null;
    }
    return;
  }
  if (t.closest('[data-snprint]')) {
    var c6 = cases.filter(function (x) {
        return x.id === snCase;
      })[0],
      d6 =
        c6 &&
        docsOf(c6).filter(function (x) {
          return x.id === snDoc;
        })[0];
    if (d6) printHtml(dcHtml(d6));
    return;
  }
  if ((b = t.closest('[data-snpdf]'))) {
    var c3 = cases.filter(function (x) {
        return x.id === snCase;
      })[0],
      d3 =
        c3 &&
        docsOf(c3).filter(function (x) {
          return x.id === snDoc;
        })[0];
    if (d3) {
      fileOut(dcPdf(d3), snFile(d3), b.getAttribute('data-snpdf'));
      if (b.getAttribute('data-snpdf') === 'share') snMark('shared PDF', '');
    }
    return;
  }
  if ((b = t.closest('[data-snvia]'))) {
    var v = b.getAttribute('data-snvia').split('|'),
      c4 = cases.filter(function (x) {
        return x.id === snCase;
      })[0],
      d4 =
        c4 &&
        docsOf(c4).filter(function (x) {
          return x.id === snDoc;
        })[0],
      p4 = d4 && snPeople(c4, d4)[+v[1]];
    if (p4) snMark(v[0], v[0] === 'whatsapp' ? p4.phone || '' : p4.email || '');
    return;
  }
  if (t.closest('[data-snmailon]')) {
    if (
      window.confirm(
        'Microsoft will ask you to allow ' +
          ((window.MD_CONFIG || {}).appName || 'MySimpleDesk') +
          ' to send email as you. You only do this once. Continue?'
      )
    )
      window.CD_mail.enable();
    return;
  }
  if ((b = t.closest('[data-snmail]'))) {
    var c5 = cases.filter(function (x) {
        return x.id === snCase;
      })[0],
      d5 =
        c5 &&
        docsOf(c5).filter(function (x) {
          return x.id === snDoc;
        })[0],
      p5 = d5 && snPeople(c5, d5)[+b.getAttribute('data-snmail')];
    if (!p5) return;
    b.disabled = true;
    b.textContent = 'Sending…';
    window.CD_mail.send({
      to: [p5.email],
      subject: (d5.kind === 'quote' ? 'Quote ' : 'Invoice ') + d5.number + ' from ' + (bizName() || ''),
      text: snMsg(d5, p5),
      name: snFile(d5),
      bytes: dcPdf(d5)
    }).then(
      function () {
        snMark('email', p5.email);
        toast(
          'Emailed ' +
            d5.number +
            ' to ' +
            p5.email +
            (window.CD_DEMO ? ' (demo: nothing was really sent)' : '')
        );
        b.textContent = 'Sent ✓';
      },
      function (err) {
        b.disabled = false;
        b.textContent = 'Email with PDF attached';
        toast(
          err && err.perm
            ? 'Permission to send email was removed. Turn emailing on again.'
            : 'Could not send the email. Check your connection and try again.'
        );
      }
    );
    return;
  }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var row = t.closest('.rlrow');
  if (!row) return;
  var k = t.getAttribute('data-rl');
  var st = row.querySelector('[data-rl="status"]'),
    pdv = row.querySelector('[data-rl="paidDate"]');
  if (k === 'status' && t.value === 'paid' && !pdv.value) pdv.value = iso(TODAY);
  if (k === 'status' && t.value === 'due') pdv.value = '';
  if (k === 'paidDate' && t.value) st.value = 'paid';
  var paid = st.value === 'paid',
    chip = row.querySelector('.rlact .chip'),
    due = row.querySelector('[data-rl="due"]').value;
  if (chip) {
    var s2 = paid ? 'paid' : due && diff(due) < 0 ? 'over' : 'due';
    chip.className = 'chip ' + (s2 === 'paid' ? 'ok' : s2 === 'over' ? 'bad' : 'warn');
    chip.textContent = s2 === 'paid' ? 'Paid' : s2 === 'over' ? 'Overdue' : 'Due';
  }
  var inv = row.querySelector('[data-rl="invId"]').value;
  if (inv && openId && (k === 'status' || k === 'paidDate')) {
    var c = currentCase();
    if (c)
      patch(c.id, {
        docs: docsOf(c).map(function (x) {
          if (x.id !== inv) return x;
          return Object.assign(
            {},
            x,
            paid
              ? { status: 'paid', paidDate: pdv.value || iso(TODAY) }
              : { status: x.status === 'paid' ? 'sent' : x.status, paidDate: '' }
          );
        })
      });
  }
});

/* ---------- rent status next to the rent, at the top of the property page ---------- */
function rlAdd(card) {
  var box = card.querySelector('.rlrows');
  if (!box) return null;
  var nn = box.querySelector('.rlnone');
  if (nn) nn.remove();
  var rent = (card.querySelector('[data-tf="rent"]') || {}).value;
  box.insertAdjacentHTML(
    'afterbegin',
    rlRow(
      { id: 'r' + uid(), due: rlNextDue(card), amount: rent === '' ? '' : +rent, status: 'due' },
      currentCase() || {}
    )
  );
  return box.firstElementChild;
}
function rhPick(card) {
  var keep = card.getAttribute('data-rhrow'),
    rows = Array.prototype.slice.call(card.querySelectorAll('.rlrow'));
  if (keep) {
    var k = rows.filter(function (r) {
      return r.getAttribute('data-rlid') === keep;
    })[0];
    if (k) return k;
  }
  var due = rows
    .filter(function (r) {
      return r.querySelector('[data-rl="status"]').value !== 'paid';
    })
    .sort(function (a, b) {
      var x = a.querySelector('[data-rl="due"]').value,
        y = b.querySelector('[data-rl="due"]').value;
      return x < y ? -1 : x > y ? 1 : 0;
    })[0];
  var row = due || rlAdd(card);
  if (row) card.setAttribute('data-rhrow', row.getAttribute('data-rlid'));
  return row;
}
function rhRender() {
  var box = $('#rentHead');
  if (!box) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('#tns .tncard')).filter(function (cd) {
    var s = cd.querySelector('[data-tf="status"]');
    return !s || s.value !== 'ended';
  });
  box.innerHTML = cards
    .map(function (cd) {
      var rent = (cd.querySelector('[data-tf="rent"]') || {}).value;
      if (rent === '' || rent == null) return '';
      var row = rhPick(cd);
      if (!row) return '';
      var g = function (k) {
          return row.querySelector('[data-rl="' + k + '"]').value;
        },
        paid = g('status') === 'paid',
        inv = g('invId'),
        nm = Array.prototype.map
          .call(cd.querySelectorAll('.tnp [data-tp="name"]'), function (i) {
            return i.value;
          })
          .filter(Boolean)
          .join(' & '),
        freq = (cd.querySelector('[data-tf="rentFreq"]') || {}).value;
      var st = paid ? 'paid' : g('due') && diff(g('due')) < 0 ? 'over' : 'due';
      return (
        '<div class="rh" data-rhcard="' +
        esc(cd.getAttribute('data-tn')) +
        '"><div class="rhl"><b>Rent ' +
        money(+g('amount') || +rent) +
        '</b>' +
        (freq ? ' <span class="muted">' + esc(freq.toLowerCase()) + '</span>' : '') +
        (nm ? '<div class="muted" style="font-size:12px">' + esc(nm) + '</div>' : '') +
        '</div>' +
        '<label class="rhf">Rent<select data-rh="status"><option value="due"' +
        (paid ? '' : ' selected') +
        '>Due</option><option value="paid"' +
        (paid ? ' selected' : '') +
        '>Paid</option></select></label>' +
        '<label class="rhf">Due date<input type="date" data-rh="due" value="' +
        esc(g('due')) +
        '"></label>' +
        (paid
          ? '<label class="rhf">Payment date<input type="date" data-rh="paidDate" value="' +
            esc(g('paidDate')) +
            '"></label><button type="button" class="btn" data-rhinv="1">' +
            (inv ? 'Open invoice' : 'Create invoice') +
            '</button>'
          : '<span class="chip ' +
            (st === 'over' ? 'bad' : 'warn') +
            '" style="align-self:center">' +
            (st === 'over' ? 'Overdue' : 'Due') +
            (g('due') ? ' ' + fd(g('due')) : '') +
            '</span>') +
        '</div>'
      );
    })
    .join('');
}
function rhRow(el) {
  var h = el.closest('[data-rhcard]'),
    cd = h && document.querySelector('#tns .tncard[data-tn="' + h.getAttribute('data-rhcard') + '"]');
  return cd ? rhPick(cd) : null;
}
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t || !t.getAttribute || !t.getAttribute('data-rh')) return;
  var row = rhRow(t);
  if (!row) return;
  var k = t.getAttribute('data-rh'),
    inp = row.querySelector('[data-rl="' + k + '"]');
  inp.value = t.value;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  rhRender();
  updStrip();
});
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var b = t.closest('[data-rhinv]');
  if (!b) return;
  var row = rhRow(b);
  if (!row) return;
  var btn = row.querySelector('[data-rlinv]');
  if (btn) btn.click();
  setTimeout(rhRender, 150);
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (
    t &&
    t.closest &&
    (t.closest('.rlrow') ||
      (t.getAttribute && /^(rent|rentFreq|status)$/.test(t.getAttribute('data-tf') || '')))
  )
    setTimeout(rhRender, 0);
});

/* ---------- landlords: expenses, and rent and expenses reports for the accountant ---------- */
var EXP_CATS = [
  'Repairs and maintenance',
  'Insurance',
  'Letting agent and management fees',
  'Legal, accountancy and professional fees',
  'Council tax, utilities, ground rent and service charges',
  'Mortgage interest and finance costs',
  'Cleaning, gardening and other services',
  'Travel',
  'Replacing furnishings and appliances',
  'Other'
];
function exDesc(e, sep) {
  return [e.desc, e.to]
    .filter(Boolean)
    .concat(e.receipt ? ['receipt on file'] : [])
    .join(sep);
}
function expList(c) {
  return ((c && c.expenses) || []).slice().sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}
function taxYear(d) {
  var p = pd(d),
    y = p.getFullYear(),
    start = new Date(y, 3, 6);
  if (p < start) y--;
  return { from: y + '-04-06', to: y + 1 + '-04-05', label: y + '/' + String(y + 1).slice(2) };
}
var exCase = null,
  exEdit = null;
/* the subject of the screen: a rental property (its id) or My home ('__home', stored in the home record) */
var HOME_ID = '__home';
var EXP_CATS_HOME = [
  'Repairs and maintenance',
  'Insurance',
  'Council tax, energy and water',
  'Mortgage interest and fees',
  'Furnishings and appliances',
  'Cleaning and garden',
  'Home improvements',
  'Other'
];
function exSubj(id) {
  if (id === HOME_ID) return HOME && HOME.addr1 ? HOME : null;
  return cases.filter(function (x) {
    return x.id === id;
  })[0];
}
function exPatch(id, up) {
  if (id === HOME_ID) {
    homeWrite(Object.assign({}, HOME, up));
    return Promise.resolve();
  }
  return patch(id, up);
}
function exCats(id) {
  return id === HOME_ID ? EXP_CATS_HOME : T && !T.tenancyMode && T.expCats ? T.expCats : EXP_CATS;
}
function exCommit() {
  var c = exSubj(exCase);
  if (!c) return false;
  var amt = parseFloat(($('#ex-amt') || {}).value),
    dt = ($('#ex-date') || {}).value;
  if (!dt || !(amt > 0)) {
    toast('Add the date and an amount, or clear the amount to close without saving');
    return false;
  }
  var vals = {
    date: dt,
    cat: $('#ex-cat').value,
    amount: r2(amt),
    to: ($('#ex-to').value || '').trim(),
    desc: ($('#ex-desc').value || '').trim(),
    receipt: rcPend || null
  };
  if (exEdit) {
    var eid = exEdit;
    exPatch(exCase, {
      expenses: (c.expenses || []).map(function (x) {
        return x.id === eid ? Object.assign({}, x, vals, { edited: Date.now() }) : x;
      })
    });
    toast('Expense updated');
  } else {
    if (!vals.receipt) delete vals.receipt;
    exPatch(exCase, {
      expenses: (c.expenses || []).concat([Object.assign({ id: 'e' + uid(), added: Date.now() }, vals)])
    });
    toast('Expense added');
  }
  rcFor = null;
  rcPend = null;
  return true;
}
