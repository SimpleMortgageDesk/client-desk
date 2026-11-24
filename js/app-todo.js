'use strict';
/* MySimpleDesk app: The To do list and the page that opens first.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- To do: the person's own daily tasks. Open ones due today are the first thing seen when the app opens. ---------- */
var tdItems = [],
  tdUserNav = false,
  tdLanded = false;
function tdToday() {
  return iso(new Date());
}
/* due today or overdue and still to do */
function tdIsDue(x, t) {
  if (x.daily) return (x.date || '0000') <= t && x.doneOn !== t;
  return !x.done && (x.date || t) <= t;
}
function tdDue() {
  var t = tdToday();
  return tdItems.filter(function (x) {
    return tdIsDue(x, t);
  }).length;
}
function tdSave(items) {
  var cut = iso(new Date(Date.now() - 30 * 864e5));
  tdItems = items.filter(function (x) {
    return x.daily || !x.done || (x.doneOn || x.date || '9999') >= cut;
  });
  if (setCol)
    write('set-todo', function () {
      return setCol.doc('todo').set({ items: tdItems, updatedAt: Date.now() });
    });
  if (view === 'todo') render();
  renderNav();
}
function tdRow(x, t) {
  var done = x.daily ? x.doneOn === t : !!x.done,
    over = !x.daily && !x.done && (x.date || t) < t;
  var meta = x.daily
    ? (x.date || t) > t
      ? 'Every day from ' + fd(x.date)
      : 'Every day'
    : x.done
      ? 'Done'
      : over
        ? 'Overdue since ' + fd(x.date)
        : x.date && x.date > t
          ? 'Due ' + fd(x.date)
          : 'Due today';
  return (
    '<li class="tdrow' +
    (done ? ' done' : '') +
    '"><button type="button" class="tdchk" data-tdtog="' +
    esc(x.id) +
    '" role="checkbox" aria-checked="' +
    done +
    '" aria-label="' +
    (done ? 'Mark not done: ' : 'Mark done: ') +
    esc(x.text) +
    '">' +
    (done ? '&#10003;' : '') +
    '</button>' +
    '<div class="tdtxt"><span>' +
    esc(x.text) +
    '</span><small' +
    (over ? ' class="tdover"' : '') +
    '>' +
    esc(meta) +
    '</small></div>' +
    '<button type="button" class="btn ghost sm danger" data-tddel="' +
    esc(x.id) +
    '" aria-label="Delete ' +
    esc(x.text) +
    '">Delete</button></li>'
  );
}
function tdHTML() {
  var t = tdToday(),
    open = tdItems.filter(function (x) {
      return tdIsDue(x, t);
    }),
    later = tdItems.filter(function (x) {
      return (x.daily || !x.done) && (x.date || t) > t;
    }),
    dn = tdItems
      .filter(function (x) {
        return x.daily ? x.doneOn === t && (x.date || '0000') <= t : x.done;
      })
      .sort(function (a, b) {
        return String(b.doneOn || '').localeCompare(String(a.doneOn || ''));
      });
  open.sort(function (a, b) {
    return (a.daily ? 1 : 0) - (b.daily ? 1 : 0) || String(a.date || '').localeCompare(String(b.date || ''));
  });
  later.sort(function (a, b) {
    return String(a.date).localeCompare(String(b.date));
  });
  var sec = function (h, l, id, empty) {
    return (
      '<h2 class="tdh" id="' +
      id +
      '">' +
      h +
      (l.length ? ' <span class="tdn">' + l.length + '</span>' : '') +
      '</h2>' +
      (l.length
        ? '<ul class="tdlist" aria-labelledby="' +
          id +
          '">' +
          l
            .map(function (x) {
              return tdRow(x, t);
            })
            .join('') +
          '</ul>'
        : empty
          ? '<p class="muted tdempty">' + empty + '</p>'
          : '')
    );
  };
  return (
    '<div class="pagehead"><h1>To do</h1><span class="muted">' +
    (open.length ? open.length + ' to do today' : 'Nothing left for today') +
    '</span></div>' +
    '<div class="tdhome"><div class="tdmain"><div class="tdpage"><form id="tdForm" class="tdadd" novalidate><label class="f tdtext">What needs doing?<input id="td-text" maxlength="140" autocomplete="off" placeholder="For example: Call the tenant about the boiler"></label>' +
    '<label class="f">Day<input id="td-date" type="date" value="' +
    t +
    '"></label>' +
    '<label class="tdrep"><input id="td-daily" type="checkbox"> Repeat every day</label>' +
    '<div class="add" style="margin:0;align-self:end"><button type="submit" class="btn">Add</button></div></form>' +
    '<p id="tdMsg" role="alert" class="tmmsg"></p>' +
    sec(
      'Today',
      open,
      'tdH1',
      'Nothing to do today. Add something above and it will be the first thing you see when you open the app.'
    ) +
    (later.length ? sec('Coming up', later, 'tdH2') : '') +
    (dn.length ? sec('Done', dn, 'tdH3') : '') +
    '</div></div>' +
    '<aside class="hp hrem" id="homeRem" aria-label="Upcoming reminders"></aside>' +
    '<section class="hp tdcal" id="homeCal" aria-label="Appointments calendar"></section></div>'
  );
}
/* the landing page also carries the Reminders and the Calendar, drawn after the page is in place */
function tdFill() {
  var hc = $('#homeCal');
  if (hc && !$('#apOv')) hc.innerHTML = apHome();
  renderRem();
}
document.addEventListener('submit', function (e) {
  if (!e.target || e.target.id !== 'tdForm') return;
  e.preventDefault();
  var tx = ($('#td-text').value || '').trim().replace(/\s+/g, ' '),
    dt = $('#td-date').value || tdToday(),
    msg = $('#tdMsg');
  if (!tx) {
    msg.textContent = 'Write what needs doing.';
    $('#td-text').focus();
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
    msg.textContent = 'Choose a day.';
    return;
  }
  var daily = !!$('#td-daily').checked;
  tdSave(
    tdItems.concat([
      {
        id: 'td' + uid() + Date.now().toString(36),
        text: tx.slice(0, 140),
        date: dt,
        daily: daily,
        done: false,
        created: Date.now()
      }
    ])
  );
  var f = $('#td-text');
  if (f) {
    f.value = '';
    f.focus();
  }
  toast(daily ? 'Added. It repeats every day.' : 'Added');
});
document.addEventListener(
  'click',
  function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b;
    if (t.closest('[data-v],.brand,[data-mnuset],[data-mnulogout]')) tdUserNav = true;
    if ((b = t.closest('[data-tdtog]'))) {
      var id = b.getAttribute('data-tdtog'),
        td = tdToday();
      tdSave(
        tdItems.map(function (x) {
          if (x.id !== id) return x;
          if (x.daily) return Object.assign({}, x, { doneOn: x.doneOn === td ? null : td });
          var nd = !x.done;
          return Object.assign({}, x, { done: nd, doneOn: nd ? td : null });
        })
      );
      return;
    }
    if ((b = t.closest('[data-tddel]'))) {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Delete?';
        return;
      }
      var di = b.getAttribute('data-tddel');
      tdSave(
        tdItems.filter(function (x) {
          return x.id !== di;
        })
      );
      toast('Deleted');
    }
  },
  true
);
window.CD_tdLand = function () {
  tdLanded = false;
  tdUserNav = false;
  tdLand();
};
/* opening the app: if something is due today, the To do page is what shows first (unless they have already clicked somewhere) */
function tdLand(n) {
  if (tdLanded) return;
  if (!loaded) {
    if ((n || 0) < 20)
      setTimeout(function () {
        tdLand((n || 0) + 1);
      }, 400);
    return;
  }
  tdLanded = true;
  if (tdUserNav || openId !== undefined) return;
  if (view === 'tasks' || view === undefined) {
    view = landView();
    render();
  }
}
