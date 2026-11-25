'use strict';
/* MySimpleDesk app: Appointment reminders (every trade).
   The app looks through the booked appointments. When one is tomorrow (or later today and not yet reminded), a bar shows on every screen
   so you can send the client a reminder (WhatsApp, text or email, with the message ready). It can also tell you on this device.
   Nothing is sent by the app: it opens your own WhatsApp, messages or email app with the message ready and you press Send.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
var rmShown = '';
function rmDue() {
  var t = iso(TODAY),
    tm = addDays(t, 1),
    now = new Date(),
    nm = now.getHours() * 60 + now.getMinutes();
  return apSorted(
    (typeof appts !== 'undefined' ? appts : []).filter(function (a) {
      return (
        (a.status || 'booked') === 'booked' &&
        !a.remindedAt &&
        (a.date === tm || (a.date === t && apMin(a.time) > nm))
      );
    })
  );
}
function rmLS(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (e) {}
  return null;
}
function rmWhen(a) {
  var t = iso(TODAY);
  return (a.date === t ? 'today' : 'tomorrow') + ' at ' + (a.time || '');
}
/* the bar under the menu, on every screen */
function rmRefresh() {
  var bar = $('#rmBar');
  if (!bar || !loaded) return;
  var l = rmDue(),
    n = l.length;
  try {
    if (navigator.setAppBadge) {
      if (n) navigator.setAppBadge(n).catch(function () {});
      else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
    }
  } catch (e) {}
  rmNotify(l);
  if (!n || rmLS('cd.rmHide') === iso(TODAY) + '|' + n) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  var key = l
    .map(function (a) {
      return a.id;
    })
    .join(',');
  if (rmShown === key && !bar.hidden) return;
  rmShown = key;
  bar.hidden = false;
  bar.innerHTML =
    '<div class="dupbar" role="status"><span>📅 <b>' +
    n +
    '</b> appointment reminder' +
    (n === 1 ? '' : 's') +
    ' to send: ' +
    esc(
      l
        .slice(0, 2)
        .map(function (a) {
          return (a.time || '') + ' ' + apWho(a) + (a.date === iso(TODAY) ? ' (today)' : '');
        })
        .join(', ') + (n > 2 ? ' and ' + (n - 2) + ' more' : '')
    ) +
    '</span><button type="button" class="btn" data-rmopen="1">Send reminders</button><button type="button" class="btn ghost" data-rmhide="1">Not now</button></div>';
}
/* the list: who to remind, and a button for each */
function rmOpen() {
  var old = $('#rmOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'rmOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:268;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  document.body.appendChild(ov);
  var draw = function () {
    var l = rmDue();
    ov.innerHTML =
      '<div role="dialog" aria-modal="true" aria-label="Appointment reminders" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(600px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:20px 22px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:14px/1.45 system-ui,sans-serif"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:20px">Appointment reminders</h2><button type="button" class="btn ghost" data-rmx="1">Close</button></div><p class="muted" style="margin:6px 0 12px">Press <b>Send reminder</b>: your own WhatsApp, text or email app opens with the message ready, and you press Send. Nothing is sent by this app.</p>' +
      (l.length
        ? l
            .map(function (a) {
              return (
                '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--line,#D4DBDF);border-radius:10px;padding:10px 12px;margin:0 0 8px"><div style="flex:1 1 200px;min-width:0"><b>' +
                esc(apWho(a)) +
                '</b><br><span class="muted">' +
                esc(rmWhen(a)) +
                (a.type && a.type !== 'Other' ? ' · ' + esc(a.type) : '') +
                '</span></div><button type="button" class="btn" data-rmsend="' +
                esc(a.id) +
                '">Send reminder</button><button type="button" class="btn ghost" data-rmskip="' +
                esc(a.id) +
                '" title="Do not remind this client">Skip</button></div>'
              );
            })
            .join('')
        : '<p style="margin:14px 0"><b>All done.</b> There are no more reminders to send.</p>') +
      '</div>';
  };
  draw();
  ov.rmDraw = draw;
  ov.addEventListener('click', function (e) {
    var t = e.target;
    if (t === ov || (t.closest && t.closest('[data-rmx]'))) {
      ov.remove();
      return;
    }
    var s = t.closest && t.closest('[data-rmsend]'),
      k = t.closest && t.closest('[data-rmskip]');
    if (s) {
      var a = appts.filter(function (x) {
        return x.id === s.getAttribute('data-rmsend');
      })[0];
      if (a) waOpen(a, 'remind');
      return;
    }
    if (k) {
      var id = k.getAttribute('data-rmskip');
      rmMark({ id: id });
      var a2 = appts.filter(function (x) {
        return x.id === id;
      })[0];
      if (a2) a2.remindedAt = Date.now();
      draw();
      rmRefresh();
    }
  });
}
/* an appointment counts as reminded once a reminder is opened for sending (or skipped) */
function rmMark(a) {
  var id = a.id;
  if (!id || typeof apCol === 'undefined' || !apCol) return;
  var x = appts.filter(function (y) {
    return y.id === id;
  })[0];
  if (x) x.remindedAt = Date.now();
  write('ap-' + id, function () {
    return apCol.doc(id).update({ remindedAt: Date.now() });
  });
  setTimeout(function () {
    var ov = $('#rmOv');
    if (ov && ov.rmDraw) ov.rmDraw();
    rmRefresh();
  }, 200);
}
/* a device notification, once per day for the same list, while the app is open */
function rmNotify(l) {
  try {
    if (!l.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (rmLS('cd.rmnote') !== '1') return;
    var key =
      iso(TODAY) +
      '|' +
      l
        .map(function (a) {
          return a.id;
        })
        .join(',');
    if (rmLS('cd.rmnoted') === key) return;
    rmLS('cd.rmnoted', key);
    var title = 'Appointment reminders to send',
      body =
        l.length +
        ' to remind: ' +
        l
          .slice(0, 3)
          .map(function (a) {
            return (a.time || '') + ' ' + apWho(a);
          })
          .join(', ') +
        (l.length > 3 ? ' and more' : ''),
      opt = { body: body, tag: 'rm', icon: '/icon-192.png' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready)
      navigator.serviceWorker.ready.then(
        function (r) {
          r.showNotification(title, opt);
        },
        function () {
          new Notification(title, opt);
        }
      );
    else new Notification(title, opt);
  } catch (e) {}
}
/* Settings: turn the device notification on or off (asks the browser for permission the first time) */
window.CD_rmOn = function () {
  return rmLS('cd.rmnote') === '1' && 'Notification' in window && Notification.permission === 'granted';
};
window.CD_rmToggle = function () {
  if (window.CD_rmOn()) {
    rmLS('cd.rmnote', null);
    return Promise.resolve(false);
  }
  if (!('Notification' in window)) {
    toast('This browser cannot show notifications. The bar in the app still tells you.');
    return Promise.resolve(false);
  }
  return Promise.resolve(Notification.requestPermission()).then(function (p) {
    if (p === 'granted') {
      rmLS('cd.rmnote', '1');
      rmLS('cd.rmnoted', null);
      rmRefresh();
      return true;
    }
    toast('Notifications are blocked in this browser. Allow them in the browser settings to use this.');
    return false;
  });
};
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('[data-rmopen]')) {
    rmOpen();
    return;
  }
  if (t.closest('[data-rmhide]')) {
    rmLS('cd.rmHide', iso(TODAY) + '|' + rmDue().length);
    rmRefresh();
  }
});
/* look again every 15 minutes while the app is open (a reminder for an appointment later today, a new day) */
setInterval(
  function () {
    rmRefresh();
  },
  15 * 60 * 1000
);
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) rmRefresh();
});
