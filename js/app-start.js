'use strict';
/* MySimpleDesk app: Start-up: connects to storage and shows the first page.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- start ---------- */
appReady = true;
render();
claude.use('db').then(function (d) {
  db = d;
  if (!db) {
    render();
    return;
  }
  col = db.collection('cases');
  nbCol = db.collection('notebook');
  apCol = db.collection('appointments');
  mkCol = db.collection('marketing');
  setCol = db.collection('settings');
  var tradeSeen = false,
    tradeSig = '';
  setCol.onSnapshot(bizSnap, function () {});
  setCol.onSnapshot(
    function (s) {
      var d = s.docs.filter(function (x) {
        return x.id === 'todo';
      })[0];
      tdItems = (d && d.data().items) || [];
      if (view === 'todo') render();
      renderNav();
    },
    function () {}
  );
  setCol.onSnapshot(
    function (s) {
      var d = s.docs.filter(function (x) {
        return x.id === 'cars';
      })[0];
      carItems = (d && d.data().items) || [];
      if ((view === 'assets' || view === 'mycar') && !$('#carOv')) render();
      renderRem();
      renderSide();
      renderNav();
    },
    function () {}
  );
  (window.CD_firstPull || Promise.resolve()).then(function () {
    setTimeout(tdLand, 500);
  });
  setCol.onSnapshot(
    function (s) {
      var d = s.docs.filter(function (x) {
        return x.id === 'tradesmen';
      })[0];
      tmItems = (d && d.data().items) || [];
      if (view === 'tradesmen' && !(document.activeElement && /^tm-/.test(document.activeElement.id || '')))
        render();
    },
    function () {}
  );
  setCol.onSnapshot(function (s) {
    var d0 = s.docs.filter(function (x) {
        return x.id === 'trade';
      })[0],
      dd = d0 && d0.data(),
      tid = dd && dd.trade,
      A0 = window.CD_TRADES.all;
    if (!tid || !A0[tid]) return;
    tradeSeen = true;
    USEDTU = dd.usedTu || null;
    if (window.CD_TRADES.only) return;
    var list = (dd.trades || [tid])
      .filter(function (id) {
        return A0[id];
      })
      .slice(0, Object.keys(A0).length);
    if (!list.length) list = [tid];
    var main = dd.main && A0[dd.main] ? dd.main : list[0],
      sig = list.join('|') + '>' + main,
      changed = sig !== tradeSig;
    tradeSig = sig;
    TRADES = list;
    MAIN_TRADE = main;
    var ov = $('#tpOv');
    if (ov && !window.CD_tradeChosen()) ov.remove();
    var keep = window.CD_tradeChosen() && list.length > 1 && list.indexOf(T.id) > -1,
      target = keep ? T.id : list.indexOf(tid) > -1 ? tid : list[0];
    if (target !== T.id || !window.CD_tradeChosen()) {
      window.CD_tradeSet(target);
      if (openId !== undefined) closeDrawer();
      applyTrade();
      setCases();
      render();
      renderSide();
      renderNav();
    } else if (changed) {
      setCases();
      render();
      renderSide();
      renderNav();
    }
  });
  (window.CD_firstPull || Promise.resolve()).then(function () {
    if (tradeSeen) return;
    if (window.CD_tradeChosen())
      write('set-trade', function () {
        return setCol.doc('trade').set({ trade: T.id, trades: [T.id], main: T.id, updatedAt: Date.now() });
      });
    else openTradePicker(true);
  });
  mkCol.onSnapshot(function (s) {
    var d = s.docs.filter(function (x) {
      return x.id === 'contacts';
    })[0];
    mkItems = (d && d.data().items) || [];
    var dm = s.docs.filter(function (x) {
      return x.id === 'messages';
    })[0];
    mkMsgsDoc = (dm && dm.data().items) || null;
    if (view === 'marketing' && !$('#mkOv') && !mkMsgEdit) mkList();
  });
  apCol.onSnapshot(
    function (s) {
      appts = s.docs.map(function (x) {
        return Object.assign({ id: x.id }, x.data());
      });
      if (view === 'appointments' && !$('#apOv')) render();
      if ((view === 'tasks' || view === 'todo') && !$('#apOv')) {
        var hc2 = $('#homeCal');
        if (hc2) hc2.innerHTML = apHome();
      }
      var na = $('#nextAppt');
      if (na && openId) na.innerHTML = apNextHtml(openId);
      renderNav();
      rmRefresh();
    },
    function () {}
  );
  nbCol.onSnapshot(
    function (s) {
      var all = s.docs.map(function (x) {
          return Object.assign({ id: x.id }, x.data());
        }),
        tp = all.filter(function (x) {
          return x.id === 'bday-template';
        })[0];
      bdCfg = tp
        ? tp.messages && tp.messages.length
          ? { messages: tp.messages, signature: tp.signature != null ? tp.signature : '' }
          : tp.text
            ? { messages: [tp.text], signature: '' }
            : { messages: null, signature: null }
        : { messages: null, signature: null };
      bdCfg.islamic = tp && tp.islamic && tp.islamic.length ? tp.islamic : null;
      var gdoc = all.filter(function (x) {
        return x.id === 'bday-gender';
      })[0];
      bdGen = (gdoc && gdoc.map) || {};
      notes = all.filter(function (x) {
        return x.id !== 'bday-template' && x.id !== 'bday-gender';
      });
      if (view === 'notebook') renderNotebook();
      if (view === 'birthdays') {
        var a2 = document.activeElement;
        if (!(a2 && a2.id === 'bdTplText')) {
          bdTplRender();
          bdRender();
        }
      }
    },
    function () {}
  );
  col.onSnapshot(
    function (snap) {
      casesAll = snap.docs.map(function (x) {
        return Object.assign({ id: x.id }, x.data());
      });
      setCases();
      loaded = true;
      var ae = document.activeElement;
      var typing = ae && ae.id === 'q';
      render();
      if (trayOpen) renderTray();
      clearTimeout(window.__rt);
      window.__rt = setTimeout(function () {
        rtSweep();
        pfSweep();
        hfSweep();
      }, 400);
      if (typing) {
        var q = $('#q');
        q.focus && q.focus();
      }
      if (openId) {
        var ae2 = document.activeElement;
        if (!(
          ae2 &&
          (/^(ntText|prText|tkText|ntEdit)$/.test(ae2.id || '') ||
            (ae2.closest && (ae2.closest('table.nt.xl') || ae2.closest('[data-tkbox]'))))
        ))
          renderLive();
      }
    },
    function () {
      loaded = true;
      db = null;
      render();
      toast('Lost connection to your saved cases');
    }
  );
});
