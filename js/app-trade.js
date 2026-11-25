'use strict';
/* MySimpleDesk app: Choosing and switching trades, auto save, and business details.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- trade (chosen once, kept in OneDrive so every device matches) ---------- */
var setCol = null;
/* an account the owner has switched to "all trades" has no limit of two and no lock */
function allTradesOn() {
  return !!(window.CD_allAt && window.CD_allAt());
}
function saveTrades(list) {
  list = list.slice(0, allTradesOn() ? 99 : 2);
  var tu0 = window.CD_tuAt && window.CD_tuAt();
  if (tu0) USEDTU = tu0;
  var act = list.indexOf(T.id) > -1 ? T.id : list[0];
  if (!MAIN_TRADE || list.indexOf(MAIN_TRADE) < 0) MAIN_TRADE = list[0];
  TRADES = list;
  try {
    localStorage.removeItem('cd.tradehint');
  } catch (e) {}
  window.CD_tradeSet(act);
  var was = openId;
  if (was !== undefined) closeDrawer();
  applyTrade();
  setCases();
  view = landView();
  if (setCol)
    write('set-trade', function () {
      return setCol
        .doc('trade')
        .set({ trade: act, trades: list, main: MAIN_TRADE, usedTu: USEDTU, updatedAt: Date.now() });
    });
  render();
  renderSide();
  renderNav();
}
/* a person with two trades switches between them here; the choice is kept on this device */
function switchTrade(id) {
  if (id === T.id || TRADES.indexOf(id) < 0) return;
  window.CD_tradeSet(id);
  if (openId !== undefined) closeDrawer();
  applyTrade();
  setCases();
  view = landView();
  render();
  renderSide();
  renderNav();
  window.scrollTo(0, 0);
}
function renderSwitch() {
  var host = document.querySelector('header.top .in'),
    el = $('#trSw');
  if (!host) return;
  if (TRADES.length < 1) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'trSw';
    el.className = 'trsw';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Logged in as');
    var br = host.querySelector('.brand');
    if (br) br.insertAdjacentElement('afterend', el);
    else host.insertBefore(el, host.firstChild);
  }
  var all = window.CD_TRADES.all;
  el.className = 'trsw' + (TRADES.length === 1 ? ' one' : '');
  if (TRADES.length > 3) {
    /* many trades: one drop-down instead of a button for each */
    el.className = 'trsw many';
    el.innerHTML =
      '<span class="trl">Logged in as</span><select id="trSel" aria-label="Switch trade">' +
      window.CD_TRADES.order
        .filter(function (id) {
          return TRADES.indexOf(id) > -1;
        })
        .map(function (id) {
          var x = all[id] || {};
          return (
            '<option value="' +
            esc(id) +
            '"' +
            (id === T.id ? ' selected' : '') +
            '>' +
            esc(x.short || x.label || id) +
            '</option>'
          );
        })
        .join('') +
      '</select>';
    return;
  }
  el.innerHTML =
    '<span class="trl">Logged in as</span>' +
    TRADES.slice()
      .sort(function (x, y) {
        return (x === 'landlord') - (y === 'landlord');
      })
      .map(function (id) {
        var x = all[id] || {};
        return (
          '<button type="button" data-trsw="' +
          esc(id) +
          '" aria-pressed="' +
          (id === T.id) +
          '">' +
          esc(x.short || x.label || id) +
          '</button>'
        );
      })
      .join('');
}
/* an invite link like /?trade=plumber: remember it until the person has chosen */
(function () {
  try {
    var q = new URLSearchParams(location.search).get('trade');
    if (q && window.CD_TRADES && window.CD_TRADES.all[q]) localStorage.setItem('cd.tradehint', q);
  } catch (e) {}
})();
var tpSel = [];
/* choosing two trades locks the choice; support unlocks it (admin page) and the unlock is used up when the person next saves their trades */
function tradesLocked() {
  if (allTradesOn()) return false;
  var tu = window.CD_tuAt && window.CD_tuAt();
  return TRADES.length >= 2 && !(tu && tu !== USEDTU);
}
window.CD_tradesLocked = tradesLocked;
/* where the person is, so that after they log out and back in the app can offer to take them back. Only ids and view names are remembered, never client details. */
window.CD_resumeGet = function () {
  if (!loaded || !T) return null;
  var d = document.getElementById('drawer'),
    sc = 0;
  if (openId && d && !d.hidden) {
    var all = d.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) {
        sc = e.scrollTop;
        break;
      }
    }
  }
  var home = !openId && (view === landView() || view === undefined);
  return { trade: T.id, view: view, id: openId || null, sc: Math.round(sc), home: home };
};
window.CD_resumeLabel = function (s) {
  if (!s || !s.id) return null;
  var c = casesAll.filter(function (x) {
    return x.id === s.id;
  })[0];
  return c ? names(c) : null;
};
window.CD_resumeGo = function (s) {
  if (!s) return;
  if (s.trade && s.trade !== T.id && TRADES.indexOf(s.trade) > -1) switchTrade(s.trade);
  if (s.view && s.view !== view && document.querySelector('[data-v="' + s.view + '"]')) {
    view = s.view;
    render();
    renderSide();
    renderNav();
  }
  if (
    s.id &&
    cases.some(function (x) {
      return x.id === s.id;
    })
  ) {
    openDrawer(s.id);
    if (s.sc)
      setTimeout(function () {
        var d = document.getElementById('drawer');
        if (!d) return;
        var all = d.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          var e = all[i];
          if (e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) {
            e.scrollTop = s.sc;
            break;
          }
        }
      }, 350);
  }
};
window.CD_saveForm = function () {
  try {
    if (openId !== undefined) autoSave();
  } catch (e) {}
};
function tradeLockedNote() {
  if ($('#tpOv')) return;
  var o = document.createElement('div');
  o.id = 'tpOv';
  o.className = 'mkov';
  o.innerHTML =
    '<div class="mkpanel tpick" role="dialog" aria-label="Your trades are locked"><h2>Your two trades are locked</h2><p class="muted" style="margin:4px 0 12px">Once two trades are chosen they stay as they are. You can still switch between them with the tabs at the top. To change them, email <a href="mailto:support@mysimpledesk.co.uk?subject=Change%20my%20trades">support@mysimpledesk.co.uk</a> and we will unlock the choice for you.</p><div class="mkact"><button type="button" class="btn ghost" data-tpclose="1">Close</button><a class="btn" href="mailto:support@mysimpledesk.co.uk?subject=Change%20my%20trades">Email support</a></div></div>';
  document.body.appendChild(o);
}
function openTradePicker(first) {
  if ($('#tpOv') || window.CD_TRADES.only) return;
  if (!first && tradesLocked()) {
    tradeLockedNote();
    return;
  }
  var A = window.CD_TRADES,
    o = document.createElement('div');
  o.id = 'tpOv';
  o.className = 'mkov';
  /* a link like mysimpledesk.co.uk/?trade=plumber has the trade ticked already for a new person */
  var hint = '';
  try {
    hint = localStorage.getItem('cd.tradehint') || '';
  } catch (e) {}
  tpSel = first
    ? hint && A.all[hint] && A.order.indexOf(hint) > -1
      ? [hint]
      : []
    : TRADES.length
      ? TRADES.slice()
      : [T.id];
  o.innerHTML =
    '<div class="mkpanel tpick" role="dialog" aria-label="Choose your trades"><h2>' +
    (first ? 'Welcome. I am…' : 'Your trades') +
    '</h2><p class="muted" style="margin:4px 0 12px">' +
    (allTradesOn()
      ? 'This account has every trade. Choose as many as you like and switch between them from the drop-down at the top.'
      : 'Choose one, or two if you work in both. Each has its own list, menu and reminders, and you switch between them with one tap. There is no extra charge for a second one. Once you have chosen two they are locked, and changing them later means emailing support@mysimpledesk.co.uk.') +
    (first
      ? ''
      : ' Your saved records keep all their details. A trade you take off is hidden, not deleted, and comes back if you add it again.') +
    '</p><div class="tpgrid">' +
    A.order
      .map(function (id) {
        var x = A.all[id],
          op = !window.CD_tradeOpen || window.CD_tradeOpen(id);
        return (
          '<button type="button" class="tpb' +
          (tpSel.indexOf(id) > -1 ? ' on' : '') +
          (op ? '' : ' soon') +
          '" data-trade="' +
          id +
          '" aria-pressed="' +
          (tpSel.indexOf(id) > -1) +
          '"' +
          (op ? '' : ' disabled aria-disabled="true"') +
          '><b>' +
          esc(x.label) +
          (op ? '' : ' <em class="tpsoon">Coming soon</em>') +
          '</b><span>' +
          esc(x.noun[1]) +
          ' · ' +
          esc(
            x.stages
              .map(function (s) {
                return s.label.replace(/^\d /, '');
              })
              .slice(0, 4)
              .join(', ')
          ) +
          '…</span></button>'
        );
      })
      .join('') +
    '</div><p id="tpMsg" class="tmmsg" role="alert"></p><div class="mkact">' +
    (first ? '' : '<button type="button" class="btn ghost" data-tpclose="1">Cancel</button>') +
    '<button type="button" class="btn" id="tpGo" data-tpgo="1"' +
    (tpSel.length ? '' : ' disabled') +
    '>Continue</button></div></div>';
  document.body.appendChild(o);
}
window.CD_openTrade = function () {
  openTradePicker(false);
};

