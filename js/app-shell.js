'use strict';
/* MySimpleDesk app: Main screen: menus, the list pages (pipeline, cases, reminders) and the record drawer.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- render shell ---------- */
/* landlords: Notebook and Book appointment sit under More, in the top menu (phone) and the side menu (computer) */
var navMore = false;
function renderNav() {
  renderSwitch();
  updTrayBtn();
  if (view === 'notebook') navMore = true;
  var items = toolItems(
    T.calTab
      ? [
          ['cases', 'Clients'],
          ['reminders', 'Reminders'],
          ['appointments', 'Appointments'],
          ['clients', CL()],
          ['tasks', 'Calendar'],
          ['calculator', 'Calculator'],
          ['invoices', 'Quotes & invoices'],
          ['notebook', 'Notebook'],
          ['birthdays', 'Birthdays'],
          ['marketing', 'Marketing']
        ]
      : [
          ['clients', CL()],
          ['cases', T.tenancyMode ? 'Buy to let properties' : 'All ' + NS()],
          ['pipeline', 'Pipeline'],
          ['appointments', 'Appointments'],
          ['tasks', T.tenancyMode ? 'Calendar' : 'Tasks'],
          ['reminders', 'Reminders'],
          ['invoices', 'Quotes & invoices'],
          ['calculator', 'Mortgage Calculator'],
          ['notebook', 'Notebook'],
          ['birthdays', 'Birthdays'],
          ['marketing', 'Marketing']
        ]
  );
  if (T.tenancyMode)
    items = items.map(function (i) {
      return i[0] === 'cases' ? ['assets', 'My Properties and Cars'] : i;
    });
  var mgNav = T.id === 'mortgage';
  if (mgNav)
    /* the mortgage adviser's menu: All cases and Tasks across the top; the tools down the side */
    items = [
      ['cases', 'All ' + NS()],
      ['tasks', 'Tasks'],
      ['calculator', 'Mortgage Calculator'],
      ['appointments', 'Calendar'],
      ['notebook', 'Notebook'],
      ['birthdays', 'Birthdays'],
      ['marketing', 'Marketing']
    ];
  var tdIx = items
      .map(function (i) {
        return i[0];
      })
      .indexOf('tasks'),
    tdAnch = 'tasks';
  if (tdIx < 0) {
    tdIx = items
      .map(function (i) {
        return i[0];
      })
      .indexOf('appointments');
    tdAnch = 'appointments';
  }
  if (!mgNav) {
    items.splice(tdIx < 0 ? 0 : tdIx + 1, 0, ['todo', 'To do']);
    items = items.filter(function (i) {
      return i[0] !== 'reminders';
    });
    items.splice(
      items
        .map(function (i) {
          return i[0];
        })
        .indexOf('todo') + 1,
      0,
      ['reminders', 'Reminders']
    );
  }
  var dc = dueCount(),
    tdc = allTasks().filter(function (x) {
      return trBucket(x) === 'over';
    }).length;
  if (!T.tenancyMode && !mgNav) items.unshift(['assets', 'My Properties and Cars']);
  var tools = {
    assets: T.tenancyMode ? 0 : 1,
    logout: 1,
    tradesmen: 1,
    invoices: 1,
    calculator: 1,
    notebook: 1,
    birthdays: 1,
    marketing: 1,
    bookappt: 1,
    gendocs: 1,
    acctset: 1,
    myhome: 1,
    more: 1
  };
  if (mgNav) tools.appointments = 1;
  if (T.calTab) tools.tasks = 1;
  if (T.calTab && tdAnch === 'tasks') {
    tools.todo = 1;
    tools.reminders = 1;
  }
  /* every other trade: the top menu is just Today, the main list and (where it has one) Appointments;
     everything else is in the tools menu (the side menu on a computer, the same Menu button on a phone) */
  if (!T.tenancyMode && !mgNav) {
    var topKeep = { todo: 1, cases: 1, appointments: 1 },
      ORD = [
        'todo',
        'cases',
        'appointments',
        'tasks',
        'reminders',
        'clients',
        'pipeline',
        'invoices',
        'calculator',
        'notebook',
        'birthdays',
        'marketing',
        'assets'
      ],
      rank = function (i) {
        var x = ORD.indexOf(i[0]);
        return x < 0 ? 99 : x;
      };
    items.forEach(function (i) {
      tools[i[0]] = topKeep[i[0]] ? 0 : 1;
    });
    items = items
      .map(function (i) {
        return i[0] === 'todo' ? ['todo', 'Today'] : i;
      })
      .sort(function (a, b) {
        return rank(a) - rank(b);
      });
  }
  if (T.tenancyMode)
    items = items
      .filter(function (i) {
        return i[0] !== 'invoices' && i[0] !== 'marketing' && i[0] !== 'notebook';
      })
      .concat(
        [
          ['tradesmen', 'My tradesmen'],
          ['gendocs', 'Reports and agreements'],
          ['more', navMore ? 'Less' : 'More']
        ]
          .concat(
            navMore
              ? [
                  ['notebook', 'Notebook'],
                  ['bookappt', 'Book appointment']
                ]
              : []
          )
          .concat([['acctset', 'Settings']])
          .concat(NAV_MQ && NAV_MQ.matches ? [['logout', 'Log out']] : [])
      );
  var mk = function (list) {
    return list
      .map(function (i) {
        return (
          '<button data-v="' +
          i[0] +
          '"' +
          (view === i[0] || (view === 'mycar' && i[0] === 'assets') ? ' aria-current="page"' : '') +
          '>' +
          i[1] +
          (i[0] === 'myhome' ? homeSmall(true) : '') +
          (i[0] === 'reminders' && dc ? '<span class="badge">' + dc + ' overdue</span>' : '') +
          (i[0] === 'tasks' && tdc ? '<span class="badge">' + tdc + ' overdue</span>' : '') +
          (i[0] === 'todo' && tdDue() ? '<span class="badge">' + tdDue() + ' today</span>' : '') +
          (i[0] === 'birthdays' && bdCounts(bdPeople().list).today
            ? '<span class="badge" style="background:#fde4ee;color:#c2185b">' +
              bdCounts(bdPeople().list).today +
              ' today</span>'
            : '') +
          (i[0] === 'appointments' && apTodayN()
            ? '<span class="badge" style="background:var(--accent-soft,#dbe9f8);color:var(--accent)">' +
              apTodayN() +
              ' today</span>'
            : '') +
          '</button>'
        );
      })
      .join('');
  };
  var hideRem = false,
    n1 = $('#nav'),
    n2 = $('#nav2'),
    one = T.tenancyMode && NAV_MQ && NAV_MQ.matches;
  /* landlords on a phone: every menu item in one row that swipes sideways, Settings last */
  n1.classList.toggle('onerow', !!one);
  n1.classList.toggle('dk', !!T.tenancyMode);
  if (one) {
    var keep = n1.scrollLeft,
      ord = items.slice(),
      mi = ord
        .map(function (i) {
          return i[0];
        })
        .indexOf('myhome');
    if (mi > 0) ord.unshift(ord.splice(mi, 1)[0]);
    n1.innerHTML = mk(
      ord.filter(function (i) {
        return !(hideRem && i[0] === 'reminders');
      })
    );
    if (n2) n2.innerHTML = '';
    n1.scrollLeft = keep;
    var cur = n1.querySelector('[aria-current="page"]');
    if (
      cur &&
      (cur.offsetLeft < n1.scrollLeft || cur.offsetLeft + cur.offsetWidth > n1.scrollLeft + n1.clientWidth)
    )
      n1.scrollLeft = Math.max(0, cur.offsetLeft - 12);
    phoneMenu();
    return;
  }
  n1.innerHTML = mk(
    items.filter(function (i) {
      return !tools[i[0]] && !(hideRem && i[0] === 'reminders');
    })
  );
  if (n2)
    n2.innerHTML = mk(
      items.filter(function (i) {
        return tools[i[0]];
      })
    );
  phoneMenu();
}
/* phones and small screens: the menu rows fold into one drop-down menu button, for every trade */
function phoneMenu() {
  var host = document.querySelector('header.top .in');
  if (!host) return;
  var b = $('#mnuBtn'),
    pn = $('#mnuPanel');
  if (!b) {
    b = document.createElement('button');
    b.id = 'mnuBtn';
    b.type = 'button';
    b.className = 'btn mnubtn';
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', 'mnuPanel');
    var br = host.querySelector('.brand');
    if (br) br.insertAdjacentElement('afterend', b);
    else host.insertBefore(b, host.firstChild);
  }
  if (!pn) {
    pn = document.createElement('div');
    pn.id = 'mnuPanel';
    pn.className = 'mnupanel';
    pn.setAttribute('role', 'menu');
    pn.hidden = true;
    document.body.appendChild(pn);
  }
  var seen = {},
    rows = [];
  [].slice.call(document.querySelectorAll('#nav button[data-v], #nav2 button[data-v]')).forEach(function (x) {
    var v = x.dataset.v;
    if (v === 'more' || v === 'logout' || v === 'acctset' || seen[v]) return;
    seen[v] = 1;
    rows.push({ v: v, h: x.innerHTML, cur: x.getAttribute('aria-current') === 'page' });
  });
  if (T && T.tenancyMode) {
    if (!seen.notebook) rows.push({ v: 'notebook', h: 'Notebook', cur: view === 'notebook' });
    if (!seen.bookappt) rows.push({ v: 'bookappt', h: 'Book appointment', cur: false });
  }
  var cur = rows.filter(function (r) {
    return r.cur;
  })[0];
  b.innerHTML = '<span aria-hidden="true" class="mnuic">&#9776;</span> <span>Menu</span>';
  b.setAttribute('aria-label', 'Menu' + (cur ? ', now on ' + String(cur.h).replace(/<[^>]*>/g, '') : ''));
  pn.innerHTML =
    rows
      .map(function (r) {
        return (
          '<button type="button" role="menuitem" data-v="' +
          r.v +
          '"' +
          (r.cur ? ' aria-current="page"' : '') +
          '>' +
          r.h +
          '</button>'
        );
      })
      .join('') +
    '<div class="mnusep"></div><button type="button" role="menuitem" data-mnuset="1">Settings</button><button type="button" role="menuitem" ' +
    'data-mnulogout="1" class="mnulo">Log out</button>';
}
function mnuClose() {
  var pn = $('#mnuPanel'),
    b = $('#mnuBtn');
  if (pn) pn.hidden = true;
  if (b) b.setAttribute('aria-expanded', 'false');
}
document.addEventListener(
  'click',
  function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b = t.closest('#mnuBtn'),
      pn = $('#mnuPanel');
    if (b && pn) {
      var open = pn.hidden;
      pn.hidden = !open;
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var h = document.querySelector('header.top');
        var tp = h ? h.getBoundingClientRect().bottom : 56;
        pn.style.top = tp + 'px';
        pn.style.maxHeight = Math.max(200, window.innerHeight - tp - 12) + 'px';
      }
      return;
    }
    if (t.closest('#mnuPanel')) {
      var st = t.closest('[data-mnuset]');
      mnuClose();
      if (st) {
        var sb = $('#settingsBtn');
        if (sb) sb.click();
      }
      return;
    }
    if (pn && !pn.hidden) mnuClose();
  },
  true
);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') mnuClose();
});
window.addEventListener('resize', mnuClose);
var NAV_MQ = window.matchMedia ? window.matchMedia('(max-width:759px)') : null;
if (NAV_MQ) {
  var navMqFn = function () {
    if (T && appReady) renderNav();
  };
  if (NAV_MQ.addEventListener) NAV_MQ.addEventListener('change', navMqFn);
  else if (NAV_MQ.addListener) NAV_MQ.addListener(navMqFn);
}

