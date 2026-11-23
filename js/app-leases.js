'use strict';
/* MySimpleDesk app: Tenancy and lease agreements.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- tenancy and lease agreements, chosen by property (in Generate documents) ----------
   Tenancy agreement: the tenant is a person (assured periodic tenancy). Lease agreement: the tenant is a company (company let, fixed term). */
function gnAgHtml(props) {
  return (
    '<fieldset style="margin:6px 0 0"><legend>Tenancy and lease agreements</legend>' +
    '<p class="muted" style="margin:0 0 8px;font-size:12.5px">Choose the kind of agreement and the property. A tenancy agreement is for a tenant who is a person. A lease agreement is for a tenant that is a company, for a fixed term of up to 3 years.</p>' +
    (props.length
      ? '<div class="grid"><label class="f">Agreement<select id="gn-agkind"><option value="tenancy">Tenancy agreement</option><option value="lease">Lease agreement (company tenant)</option><option value="renew">Renew a tenancy or lease</option></select></label>' +
        '<label class="f">Property<select id="gn-agprop">' +
        props
          .map(function (c) {
            return '<option value="' + esc(c.id) + '">' + esc(names(c)) + '</option>';
          })
          .join('') +
        '</select></label>' +
        '<label class="f wide">Tenant<select id="gn-agtn"></select></label></div>' +
        '<p class="muted" id="gnAgMsg" style="margin:0 0 8px;font-size:12.5px"></p>' +
        '<div class="add" style="margin:0"><button type="button" class="btn" id="gnAgGo">Create agreement</button></div>'
      : '<p class="muted" style="margin:0">Add a property first.</p>') +
    '</fieldset>'
  );
}
function gnAgSync() {
  var k = $('#gn-agkind'),
    p = $('#gn-agprop'),
    s = $('#gn-agtn'),
    m = $('#gnAgMsg'),
    go = $('#gnAgGo');
  if (!k || !p || !s) return;
  var renew = k.value === 'renew',
    lease = k.value === 'lease',
    c = cases.filter(function (x) {
      return x.id === p.value;
    })[0],
    keep = s.value;
  var tns = tnList(c)
    .filter(function (t) {
      return renew || tnCorp(t) === lease;
    })
    .sort(function (a, b) {
      return (
        ((a.status || 'current') === 'current' ? 0 : 1) - ((b.status || 'current') === 'current' ? 0 : 1)
      );
    });
  var opts = tns.map(function (t) {
    var tl = renew ? tnCorp(t) : lease,
      has = t.agreement && (t.agreement.kind === 'company') === tl;
    return (
      '<option value="' +
      esc(t.id) +
      '">' +
      esc(
        (tnNames(t) || 'Tenant with no name yet') +
          ((t.status || 'current') === 'current' ? '' : ' (previous tenant)') +
          (renew ? (tl ? ' · lease' : ' · tenancy') : '') +
          (has ? ' · agreement saved' : '')
      ) +
      '</option>'
    );
  });
  if (!lease && !renew)
    opts.push('<option value="">No tenant yet: start a blank agreement for this property</option>');
  s.innerHTML = opts.join('');
  if (
    keep &&
    tns.some(function (t) {
      return t.id === keep;
    })
  )
    s.value = keep;
  var none = (lease || renew) && !tns.length;
  s.disabled = none;
  if (go) go.disabled = none;
  if (none)
    s.innerHTML =
      '<option value="">' +
      (renew ? 'No tenant on this property yet' : 'No company tenant on this property') +
      '</option>';
  if (m)
    m.textContent = none
      ? renew
        ? 'This property has no tenant to renew. Open the property and add the tenant first.'
        : 'This property has no company tenant. Open the property, add the tenant and set Type of tenant to Corporate tenant, then come back here.'
      : renew
        ? 'Renewing opens the agreement with the same terms and a new start date, with a line saying it renews the earlier one. Check the dates and rent, then save. Saving replaces the saved agreement for this tenant, so download the old one first if you want to keep it.'
        : '';
  var t0 = tns.filter(function (t) {
      return t.id === s.value;
    })[0],
    saved =
      !renew &&
      (t0 ? t0.agreement && (t0.agreement.kind === 'company') === lease : !lease && c && c.tenancyDoc);
  if (go)
    go.textContent = renew
      ? 'Create renewal'
      : (saved ? 'Open ' : 'Create ') + (lease ? 'lease agreement' : 'tenancy agreement');
}
function gnPreview() {
  var g = gnRead(),
    p = $('#gnPrev');
  if (!p) return;
  if (!g.from || !g.to || g.from > g.to) {
    p.innerHTML = '<p class="muted" style="padding:10px">Choose a start date before the end date.</p>';
    return;
  }
  var out = [];
  g.rows.forEach(function (r) {
    (r.c.expenses || []).forEach(function (e) {
      if (e.date && (e.date < g.from || e.date > g.to)) out.push(e.date);
    });
  });
  out.sort();
  p.innerHTML =
    (out.length
      ? '<div class="gnwarn">' +
        out.length +
        ' expense' +
        (out.length === 1 ? ' is' : 's are') +
        ' dated outside these dates (' +
        fd(out[0]) +
        (out.length > 1 ? ' to ' + fd(out[out.length - 1]) : '') +
        '), so ' +
        (out.length === 1 ? 'it is' : 'they are') +
        ' not in this report. Change the dates to include ' +
        (out.length === 1 ? 'it' : 'them') +
        '.</div>'
      : '') +
    gnParts(g)
      .map(function (x) {
        return gnHtml(x.rows, g.from, g.to);
      })
      .join('<hr style="margin:18px 0;border:0;border-top:2px dashed #D4DBDF">');
}
function gnFile(g, ext, c) {
  return (
    'Rent-and-expenses-' +
    (c ? pfClean(names(c), 50).replace(/[\s,]+/g, '-') + '-' : '') +
    g.from +
    '-to-' +
    g.to +
    '.' +
    ext
  );
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var b;
  if (t.id === 'expBtn') {
    if (!openId) {
      toast(
        T.tenancyMode
          ? 'Add the property address first. It saves itself, then try again.'
          : 'Add the customer name first. It saves itself, then try again.'
      );
      return;
    }
    patch(openId, collectForm());
    lastAuto = JSON.stringify(collectForm());
    expOpen(openId);
    return;
  }
  if (t.closest('[data-exclose]') || t.id === 'exOv') {
    if (rcBusy) {
      toast('Still saving the receipt. Wait a moment, then close.');
      return;
    }
    var pend = (($('#ex-amt') || {}).value || '').trim();
    if (
      rcPend &&
      !pend &&
      !exEdit &&
      !confirm(
        'This receipt is not saved as an expense yet, because there is no amount. Close anyway? The file stays in your Receipts folder, and you can use it later from Open receipt.'
      )
    )
      return;
    if (pend || exEdit) {
      if (!exCommit()) return;
    }
    closeOv('exOv');
    exEdit = null;
    rcFor = null;
    rcPend = null;
    return;
  }
  if (t.closest('[data-exadd]')) {
    if (exCommit())
      setTimeout(function () {
        expOpen(exCase);
      }, 60);
    return;
  }
  if ((b = t.closest('[data-exedit]'))) {
    expOpen(exCase, b.getAttribute('data-exedit'));
    var f = $('#ex-amt');
    if (f) f.focus();
    return;
  }
  if (t.closest('[data-excancel]')) {
    expOpen(exCase);
    return;
  }
  if ((b = t.closest('[data-exdel]'))) {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Delete?';
      return;
    }
    var c2 = exSubj(exCase);
    if (c2)
      exPatch(exCase, {
        expenses: (c2.expenses || []).filter(function (x) {
          return x.id !== b.getAttribute('data-exdel');
        })
      });
    setTimeout(function () {
      expOpen(exCase);
    }, 60);
    return;
  }
  if (t.closest('[data-gnopen]')) {
    gnOpen();
    return;
  }
  if (t.closest('[data-gnclose]') || t.id === 'gnOv') {
    closeOv('gnOv');
    return;
  }
  if ((b = t.closest('[data-gnr]'))) {
    var rg = gnRange(b.getAttribute('data-gnr'));
    $('#gn-from').value = rg[0];
    $('#gn-to').value = rg[1];
    document.querySelectorAll('[data-gnr]').forEach(function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    gnPreview();
    return;
  }
  if ((b = t.closest('[data-gnout]'))) {
    var g = gnRead(),
      how = b.getAttribute('data-gnout');
    if (!g.from || !g.to || g.from > g.to) {
      toast('Choose a start date before the end date');
      return;
    }
    var acc = ACC().email;
    var parts = gnParts(g);
    if (!parts.length || !g.rows.length) {
      toast('Choose at least one property');
      return;
    }
    if (g.each && (how === 'share' || how === 'mail')) {
      toast(
        'To email or share, choose all properties in one report, or one property. Download gives a separate file for each property.'
      );
      return;
    }
    if (how === 'csv') {
      parts.forEach(function (x, n) {
        setTimeout(function () {
          var blob = new Blob([gnCsv(x.rows)], { type: 'text/csv' }),
            a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = gnFile(g, 'csv', x.c);
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            URL.revokeObjectURL(a.href);
            a.remove();
          }, 4000);
        }, n * 500);
      });
      toast(
        (parts.length > 1
          ? parts.length + ' spreadsheets saved, one for each property.'
          : 'Spreadsheet saved.') + (window.CD_DEMO ? ' (In the Claude demo, downloads are blocked.)' : '')
      );
      return;
    }
    if (how === 'print') {
      printHtml(
        parts
          .map(function (x) {
            return gnHtml(x.rows, g.from, g.to);
          })
          .join('<div style="page-break-after:always"></div>')
      );
      return;
    }
    if (how === 'pdf') {
      parts.forEach(function (x, n) {
        setTimeout(function () {
          fileOut(gnPdf(x.rows, g.from, g.to), gnFile(g, 'pdf', x.c), 'dl');
        }, n * 500);
      });
      if (parts.length > 1)
        toast(
          parts.length +
            ' PDFs, one for each property. If only one arrives, allow multiple downloads in your browser.'
        );
      return;
    }
    if (how === 'share') {
      fileOut(gnPdf(g.rows, g.from, g.to), gnFile(g, 'pdf', g.one), 'share');
      return;
    }
    if (how === 'mail') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc)) {
        toast('Add your accountant’s email address first');
        accOpen(true);
        return;
      }
      var tt = gnTotals(g.rows),
        txt =
          'Hello' +
          (ACC().name ? ' ' + ACC().name : '') +
          ',\n\nPlease find attached my rent received and expenses from ' +
          fd(g.from) +
          ' to ' +
          fd(g.to) +
          '.\n\nRent received: ' +
          gbp(tt.rt) +
          '\nExpenses: ' +
          gbp(tt.et) +
          (tt.mt ? '\nMortgage payments: ' + gbp(tt.mt) : '') +
          '\n\nThank you,\n' +
          (profA().name || bizName() || '');
      if (!(window.CD_mail && window.CD_mail.on())) {
        window.location.href =
          'mailto:' +
          acc +
          '?subject=' +
          encodeURIComponent('Rent and expenses ' + fd(g.from) + ' to ' + fd(g.to)) +
          '&body=' +
          encodeURIComponent(txt.replace(/\n/g, '\r\n') + '\r\n\r\n(Please attach the PDF you downloaded.)');
        return;
      }
      b.disabled = true;
      b.textContent = 'Sending…';
      window.CD_mail.send({
        to: [acc],
        subject: 'Rent and expenses ' + fd(g.from) + ' to ' + fd(g.to),
        text: txt,
        name: gnFile(g, 'pdf', g.one),
        bytes: gnPdf(g.rows, g.from, g.to)
      }).then(
        function () {
          b.disabled = false;
          b.textContent = 'Email to my accountant';
          toast('Report emailed to ' + acc + (window.CD_DEMO ? ' (demo: nothing was really sent)' : ''));
        },
        function (err) {
          b.disabled = false;
          b.textContent = 'Email to my accountant';
          toast(
            err && err.perm
              ? 'Permission to send email was removed. Turn emailing on again in Settings.'
              : 'Could not send the email. Try again.'
          );
        }
      );
      return;
    }
  }
  if (t.closest('[data-accedit]')) {
    accOpen(!!$('#gnOv'));
    return;
  }
  if (t.closest('[data-accclose]') || t.id === 'accOv') {
    closeOv('accOv');
    return;
  }
  if ((b = t.closest('[data-accsave]'))) {
    accSave(b.getAttribute('data-accsave'));
    return;
  }
  if (t.closest('[data-bookappt]')) {
    apOpen(null, iso(TODAY));
    return;
  }
  if (t.id === 'saveCloseBtn') {
    saveCase();
    return;
  }
  /* Back: for a saved record it does what Done does (saves, then closes); for a new one nobody typed into it just closes, and one that was typed into is saved like Done */
  if (t.id === 'backBtn') {
    if (openId || JSON.stringify(collectForm()) !== newBase) saveCase();
    else closeDrawer();
    return;
  }
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t && t.closest && t.closest('#gnOv') && (t.id === 'gn-from' || t.id === 'gn-to')) gnPreview();
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t && t.closest && t.closest('#gnOv')) {
    if (/^gn-ag/.test(t.id || '')) {
      gnAgSync();
      return;
    }
    gnModeSync();
    gnPreview();
  }
});
document.addEventListener('click', function (e) {
  var t = e.target && e.target.closest ? e.target.closest('#gnAgGo') : null;
  if (!t) return;
  e.preventDefault();
  var p = $('#gn-agprop'),
    s = $('#gn-agtn');
  if (p && p.value) taOpen(p.value, (s && s.value) || null, ($('#gn-agkind') || {}).value === 'renew');
});