/* ---------- auto save (every 5 seconds) ---------- */
var lastAuto = null,
  newBase = null,
  lastND = '',
  lastPD = '';
function draftSave() {
  var a = $('#ntText'),
    b = $('#prText'),
    o = {};
  if (a && a.value !== lastND) {
    lastND = a.value;
    ntDraft = a.value;
    o.noteDraft = a.value;
  }
  if (b && b.value !== lastPD) {
    lastPD = b.value;
    prDraft = b.value;
    o.protDraft = b.value;
  }
  if (Object.keys(o).length)
    patch(openId, o).then(function () {
      var m = $('#autoMsg');
      if (m)
        m.textContent =
          '\u2713 Saved ' +
          new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
}
var creatingNew = false;
function autoSave() {
  if (!openId && col && !creatingNew) {
    var dn = $('#drawer');
    if (dn && !dn.hidden && $('#caseForm')) {
      var nd = collectForm();
      if (hasIdent(nd) && JSON.stringify(nd) !== newBase) {
        creatingNew = true;
        if (!nd.clientNo) nd.clientNo = nextClientNo();
        tagTr(nd);
        var nref = col.doc();
        nd.createdAt = Date.now();
        nd.updatedAt = nd.createdAt;
        nd.tasks = [];
        nd.notes = pendingNotes;
        write(nref.id, function () {
          return nref.set(nd);
        }).then(
          function () {
            creatingNew = false;
            if (!openId && dn && !dn.hidden && $('#caseForm')) {
              openId = nref.id;
              var cf = $('#f-clientNo');
              if (cf && !cf.value) cf.value = nd.clientNo;
              lastAuto = JSON.stringify(collectForm());
              var m = $('#autoMsg');
              if (m)
                m.textContent =
                  '\u2713 Saved ' +
                  new Date().toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
            }
          },
          function () {
            creatingNew = false;
          }
        );
      }
    }
    return;
  }
  if (!openId || !col || lastAuto === null) return;
  var dr = $('#drawer');
  if (!dr || dr.hidden || !$('#caseForm')) return;
  draftSave();
  var data = collectForm();
  if (!hasIdent(data)) return;
  var key = JSON.stringify(data);
  if (key === lastAuto) return;
  lastAuto = key;
  patch(openId, data).then(function () {
    var m = $('#autoMsg');
    if (m)
      m.textContent =
        '\u2713 Saved ' +
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
}
setInterval(autoSave, 5000);
document.addEventListener(
  'mousedown',
  function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#nbBar') && !t.closest('select') && !t.closest('input'))
      e.preventDefault();
  },
  true
);
document.addEventListener(
  'drop',
  function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#nbBody')) {
      e.preventDefault();
      var tx = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
      if (tx) document.execCommand('insertText', false, tx);
    }
  },
  true
);
document.addEventListener(
  'paste',
  function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('table.nt.xl')) {
      e.preventDefault();
      var tx = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').replace(/\s+/g, ' ');
      document.execCommand('insertText', false, tx);
      return;
    }
    if (t && t.closest && t.closest('#nbBody')) {
      var h2 = e.clipboardData && e.clipboardData.getData('text/html');
      var pl2 = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      e.preventDefault();
      if (!h2 || !/<table/i.test(h2)) {
        document.execCommand('insertText', false, pl2);
        return;
      }
      parseTable(h2, function (tb) {
        if (!tb) {
          document.execCommand('insertText', false, pl2);
          return;
        }
        var nn2 = notes.filter(function (x) {
          return x.id === nbShown;
        })[0];
        if (!nn2) return;
        nbSetTables((nn2.tables || []).concat([{ ts: Date.now(), table: { rows: tb.rows } }]));
        toast(
          tb.cut
            ? 'Table added. Only the first 200 rows and 30 columns were kept'
            : 'Table added to this note'
        );
      });
      return;
    }
    if (!t || (t.id !== 'ntText' && t.id !== 'prText')) return;
    var html = e.clipboardData && e.clipboardData.getData('text/html');
    if (!html || !/<table/i.test(html)) return;
    var plain = e.clipboardData.getData('text/plain'),
      s0 = t.selectionStart,
      s1 = t.selectionEnd,
      k = t.id === 'ntText' ? 'nt' : 'pr';
    e.preventDefault();
    parseTable(html, function (tb) {
      if (!tb) {
        t.setRangeText(plain, s0, s1, 'end');
        return;
      }
      if (k === 'nt') ntTable = tb;
      else prTable = tb;
      showPend(k);
      if (tb.cut) toast('That table is large. Only the first 200 rows and 30 columns were kept');
    });
  },
  true
);
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t && t.id === 'bdQ') {
    bdQuery = t.value;
    bdRender();
    return;
  }
  if (t && t.getAttribute && t.getAttribute('data-bdmsg') !== null) {
    bdDraft[t.getAttribute('data-bdmsg')] = t.value;
    return;
  }
});
document.addEventListener('input', function (e) {
  var w = e.target && e.target.closest && e.target.closest('.tblwrap');
  if (!w || !e.target.closest('table.nt.xl') || !w.getAttribute('data-ts')) return;
  clearTimeout(tblTimer);
  tblTimer = setTimeout(function () {
    saveTbl(w);
  }, 700);
});
document.addEventListener('focusout', function (e) {
  var w = e.target && e.target.closest && e.target.closest('.tblwrap');
  if (!w || !e.target.closest('table.nt.xl') || !w.getAttribute('data-ts')) return;
  clearTimeout(tblTimer);
  setTimeout(function () {
    if (document.body.contains(w)) saveTbl(w);
  }, 50);
});
document.addEventListener('keydown', function (e) {
  var td = e.target && e.target.closest && e.target.closest('table.nt.xl td');
  if (!td || e.key !== 'Enter') return;
  e.preventDefault();
  var tr = td.parentNode,
    nx = tr.nextElementSibling;
  if (nx) {
    var cell = nx.children[Array.prototype.indexOf.call(tr.children, td)];
    if (cell) cell.focus();
  }
});
