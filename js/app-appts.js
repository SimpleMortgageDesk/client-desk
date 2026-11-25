'use strict';
/* MySimpleDesk app: Mortgage adviser: appointment extras (WhatsApp confirmation and reminder, Missed and Rebook, drag an appointment to
   another day) and suggestions made from a note (tasks, appointments, stage moves; nothing is created until Add is pressed).
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */

/* ---------- WhatsApp confirmation and reminder (WhatsApp opens with the message ready; the adviser presses Send) ---------- */
function waDay(d, rel) {
  var x = new Date(d + 'T00:00:00'),
    t = iso(TODAY),
    tm = iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 1));
  if (rel && d === t) return 'today';
  if (rel && d === tm) return 'tomorrow';
  return x.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
function waHow(a) {
  var w = String(a.where || '').trim(),
    m = a.mode || '';
  if (m === 'Phone') return 'by phone' + (w ? ' (' + w + ')' : '');
  if (m === 'Video call') return 'by video call' + (w ? ': ' + w : '');
  if (m === 'In person' || m === 'Office') return 'in person' + (w ? ' at ' + w : '');
  return w ? '(' + w + ')' : '';
}
function waText(a, kind, first) {
  var adv = (profA().name || '').trim(),
    ty = a.type && a.type !== 'Other' ? a.type.toLowerCase() + ' ' : '',
    how = waHow(a),
    hw = how ? how + ' ' : '';
  var sign = adv ? (kind === 'confirm' ? '' : ' Thanks, ' + adv) : '';
  if (kind === 'confirm')
    return (
      'Hi ' +
      first +
      ', ' +
      (adv ? 'this is ' + adv + '. ' : '') +
      'I am confirming your ' +
      ty +
      'appointment ' +
      hw +
      'on ' +
      waDay(a.date) +
      ' at ' +
      a.time +
      '. Please reply to confirm that works for you, or let me know if you need to change it. Thank you.'
    );
  var rel = waDay(a.date, true);
  return (
    'Hi ' +
    first +
    ', just a friendly reminder about your ' +
    ty +
    'appointment ' +
    hw +
    (rel === 'today' || rel === 'tomorrow' ? rel : 'on ' + rel) +
    ' at ' +
    a.time +
    '. Please let me know if you can no longer make it.' +
    sign
  );
}
function waOpen(a, kind) {
  var old = document.getElementById('waOv');
  if (old) old.remove();
  var c =
      apCase(a) ||
      (a.caseId
        ? cases.filter(function (x) {
            return x.id === a.caseId;
          })[0]
        : null),
    ppl = [];
  if (c)
    (c.applicants || []).forEach(function (p) {
      var em = String(p.email || '').trim();
      if (bdIntl(p.phone) || em)
        ppl.push({ name: p.name || 'Client', phone: bdIntl(p.phone) ? p.phone : '', email: em });
    });
  var ov = document.createElement('div');
  ov.id = 'waOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:270;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  var when = waDay(a.date) + ' at ' + a.time;
  ov.innerHTML =
    '<div role="dialog" aria-modal="true" aria-label="WhatsApp message" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(580px,100%);max-height:92vh;overflow:auto;border-radius:12px;padding:20px 22px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:14px system-ui,sans-serif">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:20px">' +
    (kind === 'confirm' ? 'Appointment booked' : 'Send a reminder') +
    '</h2><button type="button" class="btn ghost" id="waX">' +
    (kind === 'confirm' ? 'Skip' : 'Close') +
    '</button></div>' +
    '<p class="muted" style="margin:8px 0 12px">' +
    esc(a.who || 'Client') +
    ' · ' +
    esc(when) +
    '</p>' +
    '<div class="grid" style="margin-bottom:10px"><label class="f">Message<select id="waKind"><option value="confirm"' +
    (kind === 'confirm' ? ' selected' : '') +
    '>Booking confirmation</option><option value="remind"' +
    (kind === 'remind' ? ' selected' : '') +
    '>Reminder</option></select></label>' +
    (ppl.length > 1
      ? '<label class="f">Send to<select id="waTo">' +
        ppl
          .map(function (p, i) {
            return '<option value="' + i + '">' + esc(p.name) + ' · ' + esc(p.phone || p.email) + '</option>';
          })
          .join('') +
        '</select></label>'
      : ppl.length === 1
        ? '<div class="f"><span>Send to</span><div style="padding:8px 0">' +
          esc(ppl[0].name) +
          ' · ' +
          esc(ppl[0].phone || ppl[0].email) +
          '</div></div>'
        : '<label class="f">Client WhatsApp number<input type="tel" id="waNum" placeholder="07..."></label>') +
    '</div>' +
    '<label class="f">Message (you can edit it before sending)<textarea id="waTxt" rows="7" style="width:100%;box-sizing:border-box"></textarea></label>' +
    '<div class="add" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="waGo">Open WhatsApp</button><button type="button" class="btn ghost" id="waSms">Send as a text</button><button type="button" class="btn ghost" id="waEm">Send by email</button><button type="button" class="btn ghost" id="waCp">Copy message</button></div>' +
    '<p class="muted" style="font-size:12px;margin:10px 0 0">WhatsApp, your messages app or your email opens with the message ready. You press Send there. Do not put NI numbers, bank details or income figures in the message.</p></div>';
  document.body.appendChild(ov);
  function who() {
    var s = document.getElementById('waTo'),
      p = ppl[s ? +s.value : 0];
    return p || { name: a.who || '', phone: (document.getElementById('waNum') || {}).value || '', email: '' };
  }
  function first() {
    return bdFirst(who().name) || 'there';
  }
  function fill() {
    var tx = document.getElementById('waTxt'),
      k = document.getElementById('waKind').value;
    tx.value = waText(a, k, first());
  }
  fill();
  ov.addEventListener('change', function (e) {
    if (e.target.id === 'waKind' || e.target.id === 'waTo') fill();
  });
  ov.addEventListener('mousedown', function (e) {
    if (e.target === ov) ov.remove();
  });
  ov.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') ov.remove();
  });
  ov.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.id === 'waX') {
      ov.remove();
      return;
    }
    var tx = document.getElementById('waTxt').value;
    if (b.id === 'waCp') {
      try {
        navigator.clipboard.writeText(tx).then(
          function () {
            toast('Message copied');
          },
          function () {
            toast('Could not copy. Select the text and press Ctrl+C');
          }
        );
      } catch (x) {
        toast('Could not copy. Select the text and press Ctrl+C');
      }
      return;
    }
    var isRem = (document.getElementById('waKind') || {}).value === 'remind';
    if (b.id === 'waSms') {
      var sn = bdIntl(who().phone);
      if (!sn) {
        toast('This client has no mobile number saved. Type one in first.');
        return;
      }
      if (isRem) rmMark(a);
      window.location.href = 'sms:+' + sn + '?&body=' + encodeURIComponent(tx);
      toast('Text message opened for ' + first());
      ov.remove();
      return;
    }
    if (b.id === 'waEm') {
      var em2 = who().email;
      if (!em2) {
        toast('This client has no email address saved.');
        return;
      }
      if (isRem) rmMark(a);
      window.location.href =
        'mailto:' +
        em2 +
        '?subject=' +
        encodeURIComponent('Appointment reminder') +
        '&body=' +
        encodeURIComponent(tx);
      toast('Email opened for ' + first());
      ov.remove();
      return;
    }
    if (b.id === 'waGo') {
      var n = bdIntl(who().phone);
      if (!n) {
        toast("Enter the client's WhatsApp number first");
        var ni = document.getElementById('waNum');
        if (ni) ni.focus();
        return;
      }
      if (isRem) rmMark(a);
      waGo('https://wa.me/' + n + '?text=' + encodeURIComponent(tx));
      toast('WhatsApp opened for ' + first());
      ov.remove();
    }
  });
}