function toolItems(l) {
  return l.filter(function (i) {
    return (
      !(i[0] === 'appointments' && !T.apptTab && T.id !== 'mortgage') &&
      !(i[0] === 'calculator' && !T.calculator) &&
      !(i[0] === 'birthdays' && !T.dob) &&
      !(T.hideTabs && T.hideTabs.indexOf(i[0]) > -1)
    );
  });
}
function gbp2(n) {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function calcPay(P, rate, n) {
  var r = rate / 1200;
  return r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
}
function taxCalcShell() {
  return (
    '<div class="pagehead"><h1>Calculator</h1><span class="muted">VAT and a quick sole trader tax estimate</span></div><div id="calcMain" class="calc taxcalc">' +
    '<div class="calcin"><h2 style="font-size:16px;margin:0 0 8px">VAT</h2><div class="grid">' +
    '<label class="f">Amount<span class="ig"><i>£</i><input id="tcVat" type="number" step="any" inputmode="decimal" placeholder="e.g. 120.00"></span></label>' +
    '<label class="f">VAT rate<select id="tcRate"><option value="20">Standard 20%</option><option value="5">Reduced 5%</option><option value="0">Zero 0%</option></select></label>' +
    '<label class="f">The amount is<select id="tcMode"><option value="net">Without VAT (add it)</option><option value="gross">With VAT (take it out)</option></select></label></div><div id="tcVatOut"></div></div>' +
    '<div class="calcin" style="margin-top:14px"><h2 style="font-size:16px;margin:0 0 8px">Sole trader tax estimate</h2><div class="grid">' +
    '<label class="f">Taxable profit for the year<span class="ig"><i>£</i><input id="tcProfit" type="number" step="any" inputmode="decimal" placeholder="e.g. 45000"></span></label>' +
    '<label class="f">Other taxable income (optional)<span class="ig"><i>£</i><input id="tcOther" type="number" step="any" inputmode="decimal" placeholder="0"></span></label></div><div id="tcTaxOut"></div>' +
    '<p class="muted" style="font-size:12.5px;margin:10px 0 0">An estimate for 2026/27 for England, Wales and Northern Ireland: personal allowance £12,570, income tax 20%, 40% and 45%, Class 4 National Insurance 6% and 2%. It leaves out Scottish rates, dividends, student loans, pension and Gift Aid. Use it as a guide, not as a tax computation.</p></div></div>'
  );
}
function taxCalcUpdate() {
  var a = parseFloat($('#tcVat').value),
    r = parseFloat($('#tcRate').value) / 100,
    g = $('#tcMode').value === 'gross',
    vo = $('#tcVatOut');
  if (vo)
    vo.innerHTML =
      a >= 0
        ? (function () {
            var net = g ? a / (1 + r) : a,
              vat = g ? a - net : a * r,
              gross = g ? a : a + vat;
            return (
              '<div class="calcbox" style="margin-top:10px"><div class="crow"><span>Without VAT</span><b>' +
              gbp2(net) +
              '</b></div><div class="crow"><span>VAT</span><b>' +
              gbp2(vat) +
              '</b></div><div class="crow"><span>With VAT</span><b>' +
              gbp2(gross) +
              '</b></div></div>'
            );
          })()
        : '<p class="muted" style="margin:10px 0 0">Enter an amount to work out the VAT.</p>';
  var p = parseFloat($('#tcProfit').value),
    o = parseFloat($('#tcOther').value) || 0,
    to = $('#tcTaxOut');
  if (!to) return;
  if (!(p >= 0)) {
    to.innerHTML =
      '<p class="muted" style="margin:10px 0 0">Enter the taxable profit to see an estimate.</p>';
    return;
  }
  var inc = p + o,
    pa = inc > 100000 ? Math.max(0, 12570 - (inc - 100000) / 2) : 12570,
    ti = Math.max(0, inc - pa),
    it =
      Math.min(ti, 37700) * 0.2 +
      Math.max(0, Math.min(ti, 125140) - 37700) * 0.4 +
      Math.max(0, ti - 125140) * 0.45,
    n4 = Math.max(0, Math.min(p, 50270) - 12570) * 0.06 + Math.max(0, p - 50270) * 0.02,
    tot = it + n4;
  to.innerHTML =
    '<div class="calcbox" style="margin-top:10px"><div class="crow"><span>Personal allowance used</span><b>' +
    gbp2(pa) +
    '</b></div><div class="crow"><span>Income tax</span><b>' +
    gbp2(it) +
    '</b></div><div class="crow"><span>Class 4 National Insurance</span><b>' +
    gbp2(n4) +
    '</b></div><div class="crow"><span><b>Total tax and NI</b></span><b>' +
    gbp2(tot) +
    '</b></div><div class="crow"><span>Set aside each month</span><b>' +
    gbp2(tot / 12) +
    '</b></div><div class="crow"><span>Left from the profit</span><b>' +
    gbp2(p - tot) +
    '</b></div></div>';
}
function calcShell() {
  if (T.calcKind === 'tax') return taxCalcShell();
  var list = cases.slice().sort(function (a, b) {
    return names(a).toLowerCase() < names(b).toLowerCase() ? -1 : 1;
  });
  return (
    '<div class="pagehead"><h1>Mortgage calculator</h1><span class="muted">Monthly payment, repayment and interest only</span></div><div id="calcMain" class="calc">' +
    '<div class="calcin"><label class="f">Fill from a case (optional)<select id="calcCase"><option value="">Choose a case, or type the figures below</option>' +
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
    '</select></label>' +
    '<div class="grid" style="margin-top:10px"><label class="f">Mortgage amount<span class="ig"><i>£</i><input id="calcAmt" type="number" step="any" inputmode="decimal" placeholder="e.g. 250000"></span></label>' +
    '<label class="f">Term (years)<input id="calcYrs" type="number" step="1" inputmode="numeric" placeholder="e.g. 25"></label>' +
    '<label class="f">Extra months (optional)<input id="calcMon" type="number" step="1" min="0" max="11" inputmode="numeric" placeholder="0"></label>' +
    '<label class="f">Interest rate (% a year)<input id="calcRate" type="number" step="any" inputmode="decimal" placeholder="e.g. 4.5"></label></div></div>' +
    '<div id="calcOut"></div></div>'
  );
}
function calcUpdate() {
  if (T.calcKind === 'tax') {
    taxCalcUpdate();
    return;
  }
  var out = $('#calcOut');
  if (!out) return;
  var P = parseFloat($('#calcAmt').value),
    y = parseFloat($('#calcYrs').value) || 0,
    m = parseFloat($('#calcMon').value) || 0,
    R = parseFloat($('#calcRate').value),
    n = Math.round(y * 12 + m);
  if (!(P > 0) || !(n > 0) || isNaN(R) || R < 0) {
    out.innerHTML =
      '<p class="muted" style="margin:14px 0">Enter the mortgage amount, term and interest rate to see the monthly payments.</p>';
    return;
  }
  var rp = calcPay(P, R, n),
    io = (P * R) / 1200,
    tr = rp * n,
    ti = io * n,
    t = Math.floor(n / 12) + ' years' + (n % 12 ? ' ' + (n % 12) + ' months' : '');
  var rises = [1, 2, 3]
    .map(function (d) {
      var p2 = calcPay(P, R + d, n);
      return (
        '<tr><td>Rate ' +
        (R + d).toFixed(2).replace(/\.?0+$/, '') +
        '% (+' +
        d +
        '%)</td><td>' +
        gbp2(p2) +
        '</td><td>' +
        gbp2(p2 - rp) +
        ' more</td><td>' +
        gbp2(((R + d) * P) / 1200) +
        '</td></tr>'
      );
    })
    .join('');
  out.innerHTML =
    '<div class="calcres"><div class="calcbox"><div class="ct">Repayment</div><div class="cbig">' +
    gbp2(rp) +
    '<span> a month</span></div>' +
    '<div class="crow"><span>Total interest over ' +
    t +
    '</span><b>' +
    gbp2(tr - P) +
    '</b></div><div class="crow"><span>Total repaid</span><b>' +
    gbp2(tr) +
    '</b></div><div class="crow"><span>Mortgage left at the end</span><b>£0.00</b></div></div>' +
    '<div class="calcbox io"><div class="ct">Interest only</div><div class="cbig">' +
    gbp2(io) +
    '<span> a month</span></div>' +
    '<div class="crow"><span>Total interest over ' +
    t +
    '</span><b>' +
    gbp2(ti) +
    '</b></div><div class="crow"><span>Total paid by you</span><b>' +
    gbp2(ti) +
    '</b></div><div class="crow"><span>Mortgage left at the end</span><b>' +
    gbp2(P) +
    '</b></div></div></div>' +
    '<div class="calcdiff">Interest only is <b>' +
    gbp2(rp - io) +
    '</b> a month cheaper, but the full <b>' +
    gbp2(P) +
    '</b> is still owed at the end of the term.</div>' +
    '<div class="calcrise"><b>If the rate rises</b><table><thead><tr><th></th><th>Repayment</th><th>Change</th><th>Interest only</th></tr></thead><tbody>' +
    rises +
    '</tbody></table></div>' +
    '<p class="muted" style="font-size:12px">Monthly payments are worked out with the rate compounded monthly. Figures are an illustration, not a quote. A lender may calculate slightly differently.</p>';
}
function render() {
  renderNav();
  applySide();
  if (typeof rmRefresh === 'function') rmRefresh();
  var v = $('#view');
  if (!db) {
    v.innerHTML = '<div class="banner">Saving is not available. Sign in to store your ' + NS() + '.</div>';
    return;
  }
  if (!loaded) {
    v.innerHTML = '<div class="empty">Loading your ' + NS() + '…</div>';
    return;
  }
  if ((view === 'calculator' && !T.calculator) || (view === 'birthdays' && !T.dob)) view = 'tasks';
  if (T.hideTabs && T.hideTabs.indexOf(view) > -1) view = T.landing || 'tasks';
  if (T.id === 'mortgage' && view === 'pipeline') view = 'cases';
  if (T.tenancyMode && (view === 'invoices' || view === 'marketing')) view = 'cases';
  if (!T.tenancyMode && view === 'tradesmen') view = T.landing || 'tasks';
  if (T.tenancyMode && view === 'cases') view = 'assets';
  if (view === 'tasks') {
    var CALV = T.tenancyMode || T.calTab;
    if ((!CALV && (!$('#trList') || !v.contains($('#trList')))) || (CALV && !$('#homeCal'))) {
      v.innerHTML =
        '<div class="homesplit' +
        (CALV ? ' nocal' : ' calfull') +
        '"><section class="hp" id="homeCal" aria-label="Appointments calendar"></section>' +
        (CALV
          ? ''
          : '<section class="hp htk" aria-label="Tasks"><div class="pagehead"><h1>Tasks</h1><span class="muted">Due today first, then overdue, then soonest</span></div><div class="tpage">' +
            taskShell() +
            '</div></section>') +
        '<aside class="hp hrem" id="homeRem" aria-label="Upcoming reminders"></aside></div>';
    }
    var hc = $('#homeCal');
    if (hc && !$('#apOv')) hc.innerHTML = apHome();
    if (!CALV) renderTray();
    renderRem();
  } else if (view === 'notebook') {
    if (!$('#nbMain') || !v.contains($('#nbMain'))) {
      v.innerHTML = nbShell();
      nbShown = null;
    }
    renderNotebook();
  } else if (view === 'calculator') {
    if (!$('#calcMain') || !v.contains($('#calcMain'))) {
      v.innerHTML = calcShell();
      calcUpdate();
    }
  } else if (view === 'marketing') {
    var mr = $('#mkRoot');
    if (!mr || !v.contains(mr) || mr.getAttribute('data-tab') !== mkTab) v.innerHTML = mkShell();
    mkList();
  } else if (view === 'birthdays') {
    if (!$('#bdList') || !v.contains($('#bdList'))) {
      v.innerHTML = bdShell();
      bdTplRender();
    }
    bdRender();
  } else if (view === 'appointments') v.innerHTML = apHTML();
  else if (view === 'clients') {
    if (!$('#clList') || !v.contains($('#clList'))) v.innerHTML = clShell();
    clRender();
  } else if (view === 'invoices') v.innerHTML = invoicesHTML();
  else if (view === 'pipeline') v.innerHTML = pipelineHTML();
  else if (view === 'cases') v.innerHTML = casesHTML();
  else if (view === 'assets') v.innerHTML = assetsHTML();
  else if (view === 'mycar') v.innerHTML = carPageHTML();
  else if (view === 'tradesmen') v.innerHTML = tmHTML();
  else if (view === 'todo') {
    if (
      !(
        document.activeElement &&
        document.activeElement.id === 'td-text' &&
        v.contains(document.activeElement)
      ) ||
      !$('#homeCal')
    ) {
      v.innerHTML = tdHTML();
      tdFill();
    }
  } else if (view === 'myhome')
    v.innerHTML =
      '<div class="pagehead"><h1>Residential property</h1><button type="button" class="btn backbtn" data-asback="1">&larr; Back to My Properties and Cars</button></div>' +
      homeCard(true);
  else v.innerHTML = remindersHTML();
}
function emptyHTML() {
  return (
    '<div class="empty"><h2>No ' +
    NS() +
    ' yet</h2>Add your first ' +
    N1() +
    ' to track it from enquiry to the end, with ' +
    (T.tenancyMode || T.noTasks
      ? 'notes, appointments and reminders for key dates.'
      : 'tasks, notes, appointments and reminders for key dates.') +
    '<br><button class="btn" data-act="new">Add your first ' +
    N1() +
    '</button>' +
    (imKind()
      ? '<p class="muted" style="font-size:12.5px;margin:10px 0 0">Bringing in an existing list? Use Settings › Backup and restore › Import.</p>'
      : '') +
    '</div>'
  );
}

/* ---------- pipeline ---------- */
function pipelineHTML() {
  if (!cases.length) return emptyHTML();
  var list = sortList(
    visible().filter(function (c) {
      return c.stage !== 'lost';
    })
  );
  var vk = T.value.k,
    vv = function (c) {
      return +fv(c, vk) || 0;
    };
  var active = list.filter(function (c) {
    return stageOf(c) !== T.doneStage;
  });
  var vol = active.reduce(function (a, c) {
    return a + vv(c);
  }, 0);
  var h =
    '<div class="pagehead"><h1>Pipeline</h1><div class="stats">' +
    '<div class="stat"><b>' +
    active.length +
    '</b><span>Live ' +
    NS() +
    '</span></div>' +
    '<div class="stat"><b>' +
    money(vol) +
    '</b><span>' +
    esc(T.value.l) +
    '</span></div></div></div><div class="board">';
  STAGES.forEach(function (s, i) {
    var cs = list.filter(function (c) {
      return stageOf(c) === s.id;
    });
    var sum = cs.reduce(function (a, c) {
      return a + vv(c);
    }, 0);
    h +=
      '<section class="col" data-stage="' +
      s.id +
      '"><h3>' +
      s.label +
      '<span>' +
      cs.length +
      '</span></h3><div class="sum">' +
      (sum ? money(sum) : '&nbsp;') +
      '</div><div class="cards">';
    cs.forEach(function (c) {
      var ne = nextEvent(c),
        next = STAGES[i + 1];
      h +=
        '<div class="card" draggable="true" tabindex="0" role="button" data-open="' +
        c.id +
        '">' +
        '<div class="nm">' +
        esc(names(c)) +
        cno(c) +
        '</div>' +
        '<div class="ad">' +
        esc(short(fv(c, T.addr)) || c.type || '') +
        '</div>' +
        '<div class="row"><span class="num">' +
        (fv(c, vk) !== '' ? money(fv(c, vk)) : '') +
        '</span><span class="muted">' +
        esc(fmtField(c, T.sub)) +
        '</span></div>' +
        (ne
          ? '<div><span class="chip ' +
            tone(ne.date) +
            '">' +
            esc(ne.label.split('.')[0]) +
            ' · ' +
            rel(ne.date) +
            '</span></div>'
          : '') +
        (next
          ? '<button class="btn ghost sm go" data-adv="' +
            c.id +
            '" data-to="' +
            next.id +
            '">Move to ' +
            next.label +
            ' →</button>'
          : '') +
        '</div>';
    });
    h += '</div></section>';
  });
  return h + '</div>';
}

/* ---------- cases table ---------- */
var colsHide = (function () {
  try {
    return JSON.parse(localStorage.getItem('cd.ui.colsHide') || '[]');
  } catch (e) {
    return [];
  }
})();
function colOn(k) {
  return colsHide.indexOf(k) < 0;
}
function lenderSelHTML() {
  if (!T.filter) return '';
  var fk = T.filter.k,
    ls = {};
  cases.forEach(function (c) {
    if (c[fk]) ls[c[fk]] = 1;
  });
  return (
    '<select id="lenderSel" aria-label="Filter by ' +
    esc(T.filter.l) +
    '"><option value="">All ' +
    esc(T.filter.l) +
    '</option>' +
    Object.keys(ls)
      .sort()
      .map(function (l) {
        return (
          '<option value="' +
          esc(l) +
          '"' +
          (lenderFilter === l ? ' selected' : '') +
          '>' +
          esc(l) +
          '</option>'
        );
      })
      .join('') +
    '</select>'
  );
}
function revSelHTML() {
  var ms = {};
  cases.forEach(function (c) {
    var r = reviewOf(c);
    if (r) ms[r.slice(0, 7)] = 1;
  });
  return (
    '<select id="revSel" aria-label="Filter by key date month"><option value="">Any ' +
    esc(T.reviewWord.toLowerCase()) +
    ' month</option>' +
    Object.keys(ms)
      .sort()
      .map(function (m) {
        return (
          '<option value="' +
          m +
          '"' +
          (revFilter === m ? ' selected' : '') +
          '>' +
          new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) +
          '</option>'
        );
      })
      .join('') +
    '<option value="none"' +
    (revFilter === 'none' ? ' selected' : '') +
    '>No ' +
    esc(T.reviewWord.toLowerCase()) +
    ' date</option></select>'
  );
}
/* one row of the cases table (also used to list a company's directors' own properties) */
function caseRowHTML(c, ing) {
  var mg = T.id === 'mortgage',
    shown = T.cols.filter(function (x) {
      return colOn(x[0]);
    });
  var ad = T.tenancyMode
    ? [c.type, c.bedrooms ? c.bedrooms + ' bed' : ''].filter(Boolean).join(' · ')
    : short(fv(c, T.addr)) || short(((c.applicants || [])[0] || {}).address);
  var rv0 = mg ? reviewOf(c) : '',
    rd0 = rv0 ? diff(rv0) : 9999;
  return (
    '<tr class="click' +
    (mg
      ? ' stc st-' +
        esc(stageOf(c) || 'enquiry') +
        (rd0 <= 30 ? ' rend-red' : rd0 <= 90 ? ' rend-amb' : '') +
        (ing ? ' ing' : '')
      : '') +
    '" data-open="' +
    c.id +
    '">' +
    (mg ? '<td class="cnocol">' + esc(c.clientNo || '') + '</td>' : '') +
    '<td><b>' +
    esc(names(c)) +
    '</b>' +
    (mg ? propTag(c) : cno(c)) +
    (mg && isSpv(c) && pnames(c) !== 'Unnamed client'
      ? '<div class="muted" style="font-size:12px">Directors: ' + esc(pnames(c)) + '</div>'
      : '') +
    '<div class="muted" style="font-size:12px">' +
    esc(ad) +
    '</div></td>' +
    shown
      .map(function (x) {
        var k = x[0];
        if (k === 'type') return '<td>' + esc(c.type || '') + '</td>';
        if (k === 'tenants')
          return (
            '<td>' +
            (tnCurrent(c)
              .map(function (tn) {
                return esc(tnNames(tn) || 'Unnamed tenant');
              })
              .join('<br>') || '<span class="muted">None</span>') +
            '</td>'
          );
        if (k === 'rentSum') {
          var rs = rentSum(c);
          return '<td class="num">' + (rs ? money(Math.round(rs * 100) / 100) : '—') + '</td>';
        }
        if (k === 'occ') return '<td>' + occChip(c) + '</td>';
        if (k === 'legal') return '<td>' + lgChip(c) + '</td>';
        if (k === 'rentSt') return '<td>' + rentStatusCell(c) + '</td>';
        if (k === 'stage')
          return '<td><span class="chip">' + esc(STAGE_LABEL[stageOf(c)] || '') + '</span></td>';
        if (k === 'task') return taskCell(c);
        if (k === 'review') {
          var rv = reviewOf(c);
          return (
            '<td>' +
            (rv
              ? '<span class="chip ' + tone(rv) + '">' + fd(rv) + '</span>'
              : '<span class="muted">—</span>') +
            '</td>'
          );
        }
        if (k === 'note') return '<td class="ntc">' + latestNoteCell(c) + '</td>';
        if (k === 'prot') return '<td class="ntc">' + latestNoteCell(c, 'protection') + '</td>';
        var sub =
          T.sub === k && T.subRef
            ? '<div class="muted num" style="font-size:12px">' + esc(fmtField(c, T.subRef)) + '</div>'
            : '';
        return '<td>' + esc(fmtField(c, k)) + sub + '</td>';
      })
      .join('') +
    '</tr>'
  );
}
/* colour key for the stage colours on the rows, and the red and amber edge for a review or rate end that is close */
function stLegendHTML() {
  return (
    '<div class="stlegend" aria-label="Colour key">' +
    STAGES.concat([{ id: 'lost', label: 'Closed lost' }])
      .map(function (x) {
        return '<span class="stl st-' + x.id + '">' + esc(x.label) + '</span>';
      })
      .join('') +
    '<span class="stlnote"><i class="rbar red"></i> review or rate end within 30 days <i class="rbar amb"></i> within 90 days</span></div>'
  );
}
function casesHTML(embed) {
  var CASE_COLS = T.cols,
    list = sortList(visible());
  var opts =
    '<option value="">All stages</option>' +
    STAGES.concat([{ id: 'lost', label: 'Closed lost' }])
      .map(function (s) {
        return (
          '<option value="' +
          s.id +
          '"' +
          (stageFilter === s.id ? ' selected' : '') +
          '>' +
          s.label +
          '</option>'
        );
      })
      .join('');
  var llSum = T.tenancyMode
    ? (function () {
        var let_ = cases.filter(function (c) {
            return c.stage !== 'lost' && tnCurrent(c).length;
          }).length,
          roll = cases.reduce(function (a, c) {
            return a + rentSum(c);
          }, 0);
        return (
          '<div class="stats"><div class="stat"><b>' +
          cases.length +
          '</b><span>Properties</span></div><div class="stat"><b>' +
          let_ +
          '</b><span>Let</span></div><div class="stat"><b>' +
          (cases.length - let_) +
          '</b><span>Vacant</span></div><div class="stat"><b>' +
          money(Math.round(roll * 100) / 100) +
          '</b><span>Rent a month</span></div></div>'
        );
      })()
    : '';
  var h =
    '<div class="pagehead"><h1>' +
    (embed ? 'Investment properties' : T.tenancyMode ? 'Buy to let properties' : 'All ' + NS()) +
    '</h1>' +
    llSum +
    '</div>' +
    dupBar() +
    '<!--F--><div class="filters">' +
    (T.tenancyMode ? '' : '<select id="stageSel" aria-label="Filter by stage">' + opts + '</select> ') +
    '<select id="sortSel" aria-label="Sort clients">' +
    [
      ['updated', 'Sort: recently updated'],
      ['first', 'Sort: first name A–Z'],
      ['review', 'Sort: next ' + T.reviewWord.toLowerCase() + ' date'],
      ['task', T.tenancyMode || T.noTasks ? 'Sort: next reminder or to-do date' : 'Sort: next task due date'],
      ['clientno', 'Sort: client number']
    ]
      .map(function (o) {
        return (
          '<option value="' + o[0] + '"' + (sortBy === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'
        );
      })
      .join('') +
    '</select>' +
    lenderSelHTML() +
    revSelHTML() +
    '<details class="colpick"><summary class="btn ghost">Columns</summary><div class="colbox">' +
    CASE_COLS.map(function (c) {
      return (
        '<label><input type="checkbox" data-colk="' +
        c[0] +
        '"' +
        (colOn(c[0]) ? ' checked' : '') +
        '> ' +
        c[1] +
        '</label>'
      );
    }).join('') +
    '</div></details>' +
    (stageFilter || lenderFilter || revFilter
      ? ' <button type="button" class="btn ghost" data-clrf="1">Clear filters</button>'
      : '') +
    '</div><!--/F-->';
  /* nothing to filter or sort yet: leave those boxes out */
  if (!cases.length) h = h.replace(/<!--F-->[\s\S]*<!--\/F-->/, '');
  h = '<div class="caseswrap">' + h;
  var mg = T.id === 'mortgage';
  if (!cases.length) return h + emptyHTML() + (mg ? '' : mtdCard()) + '</div>';
  var shown = CASE_COLS.filter(function (x) {
    return colOn(x[0]);
  });
  h +=
    (mg ? stLegendHTML() : '') +
    '<div class="tw" tabindex="0" role="region" aria-label="Table: scroll sideways to see more"><table><thead><tr>' +
    (mg ? '<th class="cnoh">No.</th>' : '') +
    '<th>' +
    esc(
      T.tenancyMode
        ? 'Property'
        : T.person[0] === 'Applicant' || T.person[0] === 'Contact'
          ? 'Client'
          : T.person[0]
    ) +
    '</th>' +
    shown
      .map(function (x) {
        return '<th>' + esc(x[1]) + '</th>';
      })
      .join('') +
    '</tr></thead><tbody>';
  if (!list.length)
    h += '<tr><td colspan="' + (shown.length + 1) + '" class="muted">No ' + NS() + ' match.</td></tr>';
  var rowOf = function (c, ing) {
    h += caseRowHTML(c, ing);
  };
  if (mg) {
    var grp = {},
      done = {};
    list.forEach(function (c) {
      var k = clientKey(c);
      (grp[k] = grp[k] || []).push(c);
    });
    list.forEach(function (c0) {
      var k0 = clientKey(c0),
        g = grp[k0];
      if (done[k0]) return;
      done[k0] = 1;
      if (g.length > 1)
        h +=
          '<tr class="cg"><td colspan="' +
          (shown.length + 2) +
          '"><b>' +
          esc(names(c0)) +
          '</b> <span class="muted">' +
          (isSpv(c0) && c0.companyNumber ? '· Company no. ' + esc(c0.companyNumber) + ' ' : '') +
          '· ' +
          g.length +
          ' properties</span></td></tr>';
      g.forEach(function (c) {
        rowOf(c, g.length > 1);
      });
    });
  } else
    list.forEach(function (c) {
      rowOf(c, false);
    });
  return h + '</tbody></table></div>' + (mg ? resHTML(list) + dirPropsHTML(list) : mtdCard()) + '</div>';
}

/* ---------- reminders ---------- */
function remindersHTML() {
  var ev = reviewEvents(),
    q = query.trim().toLowerCase();
  if (q)
    ev = ev.filter(function (e) {
      return (e.who + ' ' + e.label).toLowerCase().indexOf(q) > -1;
    });
  var g = [
    [
      'Overdue',
      'bad',
      function (n) {
        return n < 0;
      }
    ],
    [
      'Next 7 days',
      '',
      function (n) {
        return n >= 0 && n <= 7;
      }
    ],
    [
      'Next 30 days',
      '',
      function (n) {
        return n > 7 && n <= 30;
      }
    ],
    [
      'Later this year and beyond',
      '',
      function (n) {
        return n > 30;
      }
    ]
  ];
  var h =
    '<div class="pagehead"><h1>Reminders</h1><span class="muted">' +
    (T.tenancyMode || T.noTasks
      ? 'Key dates, to-dos and appointments from your calendar'
      : 'Key dates from your ' + NS() + '. Tasks are in the Tasks tab') +
    '</span></div>';
  if (!ev.length)
    return (
      h +
      '<div class="empty"><h2>Nothing due</h2>Key dates you enter on your ' +
      NS() +
      ' (for example ' +
      esc(
        T.reminders
          .slice(0, 2)
          .map(function (r) {
            return r.l.toLowerCase();
          })
          .join(' or ')
      ) +
      ') appear here.</div>'
    );
  g.forEach(function (x) {
    var items = ev.filter(function (e) {
      return x[2](diff(e.date));
    });
    if (!items.length) return;
    h += '<div class="group"><h3 class="' + x[1] + '">' + x[0] + ' · ' + items.length + '</h3>';
    items.forEach(function (e) {
      var rowH =
        '<div class="evrow"><button class="ev" ' +
        (e.kind === 'appt' ? 'data-apedit="' + esc(e.id) + '"' : 'data-open="' + e.id + '"') +
        '><div class="d">' +
        fd(e.date) +
        '<small>' +
        rel(e.date) +
        '</small></div><div><b>' +
        esc(e.label) +
        '</b><div class="who">' +
        esc(e.who) +
        '</div></div><span class="chip ' +
        tone(e.date) +
        '">' +
        esc(e.kind === 'appt' ? 'Appointment' : e.kind === 'task' ? 'To do' : T.reviewWord) +
        '</span></button><button type="button" class="btn ghost sm" data-remdone="' +
        e.id +
        '|' +
        esc(e.key) +
        '|' +
        e.date +
        '"' +
        (e.rep
          ? ' data-rep="1" title="Remind me again in 30 days. Update the date when it is renewed.">In 30 days'
          : ' title="Hide this reminder">Done') +
        '</button></div>';
      h +=
        e.kind === 'appt'
          ? rowH.replace(/<button type="button" class="btn ghost sm" data-remdone.*$/, '</div>')
          : rowH;
    });
    h += '</div>';
  });
  return h;
}

/* ---------- drawer ---------- */
function fld(name, label, val, type, extra) {
  type = type || 'text';
  var inp =
    '<input id="f-' +
    name +
    '" data-f="' +
    name +
    '" type="' +
    type +
    '" value="' +
    esc(val == null ? '' : val) +
    '"' +
    (type === 'number' ? ' step="any" inputmode="decimal"' : '') +
    '>';
  if (extra && extra.gbp) inp = '<span class="ig"><i>£</i>' + inp + '</span>';
  return '<label class="f' + (extra && extra.wide ? ' wide' : '') + '">' + label + inp + '</label>';
}
function sel(name, label, val, opts) {
  return (
    '<label class="f">' +
    label +
    '<select id="f-' +
    name +
    '" data-f="' +
    name +
    '">' +
    opts
      .map(function (o) {
        var v = o[0],
          l = o[1];
        return '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(l) + '</option>';
      })
      .join('') +
    '</select></label>'
  );
}
function contactLinks(t) {
  t = String(t || '');
  var ph = /(?:\+44\s?|\b0)(?:\d[\s-]?){9,10}\b/.exec(t),
    em = /[^\s@,;()]+@[^\s@,;()]+\.[A-Za-z]{2,}/.exec(t);
  return (ph ? plinks(ph[0]) : '') + (em ? elinks(em[0]) : '');
}
function elinks(m) {
  m = String(m || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) return '';
  return '<a href="mailto:' + esc(m) + '" target="_blank" rel="noopener">Send email</a>';
}
function plinks(p) {
  var d = String(p || '').replace(/[^\d+]/g, '');
  if (d.replace(/\D/g, '').length < 7) return '';
  var intl = d.charAt(0) === '+' ? d.slice(1) : d.charAt(0) === '0' ? '44' + d.slice(1) : d;
  return '<a href="https://wa.me/' + intl + '" target="_blank" rel="noopener">WhatsApp</a>';
}
var secCollapsed = {};
function secSumText(x) {
  var rv = x.reviewDate || (x.fixedUntil ? addMonths(x.fixedUntil, -REVM) : '');
  var parts = [x.lender, x.rate ? x.rate + '%' : '', rv ? 'Review ' + fd(rv) : ''].filter(Boolean);
  return parts.join(' · ') || 'No lender details yet';
}
function secRow(x, i) {
  x = x || {};
  var sid = x.id || 's' + Math.random().toString(36).slice(2, 9);
  return (
    '<div class="sec2" data-sid="' +
    sid +
    '"><div class="top2"><span>Security address ' +
    (i + 1) +
    '</span><span><button type="button" class="btn ghost sm" data-rmsec="' +
    sid +
    '">Remove</button></span></div>' +
    '<div class="grid"><label class="f wide">Security address<input data-s="address" value="' +
    esc(x.address) +
    '" placeholder="Full address and postcode"></label></div></div>'
  );
}
function updSRev() {
  updStrip();
}
function stripVal(c, k) {
  if (k === 'rentSum') {
    var rs = rentSum(c);
    return rs ? money(Math.round(rs * 100) / 100) : '—';
  }
  if (k === 'occ') return occOf(c);
  if (k === 'ltv') {
    var l = ltv(c);
    return l ? l.toFixed(1) + '%' : '—';
  }
  if (k === 'next') {
    var r = reviewOf(c);
    return r ? fd(r) : '—';
  }
  return fmtField(c, k) || '—';
}
function stripHtml(c) {
  return (
    '<div class="strip">' +
    T.strip
      .map(function (s, i) {
        return (
          '<div><b data-strip="' +
          i +
          '">' +
          esc(stripVal(c, s[0])) +
          '</b><span>' +
          esc(s[1]) +
          '</span></div>'
        );
      })
      .join('') +
    '</div>'
  );
}
function updStrip() {
  if (!$('#caseForm')) return;
  var c = Object.assign({}, currentCase() || {}, collectForm());
  T.strip.forEach(function (s, i) {
    var b = document.querySelector('[data-strip="' + i + '"]');
    if (b) b.textContent = stripVal(c, s[0]);
  });
  if (T.tenancyMode) lgRefresh(c);
}
function typeOpts(cur) {
  var l = TYPES.slice();
  if (cur && l.indexOf(cur) < 0) l.push(cur);
  return l.map(function (t) {
    return [t, t];
  });
}
/* "Does the property have a mortgage?" (landlord): the mortgage fields show only when the answer is Yes.
   A property saved before this question existed counts as Yes when any mortgage detail is filled in. */
function mortKeys() {
  var out = [];
  (T.sections || []).forEach(function (s) {
    s.fields.forEach(function (f) {
      if (f.mort) out.push(f.k);
    });
  });
  return out;
}
function mortVal(c) {
  if (c && c.hasMortgage) return c.hasMortgage;
  return mortKeys().some(function (k) {
    return c && c[k];
  })
    ? 'Yes'
    : '';
}
function fieldHtml(f, c) {
  if (f.k === 'hasMortgage') {
    var c2 = Object.assign({}, c);
    c2.hasMortgage = mortVal(c);
    return fieldHtml0(f, c2);
  }
  var h = fieldHtml0(f, c);
  if (f.mort)
    h = h.replace(
      '<label class="f',
      '<label data-mort="1"' + (mortVal(c) === 'Yes' ? '' : ' style="display:none"') + ' class="f'
    );
  return h;
}
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t || t.id !== 'f-hasMortgage' || !t.closest('#caseForm')) return;
  var els = [].slice.call(document.querySelectorAll('#caseForm [data-mort]')),
    ins = els
      .map(function (l) {
        return l.querySelector('[data-f]');
      })
      .filter(Boolean);
  if (
    t.value === 'No' &&
    ins.some(function (i) {
      return i.value;
    })
  ) {
    if (!confirm('Choosing No clears the mortgage details saved for this property. Continue?')) {
      t.value = 'Yes';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    ins.forEach(function (i) {
      i.value = '';
    });
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }
  els.forEach(function (l) {
    l.style.display = t.value === 'Yes' ? '' : 'none';
  });
  if (t.value === 'Yes' && ins[0]) ins[0].focus();
});
function fieldHtml0(f, c) {
  var v = c[f.k],
    wc = f.w ? ' wide' : '';
  if (f.t === 'sel') {
    var opts = (f.o || []).map(function (x) {
      return Array.isArray(x) ? x : [x, x === '' ? 'Choose…' : x];
    });
    if (
      v &&
      !opts.some(function (o) {
        return o[0] === v;
      })
    )
      opts.push([v, v]);
    return sel(f.k, esc(f.l), v == null ? '' : v, opts).replace(
      '<label class="f">',
      '<label class="f' + wc + '">'
    );
  }
  if (f.t === 'area')
    return (
      '<label class="f wide">' +
      esc(f.l) +
      '<textarea id="f-' +
      f.k +
      '" data-f="' +
      f.k +
      '" rows="3">' +
      esc(v || '') +
      '</textarea></label>'
    );
  if (f.t === 'date' && f.auto)
    return (
      '<label class="f' +
      wc +
      '">' +
      esc(f.l) +
      '<input id="f-' +
      f.k +
      '" data-f="' +
      f.k +
      '" type="date" data-auto="' +
      (v ? '0' : '1') +
      '" data-from="' +
      f.auto.from +
      '" value="' +
      esc(fv(c, f.k)) +
      '"></label>'
    );
  var h = fld(
    f.k,
    esc(f.l),
    v,
    f.t === 'money' || f.t === 'num' || f.t === 'pct' ? 'number' : f.t === 'date' ? 'date' : 'text',
    { gbp: f.t === 'money', wide: f.w }
  );
  if (f.t === 'text')
    h = h.replace(/<\/label>$/, '<span class="pl cl">' + contactLinks(v) + '</span></label>');
  if (f.doc && T.tenancyMode) h = h.replace(/<\/label>$/, dzSpan(c, f) + '</label>');
  return h;
}
function sectionsHtml(c) {
  return T.sections
    .map(function (s, i) {
      var odd = c.stage && !STAGE_LABEL[c.stage],
        so = STAGES.map(function (x) {
          return [x.id, x.label];
        }).concat([['lost', 'Closed lost']]);
      if (odd) so.unshift([c.stage, c.stage + ' (from your earlier trade)']);
      return (
        secFs(s.id, esc(s.title)) +
        (i === 0
          ? sel('stage', 'Stage', odd ? c.stage : stageOf(c), so) +
            sel('type', 'Type', c.type, typeOpts(c.type))
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
}
function appRow(a, i) {
  a = a || {};
  return (
    '<div class="app" data-app="' +
    i +
    '"><div class="top2"><span>' +
    esc(T.id === 'mortgage' && dirMode ? 'Director' : T.person[0]) +
    ' ' +
    (i + 1) +
    '</span><button type="button" class="btn ghost sm" data-rmapp="' +
    i +
    '">Remove</button></div><div class="grid">' +
    '<label class="f">Full name<input data-a="name" value="' +
    esc(a.name) +
    '"></label>' +
    (T.dob || a.dob
      ? '<label class="f">Date of birth' +
        (T.dob ? '' : ' (optional)') +
        '<input data-a="dob" type="date" value="' +
        esc(a.dob) +
        '"></label>'
      : '') +
    '<label class="f">Phone<input data-a="phone" type="tel" value="' +
    esc(a.phone) +
    '"><span class="pl">' +
    plinks(a.phone) +
    '</span></label>' +
    '<label class="f">Email<input data-a="email" type="email" value="' +
    esc(a.email) +
    '"><span class="pl el">' +
    elinks(a.email) +
    '</span></label>' +
    '<label class="f wide">' +
    (T.id === 'mortgage' ? 'Current address' : 'Address') +
    '<input data-a="address" value="' +
    esc(a.address) +
    '"></label>' +
    (T.id === 'mortgage' ? resFieldsHTML(a) + '</div>' : '</div></div>')
  );
}
var pendingNotes = [];