/* rent not paid by its due date: add a task to contact the tenant; tick it off when the rent is marked paid */
var rtBusy = false;
function rtSweep() {
  if (!T || !T.tenancyMode || !col || rtBusy) return;
  var today = iso(TODAY);
  cases.forEach(function (c) {
    if (c.stage === 'lost') return;
    var tasks = (c.tasks || []).slice(),
      made = Object.assign({}, c.rtMade || {}),
      changed = false;
    tnList(c).forEach(function (tn) {
      (tn.rentLog || []).forEach(function (r) {
        var ref = 'rent:' + tn.id + ':' + r.id,
          ex = tasks.filter(function (x) {
            return x.ref === ref;
          })[0];
        if (r.status === 'paid') {
          if (ex && !ex.done) {
            tasks = tasks.map(function (x) {
              return x === ex ? Object.assign({}, x, { done: true, doneAt: Date.now() }) : x;
            });
            changed = true;
          }
          return;
        }
        if (tn.status !== 'current' || !r.due || r.due >= today || ex || made[ref]) return;
        made[ref] = today;
        var who = (tn.people || []).filter(function (p) {
            return p.name;
          }),
          ph =
            who
              .map(function (p) {
                return p.phone;
              })
              .filter(Boolean)[0] || '';
        tasks.push({
          id: uid(),
          ref: ref,
          text:
            'Contact ' +
            (who
              .map(function (p) {
                return p.name;
              })
              .join(' & ') || 'the tenant') +
            (ph ? ' (' + ph + ')' : '') +
            ' to remind them to pay the rent of ' +
            gbp(+r.amount || +tn.rent || 0) +
            ' that was due ' +
            fd(r.due),
          due: today,
          time: '',
          done: false,
          created: Date.now(),
          pri: true,
          auto: 'rent'
        });
        changed = true;
      });
    });
    if (changed) {
      rtBusy = true;
      patch(c.id, { tasks: tasks, rtMade: made }).then(
        function () {
          rtBusy = false;
        },
        function () {
          rtBusy = false;
        }
      );
    }
  });
}
/* mortgage: split the monthly payment into interest and capital */
function mortSplit(bal, rate, pay, method) {
  bal = +bal || 0;
  rate = +rate || 0;
  pay = +pay || 0;
  if (!(bal > 0 && rate > 0)) return null;
  var i = r2((bal * rate) / 1200);
  if (method === 'interest-only') return { i: i, c: 0 };
  return { i: pay ? Math.min(i, pay) : i, c: pay ? r2(Math.max(0, pay - i)) : 0 };
}
function mcRender() {
  if (!T || !T.tenancyMode) return;
  var m = $('#f-mortMethod');
  if (!m) return;
  var f = m.closest('.f') || m.parentNode,
    box = $('#mortCalc');
  if (!box) {
    box = document.createElement('div');
    box.id = 'mortCalc';
    box.className = 'mortcalc';
    var g = f.parentNode;
    g.insertBefore(box, f.nextSibling);
  }
  var v = function (k) {
      var e = $('#f-' + k);
      return e ? e.value : '';
    },
    s = mortSplit(v('mortBalance'), v('mortRate'), v('mortPayment'), m.value),
    pay = +v('mortPayment') || 0;
  if (!s) {
    box.innerHTML =
      '<span class="muted">Add the balance and interest rate to see how much of each payment is interest.</span>';
    return;
  }
  box.innerHTML =
    m.value === 'interest-only'
      ? 'Interest only: about <b>' +
        gbp(s.i) +
        '</b> a month is interest' +
        (pay && Math.abs(pay - s.i) > 1 ? ' (your payment is ' + gbp(pay) + ')' : '') +
        '.'
      : 'Interest part: about <b>' +
        gbp(s.i) +
        '</b> a month' +
        (pay ? ', capital repaid about <b>' + gbp(s.c) + '</b>' : '') +
        '. ' +
        (m.value ? '' : 'Choose the payment method. ') +
        '<span class="muted">Worked out from the balance and rate; the interest part falls a little each month as the balance goes down.</span>';
}
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t && /^f-mort(Rate|Balance|Payment|Method)$/.test(t.id || '')) mcRender();
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t && t.id === 'f-mortMethod') mcRender();
});