/* ---------- notes -> suggested tasks / appointments / stage ---------- */
var noteSug = null;
var SUG_ACT =
  /\b(call|ring|phone|chase|chasing|email|send|book|follow(?:\s|-)?up|remind|check|request|submit|arrange|contact|speak to|ask|text|upload|order|instruct|get|obtain|confirm|update|review|visit|meet|meeting|appointment|zoom|teams)\b/i;
var SUG_MEET =
  /\b(call|ring|phone|visit|meet|meeting|appointment|zoom|teams|speak to|review meeting|sign)\b/i;
var SUG_STAGE = [
  [/\b(offer(ed)?\s+(received|issued|out|came through)|mortgage offer|formal offer)\b/i, 'offer'],
  [/\b(completed|completion (took place|went through|happened)|keys released)\b/i, 'completed'],
  [/\b(fma|full (mortgage )?application|application)\s+(submitted|sent|keyed|in)\b/i, 'application'],
  [
    /\b(dip|aip|decision in principle|agreement in principle)\s+(agreed|approved|accepted|passed|done|obtained)\b/i,
    'dip'
  ],
  [/\bfact(\s|-)?find\s+(done|completed|booked|held)\b/i, 'factfind']
];
var SUG_DOW = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 0,
  sun: 0
};
function sugWhen(s) {
  var now = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()),
    d = null,
    m,
    low = s.toLowerCase();
  if (/\btoday\b|\bthis (morning|afternoon|evening)\b|\btonight\b/.test(low)) d = new Date(now);
  else if (/\btomorrow\b/.test(low)) {
    d = new Date(now);
    d.setDate(d.getDate() + 1);
  } else if ((m = low.match(/\bin (\d+|a|one|two|three|four|five|six)\s*(day|week|month)s?\b/))) {
    var n = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[m[1]] || +m[1];
    d = new Date(now);
    if (m[2] === 'day') d.setDate(d.getDate() + n);
    else if (m[2] === 'week') d.setDate(d.getDate() + 7 * n);
    else d.setMonth(d.getMonth() + n);
  } else if (
    (m = low.match(
      /\b(next|this|on|by|before)?\s*(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/
    ))
  ) {
    var want = SUG_DOW[m[2]],
      diff = (want - now.getDay() + 7) % 7;
    if (diff === 0 && m[1] !== 'this') diff = 7;
    if (m[1] === 'next' && diff < 7) diff += 0;
    d = new Date(now);
    d.setDate(d.getDate() + diff);
  } else if (/\bnext week\b/.test(low)) {
    d = new Date(now);
    d.setDate(d.getDate() + ((8 - now.getDay()) % 7 || 7));
  } else if (/\bend of (the )?month\b/.test(low)) {
    d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (/\bend of (the )?week\b/.test(low)) {
    d = new Date(now);
    d.setDate(d.getDate() + ((5 - now.getDay() + 7) % 7));
  } else if ((m = low.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/))) {
    var yy = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
    var dd = new Date(yy, +m[2] - 1, +m[1]);
    if (!m[3] && dd < now) dd.setFullYear(yy + 1);
    if (!isNaN(dd)) d = dd;
  } else if (
    (m = low.match(
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b(?:\s+(\d{4}))?/
    ))
  ) {
    var mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
      m[2].slice(0, 3)
    );
    var d2 = new Date(m[3] ? +m[3] : now.getFullYear(), mi, +m[1]);
    if (!m[3] && d2 < now) d2.setFullYear(d2.getFullYear() + 1);
    d = d2;
  }
  var time = '';
  if ((m = low.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/))) {
    var hh = (+m[1] % 12) + (m[3] === 'pm' ? 12 : 0);
    time = ('0' + hh).slice(-2) + ':' + (m[2] || '00');
  } else if ((m = low.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/))) time = ('0' + m[1]).slice(-2) + ':' + m[2];
  else if ((m = low.match(/\bat (\d{1,2})\b/)) && +m[1] >= 7 && +m[1] <= 20)
    time = ('0' + m[1]).slice(-2) + ':00';
  if (time && !d) d = new Date(now);
  return { date: d ? iso(d) : '', time: time };
}
function sugClean(s) {
  s = s
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;,]+$/, '');
  if (s.length > 90) s = s.slice(0, 87).replace(/\s\S*$/, '') + '…';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function noteSuggest(text, c) {
  var out = [],
    seen = {},
    existing = ((c && c.tasks) || [])
      .filter(function (x) {
        return !x.done;
      })
      .map(function (x) {
        return x.text.toLowerCase();
      });
  var parts = text
    .split(/[.!?]+\s+|\n+|;\s+/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  parts.forEach(function (s) {
    if (out.length >= 3) return;
    var low = s.toLowerCase();
    if (
      /\b(has|have|had|was|were|did|done|sent|called|rang|spoke|chased|emailed|received|confirmed|completed|agreed)\b/.test(
        low
      ) &&
      !/\b(need|needs|must|should|will|to|remember|remind|next|then|book)\b/.test(low)
    )
      return;
    if (!SUG_ACT.test(s)) return;
    var w = sugWhen(s),
      txt = sugClean(s),
      k = txt.toLowerCase();
    if (seen[k] || existing.indexOf(k) > -1) return;
    seen[k] = 1;
    if (w.time && SUG_MEET.test(s)) out.push({ kind: 'appt', text: txt, date: w.date, time: w.time });
    else out.push({ kind: 'task', text: txt, date: w.date, time: w.time });
  });
  var cur = (c && c.stage) || '',
    order = STAGES.map(function (s) {
      return s.id;
    });
  for (var i = 0; i < SUG_STAGE.length; i++) {
    if (SUG_STAGE[i][0].test(text)) {
      var st = SUG_STAGE[i][1];
      if (st !== cur && order.indexOf(st) > order.indexOf(cur))
        out.push({ kind: 'stage', stage: st, text: 'Move stage to ' + STAGE_LABEL[st] });
      break;
    }
  }
  return out.length ? { items: out.slice(0, 4) } : null;
}
function sugLabel(x) {
  var fd = function (s) {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };
  if (x.kind === 'stage') return '<span class="sgk">Stage</span> ' + esc(x.text);
  if (x.kind === 'appt')
    return (
      '<span class="sgk">Appointment</span> ' +
      esc(x.text) +
      ' <span class="muted">· ' +
      fd(x.date) +
      ' ' +
      esc(x.time) +
      '</span>'
    );
  return (
    '<span class="sgk">Task</span> ' +
    esc(x.text) +
    (x.date
      ? ' <span class="muted">· due ' + fd(x.date) + (x.time ? ' ' + esc(x.time) : '') + '</span>'
      : ' <span class="muted">· no date found, add one after</span>')
  );
}
function sugHtml() {
  if (!noteSug || !noteSug.items.length) return '';
  return (
    '<div id="ntSug" class="ntsug" role="region" aria-label="Suggested from this note"><div class="sgh"><b>Suggested from this note</b><span class="muted"> · nothing is created until you press Add</span><button type="button" class="btn ghost sm" data-sgall="1">Dismiss all</button></div>' +
    noteSug.items
      .map(function (x, i) {
        return (
          '<div class="sgi"><span>' +
          sugLabel(x) +
          '</span><span class="sgb"><button type="button" class="btn sm" data-sgadd="' +
          i +
          '">Add</button><button type="button" class="btn ghost sm" data-sgx="' +
          i +
          '">Dismiss</button></span></div>'
        );
      })
      .join('') +
    '</div>'
  );
}
function sugApply(i) {
  var x = noteSug && noteSug.items[i],
    c = currentCase();
  if (!x || !c) return;
  if (x.kind === 'task') {
    patch(openId, {
      tasks: (c.tasks || []).concat([
        {
          id: uid(),
          text: x.text,
          due: x.date || '',
          time: x.time || '',
          done: false,
          created: Date.now(),
          pri: false,
          from: 'note'
        }
      ])
    });
    toast('Task added');
  } else if (x.kind === 'stage') {
    var ss = $('#f-stage');
    if (ss) ss.value = x.stage;
    patch(openId, { stage: x.stage });
    toast('Stage set to ' + STAGE_LABEL[x.stage]);
  } else if (x.kind === 'appt') {
    apOpen(null, x.date || iso(TODAY), openId);
    setTimeout(function () {
      var s = $('#apSlSel');
      if (s && x.time) {
        var mm = apMin(x.time),
          r = Math.round(mm / 15) * 15,
          v = apT(r);
        if (
          [].some.call(s.options, function (o) {
            return o.value === v;
          })
        ) {
          s.value = v;
          s.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      var n = $('#apNotes');
      if (n && !n.value) n.value = x.text;
    }, 80);
  }
  noteSug.items.splice(i, 1);
  if (!noteSug.items.length) noteSug = null;
  if (x.kind !== 'appt') renderLive();
  else {
    var b = $('#ntSug');
    if (b) b.outerHTML = sugHtml();
  }
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t.closest) return;
  var ad = t.closest('[data-sgadd]');
  if (ad) {
    sugApply(+ad.getAttribute('data-sgadd'));
    return;
  }
  var dx = t.closest('[data-sgx]');
  if (dx) {
    if (noteSug) {
      noteSug.items.splice(+dx.getAttribute('data-sgx'), 1);
      if (!noteSug.items.length) noteSug = null;
    }
    var b = $('#ntSug');
    if (b) b.outerHTML = sugHtml();
    return;
  }
  if (t.closest('[data-sgall]')) {
    noteSug = null;
    var b2 = $('#ntSug');
    if (b2) b2.remove();
    return;
  }
});

/* missed appointment -> rebook task on the case */
function apMissTask(a) {
  var c =
    a &&
    a.caseId &&
    cases.filter(function (x) {
      return x.id === a.caseId;
    })[0];
  if (!c) return false;
  var txt =
    'Rebook missed ' +
    (a.type || 'appointment').toLowerCase() +
    ' from ' +
    new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (
    (c.tasks || []).some(function (x) {
      return !x.done && x.text.toLowerCase() === txt.toLowerCase();
    })
  )
    return false;
  patch(c.id, {
    tasks: (c.tasks || []).concat([
      {
        id: uid(),
        text: txt,
        due: iso(TODAY),
        time: '',
        done: false,
        created: Date.now(),
        pri: true,
        from: 'missed'
      }
    ])
  });
  return true;
}

/* ---------- drag an appointment to another day / time ---------- */
var apDrag = null,
  apDragUsed = false;
function apDragGhost(a) {
  var g = document.createElement('div');
  g.className = 'apghost';
  g.textContent = (a.time || '') + ' ' + apWho(a);
  document.body.appendChild(g);
  return g;
}
function apDragCell(x, y) {
  var el = document.elementFromPoint(x, y);
  return el && el.closest ? el.closest('.apcell[data-apday]') : null;
}
function apDragClear() {
  document.querySelectorAll('.apcell.drop').forEach(function (c) {
    c.classList.remove('drop');
  });
}
function apDragEnd() {
  if (!apDrag) return;
  if (apDrag.ghost) apDrag.ghost.remove();
  apDragClear();
  document.body.classList.remove('apdragging');
  apDrag = null;
}
document.addEventListener('pointerdown', function (e) {
  if (e.button && e.button !== 0) return;
  var h = e.target.closest && e.target.closest('[data-apdrag]');
  if (!h) return;
  if (!document.querySelector('.apcell[data-apday]')) return;
  var id = h.getAttribute('data-apdrag'),
    a = appts.filter(function (x) {
      return x.id === id;
    })[0];
  if (!a) return;
  apDrag = { id: id, a: a, x: e.clientX, y: e.clientY, on: false, ghost: null, pid: e.pointerId, h: h };
  try {
    h.setPointerCapture(e.pointerId);
  } catch (_) {}
});
document.addEventListener('pointermove', function (e) {
  if (!apDrag || e.pointerId !== apDrag.pid) return;
  if (!apDrag.on) {
    if (Math.abs(e.clientX - apDrag.x) + Math.abs(e.clientY - apDrag.y) < 7) return;
    apDrag.on = true;
    apDrag.ghost = apDragGhost(apDrag.a);
    document.body.classList.add('apdragging');
  }
  e.preventDefault();
  apDrag.ghost.style.left = e.clientX + 12 + 'px';
  apDrag.ghost.style.top = e.clientY + 12 + 'px';
  var c = apDragCell(e.clientX, e.clientY);
  apDragClear();
  if (c) c.classList.add('drop');
});
document.addEventListener('pointerup', function (e) {
  if (!apDrag || e.pointerId !== apDrag.pid) return;
  var d = apDrag,
    c = d.on ? apDragCell(e.clientX, e.clientY) : null;
  apDragEnd();
  if (!d.on) return;
  apDragUsed = true;
  setTimeout(function () {
    apDragUsed = false;
  }, 300);
  if (c) apMoveOpen(d.id, c.getAttribute('data-apday'));
});
document.addEventListener('pointercancel', function () {
  apDragEnd();
});
function apMoveOpen(id, date) {
  var a = appts.filter(function (x) {
    return x.id === id;
  })[0];
  if (!a) return;
  apMoveClose();
  var s0 = apMin(a.time),
    lo = Math.min(7 * 60, s0),
    hi = Math.max(21 * 60 + 45, s0);
  var day = appts.filter(function (x) {
      return x.id !== id && x.date === date && (x.status || 'booked') === 'booked';
    }),
    opts = '';
  for (var m = lo; m <= hi; m += 15) {
    var busy = day.filter(function (x) {
      return apMin(x.time) < m + 15 && apMin(x.time) + (+x.dur || 30) > m;
    })[0];
    opts +=
      '<option value="' +
      apT(m) +
      '"' +
      (m === s0 ? ' selected' : '') +
      '>' +
      apT(m) +
      (busy ? '  — booked: ' + esc(apWho(busy)) : '') +
      '</option>';
  }
  var fd = function (s) {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };
  var o = document.createElement('div');
  o.id = 'apMvOv';
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-label', 'Move appointment');
  o.innerHTML =
    '<div class="apmv"><h2>Move appointment</h2><div class="apmvwho">' +
    esc(apWho(a)) +
    '</div>' +
    '<div class="apmvrow"><span class="muted">From</span><b>' +
    fd(a.date) +
    ', ' +
    esc(a.time || '') +
    '</b></div>' +
    '<div class="apmvrow"><span class="muted">To</span><b>' +
    fd(date) +
    (date === a.date ? ' <span class="muted">(same day)</span>' : '') +
    '</b></div>' +
    '<label class="apdsel">New time (15-minute slots)<select id="apMvTime" aria-label="New time">' +
    opts +
    '</select></label>' +
    '<div id="apMvMsg" class="muted" style="min-height:18px;margin-top:6px"></div>' +
    '<div class="apmvbtns"><button type="button" class="btn ghost" data-apmvx="1">Cancel</button><button type="button" class="btn" data-apmvok="1">Move</button></div></div>';
  o.dataset.id = id;
  o.dataset.date = date;
  o.dataset.force = '';
  document.body.appendChild(o);
  var sel = $('#apMvTime');
  if (sel) sel.focus();
}
function apMoveClose() {
  var o = $('#apMvOv');
  if (o) o.remove();
}
function apMoveSave() {
  var o = $('#apMvOv');
  if (!o) return;
  var id = o.dataset.id,
    date = o.dataset.date,
    time = $('#apMvTime').value,
    a = appts.filter(function (x) {
      return x.id === id;
    })[0];
  if (!a) return apMoveClose();
  var dur = +a.dur || 30,
    s0 = apMin(time),
    e0 = s0 + dur,
    msg = $('#apMvMsg');
  var clash =
    (a.status || 'booked') === 'booked'
      ? appts.filter(function (x) {
          return (
            x.id !== id &&
            x.date === date &&
            (x.status || 'booked') === 'booked' &&
            apMin(x.time) < e0 &&
            apMin(x.time) + (+x.dur || 30) > s0
          );
        })
      : [];
  if (clash.length && !o.dataset.force) {
    o.dataset.force = '1';
    msg.textContent =
      'That overlaps with ' +
      apWho(clash[0]) +
      ' at ' +
      clash[0].time +
      '. Press Move again to move it anyway.';
    return;
  }
  if (date === a.date && time === a.time) {
    apMoveClose();
    return;
  }
  var ref = apCol.doc(id),
    d = { date: date, time: time, updatedAt: Date.now() };
  write('ap-' + id, function () {
    return ref.update(d);
  });
  apSel = date;
  var pd = date.split('-');
  apMonth = { y: +pd[0], m: +pd[1] - 1 };
  apMoveClose();
  toast(
    'Appointment moved to ' +
      new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }) +
      ' ' +
      time
  );
  setTimeout(function () {
    if (view === 'appointments' || view === 'tasks') render();
    renderNav();
  }, 30);
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t.closest) return;
  if (t.closest('[data-apmvok]')) {
    apMoveSave();
    return;
  }
  if (t.closest('[data-apmvx]') || t.id === 'apMvOv') {
    apMoveClose();
    return;
  }
});
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'apMvTime') {
    var o = $('#apMvOv');
    if (o) {
      o.dataset.force = '';
      var m = $('#apMvMsg');
      if (m) m.textContent = '';
    }
  }
});
document.addEventListener(
  'keydown',
  function (e) {
    if (e.key === 'Escape' && $('#apMvOv')) {
      apMoveClose();
      e.stopPropagation();
    }
  },
  true
);

/* ---------- the buttons on an appointment card ---------- */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t.closest) return;
  var apm2 = t.closest('[data-apmiss]');
  if (apm2) {
    var mk0 = apm2.getAttribute('data-apmiss'),
      ma0 = appts.filter(function (x) {
        return x.id === mk0;
      })[0];
    write('ap-' + mk0, function () {
      return apCol.doc(mk0).update({ status: 'noshow', updatedAt: Date.now() });
    });
    toast('Marked as missed' + (ma0 && apMissTask(ma0) ? '. Rebook task added' : ''));
    setTimeout(function () {
      if (view === 'appointments' || view === 'tasks') render();
      renderNav();
    }, 30);
    return;
  }
  var wab = t.closest('[data-apwa]');
  if (wab) {
    var wa1 = appts.filter(function (x) {
      return x.id === wab.getAttribute('data-apwa');
    })[0];
    if (wa1) waOpen(wa1, 'remind');
    return;
  }
  var apr = t.closest('[data-aprebook]');
  if (apr) {
    var ra = appts.filter(function (x) {
      return x.id === apr.getAttribute('data-aprebook');
    })[0];
    if (ra) {
      apOpen(null, iso(TODAY), ra.caseId || null);
      setTimeout(function () {
        var ty = $('#apType'),
          md = $('#apMode'),
          dr = $('#apDur');
        if (ty && ra.type) ty.value = ra.type;
        if (md && ra.mode) md.value = ra.mode;
        if (dr && ra.dur) dr.value = ra.dur;
        apDpRender();
      }, 60);
    }
  }
});
document.addEventListener(
  'keydown',
  function (e) {
    if (e.key !== 'Escape') return;
    var w = document.getElementById('waOv');
    if (w) {
      w.remove();
      e.stopPropagation();
    }
  },
  true
);
