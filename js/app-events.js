'use strict';
/* MySimpleDesk app: Click, keyboard and form handling for the whole page.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- events ---------- */
document.addEventListener('click', function (e) {
  var cb = e.target.closest && e.target.closest('[data-coltoggle]');
  if (cb) {
    var ck = cb.getAttribute('data-coltoggle'),
      cf = cb.closest('fieldset');
    colOpen[ck] = !colOpen[ck];
    cf.classList.toggle('col-closed', !colOpen[ck]);
    cb.textContent = colOpen[ck] ? 'Hide' : 'Show';
    cb.blur();
    return;
  }
  var sb = e.target.closest && e.target.closest('[data-sectoggle]');
  if (sb) {
    var k = sb.getAttribute('data-sectoggle'),
      fs = sb.closest('fieldset');
    secHidden[k] = !secHidden[k];
    fs.classList.toggle('sec-hidden', !!secHidden[k]);
    sb.textContent = secHidden[k] ? 'Show' : 'Hide';
    try {
      localStorage.setItem('cd.ui.secHidden', JSON.stringify(secHidden));
    } catch (x) {}
    return;
  }
  var t = e.target;
  /* the More menu on a client page */
  var mmb = t.closest('#moreBtn'),
    mmp = $('#moreMenu');
  if (mmb && mmp) {
    mmp.hidden = !mmp.hidden;
    mmb.setAttribute('aria-expanded', mmp.hidden ? 'false' : 'true');
    if (!mmp.hidden) {
      /* placed under the button, kept inside the screen */
      var br = mmb.getBoundingClientRect(),
        pw = mmp.offsetWidth;
      mmp.style.top = br.bottom + 4 + 'px';
      mmp.style.left = Math.max(8, Math.min(br.right - pw, window.innerWidth - pw - 8)) + 'px';
    }
    return;
  }
  if (mmp && !mmp.hidden) {
    mmp.hidden = true;
    var mb2 = $('#moreBtn');
    if (mb2) mb2.setAttribute('aria-expanded', 'false');
  }
  var rdn = t.closest('[data-remdone]');
  if (rdn && rdn.getAttribute('data-remdone').indexOf('__car:') === 0) {
    e.stopPropagation();
    var cp = rdn.getAttribute('data-remdone').split('|'),
      cid = cp[0].slice(6);
    carSave(
      carItems.map(function (x) {
        if (x.id !== cid) return x;
        var nr = Object.assign({}, x.remDone || {});
        nr[cp[1]] = cp[2];
        return Object.assign({}, x, { remDone: nr });
      })
    );
    toast(
      rdn.hasAttribute('data-rep')
        ? 'OK, we will remind you again in 30 days. Update the date when it is renewed and the reminders start again from the new date.'
        : 'Reminder hidden. It comes back if you change that date.'
    );
    return;
  }
  if (rdn && rdn.getAttribute('data-remdone').indexOf('__home|') === 0) {
    e.stopPropagation();
    var hp = rdn.getAttribute('data-remdone').split('|'),
      nh = Object.assign({}, HOME || {});
    nh.remDone = Object.assign({}, nh.remDone || {});
    nh.remDone[hp[1]] = hp[2];
    homeWrite(nh);
    toast(
      rdn.hasAttribute('data-rep')
        ? 'OK, we will remind you again in 30 days. Update the date when it is renewed and the reminders start again from the new date.'
        : 'Reminder hidden. It comes back if you change that date.'
    );
    return;
  }
  if (rdn) {
    e.stopPropagation();
    var rp = rdn.getAttribute('data-remdone').split('|'),
      rc = cases.filter(function (x) {
        return x.id === rp[0];
      })[0];
    if (rc && rp[1].indexOf('task:') === 0) {
      var tid = rp[1].slice(5);
      patch(rc.id, {
        tasks: (rc.tasks || []).map(function (x) {
          return x.id === tid ? Object.assign({}, x, { done: true, doneAt: Date.now() }) : x;
        })
      });
      toast('Reminder done');
      return;
    }
    if (rc) {
      var rm = {};
      Object.assign(rm, rc.remDone || {});
      rm[rp[1]] = rp[2];
      patch(rc.id, { remDone: rm });
      toast(
        rdn.hasAttribute('data-rep')
          ? 'OK, we will remind you again in 30 days. Update the date when it is renewed and the reminders start again from the new date.'
          : 'Reminder hidden. It comes back if you change that date.'
      );
    }
    return;
  }
  var tpb = t.closest('[data-trade]');
  if (tpb && (tpb.disabled || (window.CD_tradeOpen && !window.CD_tradeOpen(tpb.getAttribute('data-trade')))))
    return;
  if (tpb) {
    var tid = tpb.getAttribute('data-trade'),
      ix = tpSel.indexOf(tid),
      tm = $('#tpMsg');
    if (ix > -1) tpSel.splice(ix, 1);
    else if (tpSel.length >= 2) {
      if (tm) tm.textContent = 'You can choose up to two. Take one off first.';
      return;
    } else tpSel.push(tid);
    if (tm) tm.textContent = '';
    document.querySelectorAll('#tpOv [data-trade]').forEach(function (b) {
      var on = tpSel.indexOf(b.getAttribute('data-trade')) > -1;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    var go = $('#tpGo');
    if (go) go.disabled = !tpSel.length;
    return;
  }
  if (t.closest('[data-tpgo]')) {
    if (!tpSel.length) return;
    saveTrades(tpSel.slice());
    var ov = $('#tpOv');
    if (ov) ov.remove();
    toast(
      'Set up for: ' +
        tpSel
          .map(function (id) {
            return (window.CD_TRADES.all[id] || {}).label;
          })
          .join(' and ')
    );
    return;
  }
  var sw = t.closest('[data-trsw]');
  if (sw) {
    switchTrade(sw.getAttribute('data-trsw'));
    return;
  }
  if (t.closest('[data-tpclose]')) {
    var ov2 = $('#tpOv');
    if (ov2) ov2.remove();
    return;
  }
  var adv = t.closest('[data-adv]');
  if (adv) {
    e.stopPropagation();
    patch(adv.dataset.adv, { stage: adv.dataset.to });
    return;
  }
  var o = t.closest('[data-open]');
  if (o && o.dataset.open === '__home') {
    e.preventDefault();
    homeOpen();
    return;
  }
  if (o && String(o.dataset.open || '').indexOf('__car:') === 0) {
    e.preventDefault();
    carOpen(o.dataset.open.slice(6));
    return;
  }
  if (o) {
    e.preventDefault();
    openDrawer(o.dataset.open);
    return;
  }
  if (t.closest('.brand')) {
    nbFlush();
    view = landView();
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (t.closest && t.closest('[data-sideacct]')) {
    var sb = document.getElementById('settingsBtn');
    if (sb) sb.click();
    return;
  }
  var nv = t.closest('#nav button,#nav2 button,#sideTools button[data-v],#mnuPanel button[data-v]');
  if (nv && nv.dataset.v === 'bookappt') {
    apOpen(null, iso(TODAY));
    return;
  }
  if (nv && nv.dataset.v === 'gendocs') {
    gnOpen();
    return;
  }
  if (nv && nv.dataset.v === 'more') {
    navMore = !navMore;
    renderNav();
    renderSide();
    return;
  }
  if (nv && nv.dataset.v === 'logout') {
    var lb = $('#logoutBtn');
    if (lb) lb.click();
    return;
  }
  if (nv && nv.dataset.v === 'acctset') {
    var sb = $('#settingsBtn');
    if (sb) sb.click();
    return;
  }
  if (nv) {
    nbFlush();
    view = nv.dataset.v;
    render();
    return;
  }
  if (t.closest('#newBtn') || t.closest('[data-act="new"]')) {
    if (T.tenancyMode) qaOpen();
    else if (T.id === 'mortgage')
      docAsk('Create a case', 'How do you want to start?', [
        {
          pri: true,
          label:
            '<b>Blank case</b><br><span style="font-size:12.5px;opacity:.8">Type the client and case details yourself.</span>',
          go: function () {
            openDrawer(null);
          }
        },
        {
          label:
            '<b>From a lender PDF</b><br><span style="font-size:12.5px;opacity:.8">Read a decision in principle or mortgage offer on this device and fill in the case. Documents are not stored.</span>',
          go: function () {
            docChoose(importPdfs);
          }
        },
        { label: 'Cancel', go: null }
      ]);
    else openDrawer(null);
    return;
  }
  if (t.id === 'pfBtn') {
    var pc = currentCase();
    if (pc) openPortfolio(clientKey(pc));
    return;
  }
  if (t.closest('[data-act="portfolio"]')) {
    openPortfolio();
    return;
  }
  if (t.closest('[data-act="pdfnew"]')) {
    docChoose(importPdfs);
    return;
  }
  if (t.closest('[data-act="dupes"]')) {
    dupOpen();
    return;
  }
  if (t.closest('[data-act="dupsnooze"]')) {
    dupLS('cd.dupSnooze', String(Date.now() + 7 * 864e5));
    render();
    return;
  }
  if (t.closest('[data-act="export"]')) {
    exportCsv();
    return;
  }
  if (t.closest('#backupBtn')) {
    backupAll();
    return;
  }
  if (t.closest('#trayBtn')) {
    if (trayOpen) closeTray();
    else openTray();
    return;
  }
  if (t.closest('[data-trclose]')) {
    closeTray();
    return;
  }
  if (t.closest('[data-clrf]')) {
    stageFilter = '';
    lenderFilter = '';
    revFilter = '';
    render();
    return;
  }
  var sl = t.closest('[data-sidelater]');
  if (sl) {
    sideLater = !sideLater;
    renderRem();
    return;
  }
  var tg = t.closest('[data-trtog]');
  if (tg) {
    var kk = tg.getAttribute('data-trtog');
    trOpen[kk] = !trOpen[kk];
    renderTray();
    return;
  }
  var tb = t.closest('[data-trbulk]');
  if (tb) {
    trBulk(tb.getAttribute('data-trbulk'));
    return;
  }
  var tf = t.closest('[data-trf]');
  if (tf) {
    trFilter = tf.dataset.trf;
    renderTray();
    return;
  }
  var sz = t.closest('[data-snz]');
  if (sz) {
    var f1 = trFind(sz.dataset.snz);
    if (f1) {
      var base = f1.t.due && diff(f1.t.due) >= 0 ? f1.t.due : iso(TODAY);
      trSet(f1, { due: addDays(base, f1.n) });
    }
    return;
  }
  if (t.id === 'trAdd') {
    trAddTask();
    return;
  }
  if (t.id === 'nbNew') {
    nbNew();
    return;
  }
  var ns1 = t.closest('[data-nbsel]');
  if (ns1) {
    nbFlush();
    nbSel = ns1.dataset.nbsel;
    renderNotebook();
    return;
  }
  if (t.id === 'nbStamp') {
    var nb1 = $('#nbBody');
    nb1.focus();
    var rg = document.createRange();
    rg.selectNodeContents(nb1);
    rg.collapse(false);
    var sg = window.getSelection();
    sg.removeAllRanges();
    sg.addRange(rg);
    document.execCommand(
      'insertHTML',
      false,
      (nb1.textContent.trim() ? '<br><br>' : '') + esc(stampOf(Date.now())) + ' - '
    );
    nbSched();
    return;
  }
  if (t.id === 'nbDel') {
    if (!t.classList.contains('armed')) {
      t.classList.add('armed');
      t.textContent = 'Confirm delete';
      return;
    }
    var nid = nbShown;
    nbSel = null;
    nbShown = null;
    write('nb-' + nid, function () {
      return nbCol.doc(nid).delete();
    }).then(function () {
      toast('Note deleted');
    });
    return;
  }
  if (t.closest('[data-close]')) {
    closeDrawer();
    return;
  }
  if (t.id === 'saveBtn') {
    saveCase();
    return;
  }
  if (t.id === 'addApp') {
    var n = document.querySelectorAll('#apps .app').length;
    $('#apps').insertAdjacentHTML('beforeend', appRow({}, n));
    return;
  }
  if (t.id === 'addSec') {
    var sn = document.querySelectorAll('#secs .sec2').length;
    $('#secs').insertAdjacentHTML('beforeend', secRow({}, sn));
    var na = $('#secs .sec2:last-child [data-s="address"]');
    if (na) na.focus();
    return;
  }
  var rms = t.closest('[data-rmsec]');
  if (rms) {
    var cd = rms.closest('.sec2');
    cd.remove();
    document.querySelectorAll('#secs .sec2').forEach(function (c2, j) {
      var h = c2.querySelector('.top2>span');
      if (h) h.textContent = 'Security address ' + (j + 1);
    });
    updSRev();
    return;
  }
  var sg = t.closest('[data-sectog]');
  if (sg) {
    var cd2 = sg.closest('.sec2'),
      isC = cd2.classList.toggle('sec2-collapsed');
    secCollapsed[cd2.getAttribute('data-sid')] = isC;
    sg.textContent = isC ? 'Show lender details' : 'Hide lender details';
    return;
  }
  var rm = t.closest('[data-rmapp]');
  if (rm) {
    var row = rm.closest('.app');
    if (document.querySelectorAll('#apps .app').length > 1) row.remove();
    return;
  }
  if (t.id === 'apOv') {
    apClose();
    return;
  }
  if (t.id === 'bookBtn') {
    apOpen(null, iso(TODAY), openId);
    return;
  }
  if (t.id === 'tkBook') {
    var tdue = document.getElementById('tkDue');
    apOpen(null, (tdue && tdue.value) || iso(TODAY), openId);
    return;
  }
  var bdf = t.closest && t.closest('[data-bdf]');
  if (bdf) {
    bdFilter = bdf.getAttribute('data-bdf');
    bdRender();
    return;
  }
  var mkt = t.closest && t.closest('[data-mktab]');
  if (mkt) {
    mkTab = mkt.getAttribute('data-mktab');
    mkMsgEdit = null;
    render();
    return;
  }
  if (mkMsgAct(t)) return;
  if (t.closest && t.closest('[data-mkadd]')) {
    mkOpen(null);
    return;
  }
  if (t.closest && t.closest('[data-mkexp]')) {
    mkExport();
    return;
  }
  var mke = t.closest && t.closest('[data-mkedit]');
  if (mke && !(t.closest && t.closest('a'))) {
    mkOpen(mke.getAttribute('data-mkedit'));
    return;
  }
  if (t.closest && t.closest('[data-mksave]')) {
    mkSaveForm();
    return;
  }
  if (t.closest && t.closest('[data-mkcancel]')) {
    mkClose();
    return;
  }
  if (t.id === 'mkOv') {
    mkClose();
    return;
  }
  if (t.closest && t.closest('[data-mkdel]')) {
    if (!t.classList.contains('armed')) {
      t.classList.add('armed');
      t.textContent = 'Confirm delete';
      return;
    }
    var did = mkEditId;
    mkItems = mkItems.filter(function (x) {
      return x.id !== did;
    });
    mkSave();
    mkClose();
    mkList();
    toast('Contact deleted');
    return;
  }
  if (t.closest && t.closest('[data-bdgo]')) {
    view = 'birthdays';
    bdFilter = 'week';
    render();
    return;
  }
  var bdo = t.closest && t.closest('[data-bdopen]');
  if (bdo) {
    var ok = bdo.getAttribute('data-bdopen'),
      cur = bdOpen[ok] !== undefined ? bdOpen[ok] : (bdFind(ok) || { days: 99 }).days <= 7;
    bdOpen[ok] = !cur;
    bdRender();
    return;
  }
  var bds = t.closest && t.closest('[data-bdsend]');
  if (bds) {
    var sp = bdFind(bds.getAttribute('data-bdsend'));
    if (!sp) return;
    var si = bdIntl(sp.phone);
    if (!si) {
      toast('No phone number saved for ' + sp.name);
      return;
    }
    var stx = bdText(sp);
    bdDraft[sp.key] = stx;
    waGo('https://wa.me/' + si + '?text=' + encodeURIComponent(stx));
    bdSetSent(sp, true);
    toast('WhatsApp opened for ' + bdFirst(sp.name));
    return;
  }
  var bdc = t.closest && t.closest('[data-bdcopy]');
  if (bdc) {
    var cp = bdFind(bdc.getAttribute('data-bdcopy'));
    if (!cp) return;
    var ctx = bdText(cp);
    bdDraft[cp.key] = ctx;
    var done = function () {
      toast('Message copied');
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(ctx).then(done, function () {
        toast('Could not copy. Select the text and copy it.');
      });
    else {
      var ta0 = document.querySelector('[data-bdmsg]');
      if (ta0) {
        ta0.select();
        try {
          document.execCommand('copy');
          done();
        } catch (x) {}
      }
    }
    return;
  }
  var bdg = t.closest && t.closest('[data-bdgen]');
  if (bdg) {
    var gv = bdg.getAttribute('data-bdgen'),
      gi = gv.lastIndexOf('|'),
      gk = gv.slice(0, gi);
    bdGen[gk] = gv.slice(gi + 1);
    delete bdDraft[gk];
    write('nb-bday-gender', function () {
      return nbCol.doc('bday-gender').set({ map: bdGen, updatedAt: Date.now() });
    });
    bdRender();
    return;
  }
  var bdk = t.closest && t.closest('[data-bdkind]');
  if (bdk) {
    var kp = bdFind(bdk.getAttribute('data-bdkind'));
    if (kp) {
      bdKind[kp.key] = bdMode(kp) === 'isl' ? 'gen' : 'isl';
      delete bdDraft[kp.key];
      bdRender();
    }
    return;
  }
  var bdh = t.closest && t.closest('[data-bdshuf]');
  if (bdh) {
    var hp = bdFind(bdh.getAttribute('data-bdshuf'));
    if (hp) {
      var n0 = bdList(hp).length,
        cur0 = bdPick(hp),
        tries = 0;
      do {
        bdShuf[hp.key] = (bdShuf[hp.key] || 0) + 1;
        tries++;
      } while (n0 > 1 && bdPick(hp) === cur0 && tries < 30);
      delete bdDraft[hp.key];
      bdRender();
    }
    return;
  }
  if (t.id === 'bdTplBtn') {
    bdTplOpen = !bdTplOpen;
    bdTplRender();
    return;
  }
  if (t.id === 'bdTplSave') {
    var ms = $('#bdMsgsText')
        .value.split(/\n-{3,}\s*\n/)
        .map(function (x) {
          return x.trim();
        })
        .filter(Boolean),
      sg = $('#bdSigText').value.trim();
    if (!ms.length) {
      toast('Write at least one message');
      return;
    }
    if (
      !ms.some(function (x) {
        return x.indexOf('{name}') > -1;
      }) &&
      !confirm('None of your messages has {name}, so the first name will not be added. Save anyway?')
    )
      return;
    var im = $('#bdIslText')
      .value.split(/\n-{3,}\s*\n/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    if (!im.length) im = BD_ISL.slice();
    var islSame = JSON.stringify(im) === JSON.stringify(BD_ISL),
      same = JSON.stringify(ms) === JSON.stringify(BD_MSGS) && sg === bdDefSig().trim() && islSame;
    bdCfg = same
      ? { messages: null, signature: null, islamic: null }
      : { messages: ms, signature: sg, islamic: islSame ? null : im };
    bdDraft = {};
    bdShuf = {};
    write('nb-bday-template', function () {
      return same
        ? nbCol.doc('bday-template').delete()
        : nbCol
            .doc('bday-template')
            .set({ messages: ms, signature: sg, islamic: islSame ? [] : im, updatedAt: Date.now() });
    });
    bdTplOpen = false;
    bdTplRender();
    bdRender();
    toast('Saved');
    return;
  }
  if (t.id === 'bdTplReset') {
    bdCfg = { messages: null, signature: null, islamic: null };
    bdShuf = {};
    bdDraft = {};
    write('nb-bday-template', function () {
      return nbCol.doc('bday-template').delete();
    });
    bdTplRender();
    bdRender();
    toast('Template reset');
    return;
  }
  var hmt = t.closest && t.closest('[data-hmtog]');
  if (hmt) {
    homeMonth = hmt.getAttribute('data-hmtog') === '1';
    var hc3 = $('#homeCal');
    if (hc3) hc3.innerHTML = apHome();
    return;
  }
  var apd = t.closest && t.closest('[data-apday]');
  if (apd) {
    apSel = apd.getAttribute('data-apday');
    var pq = apSel.split('-');
    apMonth = { y: +pq[0], m: +pq[1] - 1 };
    render();
    return;
  }
  var apm = t.closest && t.closest('[data-apmonth]');
  if (apm) {
    var dm = +apm.getAttribute('data-apmonth');
    if (dm === 0) {
      apMonth = { y: TODAY.getFullYear(), m: TODAY.getMonth() };
      apSel = iso(TODAY);
    } else {
      var nd0 = new Date(apMonth.y, apMonth.m + dm, 1);
      apMonth = { y: nd0.getFullYear(), m: nd0.getMonth() };
    }
    render();
    return;
  }
  if (t.closest && t.closest('[data-apnew]')) {
    apOpen(null, apSel);
    return;
  }
  var ape = t.closest && t.closest('[data-apedit]');
  if (ape) {
    apOpen(ape.getAttribute('data-apedit'));
    return;
  }
  var apk = t.closest && t.closest('[data-apdone]');
  if (apk) {
    var ak = apk.getAttribute('data-apdone'),
      aa = appts.filter(function (x) {
        return x.id === ak;
      })[0];
    if (aa) {
      write('ap-' + ak, function () {
        return apCol
          .doc(ak)
          .update({ status: aa.status === 'done' ? 'booked' : 'done', updatedAt: Date.now() });
      });
      setTimeout(function () {
        if (view === 'appointments' || view === 'tasks') render();
        renderNav();
      }, 30);
    }
    return;
  }
  if (t.closest && t.closest('[data-apdm]')) {
    var dmb = t.closest('[data-apdm]'),
      dn = +dmb.getAttribute('data-apdm');
    apDpM = new Date(apDpM.y, apDpM.m + dn, 1);
    apDpM = { y: apDpM.getFullYear(), m: apDpM.getMonth() };
    apDpRender();
    return;
  }
  if (t.closest && t.closest('[data-apdd]')) {
    var ddb = t.closest('[data-apdd]'),
      dv2 = ddb.getAttribute('data-apdd'),
      q2 = dv2.split('-');
    $('#apDate').value = dv2;
    apDpM = { y: +q2[0], m: +q2[1] - 1 };
    apClash = false;
    apDpRender();
    return;
  }
  if (t.closest && t.closest('[data-apts]')) {
    $('#apTime').value = t.closest('[data-apts]').getAttribute('data-apts');
    apClash = false;
    apDpRender();
    return;
  }
  if (t.closest && t.closest('[data-apclose]')) {
    apClose();
    return;
  }
  if (t.id === 'apSave') {
    apSave();
    return;
  }
  if (t.id === 'apDel') {
    if (!t.classList.contains('armed')) {
      t.classList.add('armed');
      t.textContent = 'Confirm delete';
      return;
    }
    var did = apEditId;
    apClose();
    if (did) {
      write('ap-' + did, function () {
        return apCol.doc(did).delete();
      });
      toast('Appointment deleted');
      setTimeout(function () {
        if (view === 'appointments' || view === 'tasks') render();
        renderNav();
      }, 30);
    }
    return;
  }
  var rtb = t.closest && t.closest('[data-rt]');
  if (rtb) {
    var rv = rtb.getAttribute('data-rt'),
      ix = rv.indexOf(':');
    if (ix > 0) nbExec(rv.slice(0, ix), rv.slice(ix + 1));
    else nbExec(rv);
    return;
  }
  var spr = t.closest && t.closest('[data-tkpri]');
  if (spr) {
    var sf = trFind(spr.getAttribute('data-tkpri'));
    try {
      spr.blur();
    } catch (e) {}
    if (sf) trSet(sf, { pri: !sf.t.pri });
    return;
  }
  var sdt = t.closest && t.closest('[data-sidetoggle]');
  if (sdt) {
    sideOn = !sideOn;
    try {
      localStorage.setItem('cd.ui.sideOn', sideOn ? '1' : '0');
    } catch (x) {}
    applySide();
    try {
      sdt.blur();
    } catch (e) {}
    return;
  }
  var tke = t.closest && t.closest('[data-tkedit]');
  if (tke) {
    editTk = tke.getAttribute('data-tkedit');
    rerenderTasks();
    setTimeout(function () {
      var x = document.querySelector('[data-tkf=text]');
      if (x) x.focus();
    }, 50);
    return;
  }
  if (t.closest && t.closest('[data-tkecancel]')) {
    editTk = null;
    try {
      document.activeElement.blur();
    } catch (e) {}
    rerenderTasks();
    return;
  }
  var tks = t.closest && t.closest('[data-tkesave]');
  if (tks) {
    var key = tks.getAttribute('data-tkesave'),
      bx = tks.closest('[data-tkbox]'),
      f = trFind(key);
    if (!f || !bx) return;
    var tx5 = bx.querySelector('[data-tkf=text]').value.trim(),
      du5 = bx.querySelector('[data-tkf=due]').value,
      tm5 = bx.querySelector('[data-tkf=time]').value,
      pr5 = bx.querySelector('[data-tkf=pri]').checked;
    if (!tx5) {
      toast('Type the task first');
      return;
    }
    if (tm5 && !du5) du5 = iso(TODAY);
    editTk = null;
    try {
      document.activeElement.blur();
    } catch (e) {}
    if (tx5 === f.t.text && du5 === (f.t.due || '') && tm5 === (f.t.time || '') && pr5 === !!f.t.pri) {
      rerenderTasks();
      return;
    }
    trSet(f, { text: tx5, due: du5, time: tm5, pri: pr5, edited: Date.now() });
    toast('Task updated');
    return;
  }
  /* delete a note (mortgage adviser): press Delete, then Confirm delete */
  var nd = t.closest && t.closest('[data-ndel]');
  if (nd) {
    if (!nd.classList.contains('armed')) {
      nd.classList.add('armed');
      nd.textContent = 'Confirm delete';
      setTimeout(function () {
        if (document.body.contains(nd)) {
          nd.classList.remove('armed');
          nd.textContent = 'Delete';
        }
      }, 4000);
      return;
    }
    var dp = nd.getAttribute('data-ndel').split('|'),
      dc = currentCase();
    if (!dc) return;
    var dobj = {};
    dobj[dp[0]] = (dc[dp[0]] || []).filter(function (x) {
      return String(x.ts) !== dp[1];
    });
    patch(openId, dobj);
    toast('Note deleted');
    return;
  }
  var ne = t.closest && t.closest('[data-nedit]');
  if (ne) {
    var pp = ne.getAttribute('data-nedit').split('|');
    editNote = { list: pp[0], ts: +pp[1] };
    renderLive();
    setTimeout(function () {
      var x = $('#ntEdit');
      if (x) {
        x.focus();
        x.setSelectionRange(x.value.length, x.value.length);
      }
    }, 50);
    return;
  }
  if (t.id === 'ntEditCancel') {
    editNote = null;
    renderLive();
    return;
  }
  if (t.id === 'ntEditSave') {
    var ex = $('#ntEdit'),
      cc = currentCase();
    if (!ex || !editNote || !cc) return;
    var en = editNote,
      val = ex.value.trim(),
      arr0 = cc[en.list] || [],
      cur = arr0.filter(function (x) {
        return x.ts === en.ts;
      })[0];
    if (!cur) return;
    if (!val && !cur.table) {
      toast('A note cannot be empty');
      return;
    }
    editNote = null;
    if (val === String(cur.text || '').trim()) {
      renderLive();
      return;
    }
    var narr = arr0.map(function (x) {
        return x.ts === en.ts ? Object.assign({}, x, { text: val, edited: Date.now() }) : x;
      }),
      oo = {};
    oo[en.list] = narr;
    patch(openId, oo);
    toast('Note updated');
    return;
  }
  var tbb = t.closest && t.closest('[data-tb]');
  if (tbb) {
    var act = tbb.getAttribute('data-tb');
    if (act === 'dropnt') {
      ntTable = null;
      showPend('nt');
      return;
    }
    if (act === 'droppr') {
      prTable = null;
      showPend('pr');
      return;
    }
    if (act === 'nbdel') {
      var tw0 = tbb.closest('.tblwrap'),
        i0 = tw0 && readRows(tw0);
      if (!i0) return;
      nbSetTables(
        i0.arr.filter(function (x, i) {
          return i !== i0.idx;
        })
      );
      return;
    }
    var tw = tbb.closest('.tblwrap'),
      info = tw && readRows(tw);
    if (!info) return;
    var rws = info.rows,
      wd = rws[0] ? rws[0].length : 1;
    if (act === 'addrow') {
      var nr = [];
      for (var q = 0; q < wd; q++) nr.push({ v: '' });
      rws.push(nr);
    } else if (act === 'addcol') {
      rws.forEach(function (r) {
        r.push({ v: '' });
      });
    } else if (act === 'delrow') {
      if (rws.length > 1) rws.pop();
    } else if (act === 'delcol') {
      if (wd > 1)
        rws.forEach(function (r) {
          r.pop();
        });
    }
    commitTbl(info, rws);
    return;
  }
  if (t.id === 'dupBtn') {
    var sc = cases.filter(function (x) {
      return x.id === openId;
    })[0];
    if (sc) {
      autoSave();
      startFrom(sc);
    }
    return;
  }
  if (t.id === 'delBtn') {
    if (!t.classList.contains('armed')) {
      t.classList.add('armed');
      t.textContent = 'Confirm delete';
      return;
    }
    var id = openId;
    closeDrawer();
    write(id, function () {
      return col.doc(id).delete();
    }).then(function () {
      toast(T.noun[0] + ' deleted');
    });
    return;
  }
  if (t.id === 'tkAdd') {
    var tx = $('#tkText').value.trim();
    if (!tx) return;
    var c2 = currentCase();
    var arr = (c2.tasks || []).concat([
      {
        id: uid(),
        text: tx,
        due: $('#tkDue').value || ($('#tkTime').value ? iso(TODAY) : ''),
        time: $('#tkTime').value || '',
        done: false,
        created: Date.now(),
        pri: !!$('#tkPri').checked
      }
    ]);
    patch(openId, { tasks: arr });
    return;
  }
  var rt = t.closest('[data-rmtk]');
  if (rt) {
    var c3 = currentCase();
    patch(openId, {
      tasks: (c3.tasks || []).filter(function (x) {
        return x.id !== rt.dataset.rmtk;
      })
    });
    return;
  }
  if (t.id === 'prAll') {
    var pa = $('#prText');
    if (pa) prDraft = pa.value;
    protAll = !protAll;
    renderLive();
    return;
  }
  if (t.id === 'prHide') {
    var ph = $('#prText');
    if (ph) prDraft = ph.value;
    protHidden = !protHidden;
    try {
      localStorage.setItem('cd.ui.protHidden', protHidden ? '1' : '0');
    } catch (x) {}
    renderLive();
    return;
  }
  if (t.id === 'prStamp') {
    var px = $('#prText'),
      ps2 = stampOf(Date.now()) + ' - ';
    px.value = px.value.trim() ? px.value.replace(/\s*$/, '') + '\n' + ps2 : ps2;
    px.focus();
    px.setSelectionRange(px.value.length, px.value.length);
    return;
  }
  if (t.id === 'prAdd') {
    var pt = $('#prText').value.trim();
    if (!pt && !prTable) return;
    prDraft = '';
    var c6 = currentCase();
    lastPD = '';
    var pn = { ts: Date.now(), text: pt };
    if (prTable) {
      pn.table = { rows: prTable.rows };
      prTable = null;
    }
    patch(openId, { protection: (c6.protection || []).concat([pn]), protDraft: '' });
    return;
  }
  if (t.id === 'ntAll') {
    var ta2 = $('#ntText');
    if (ta2) ntDraft = ta2.value;
    notesAll = !notesAll;
    renderLive();
    return;
  }
  if (t.id === 'ntHide') {
    var ta = $('#ntText');
    if (ta) ntDraft = ta.value;
    notesHidden = !notesHidden;
    try {
      localStorage.setItem('cd.ui.notesHidden', notesHidden ? '1' : '0');
    } catch (e) {}
    renderLive();
    return;
  }
  if (t.id === 'ntStamp') {
    var tx = $('#ntText'),
      st = stampOf(Date.now()) + ' - ';
    tx.value = tx.value.trim() ? tx.value.replace(/\s*$/, '') + '\n' + st : st;
    tx.focus();
    tx.setSelectionRange(tx.value.length, tx.value.length);
    return;
  }
  if (t.id === 'ntAdd') {
    var nt = $('#ntText').value.trim();
    if (!nt && !ntTable) return;
    ntDraft = '';
    var c4 = currentCase();
    lastND = '';
    var nn = { ts: Date.now(), text: nt };
    if (ntTable) {
      nn.table = { rows: ntTable.rows };
      ntTable = null;
    }
    noteSug = T.id === 'mortgage' && nt ? noteSuggest(nt, c4) : null;
    patch(openId, { notes: (c4.notes || []).concat([nn]), noteDraft: '' });
    return;
  }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.id === 'mkTpl') {
    mkTplId = t.value;
    mkList();
    return;
  }
  if (t.id === 'mkConsent') {
    mkConsent = t.value;
    mkList();
    return;
  }
  if (t.id === 'mkGroup') {
    mkGroup = t.value;
    mkList();
    return;
  }
  if (t.id === 'mkImp') {
    if (t.files && t.files[0]) mkImport(t.files[0]);
    t.value = '';
    return;
  }
  if (t.matches('[data-trk]')) {
    var f2 = trFind(t.dataset.trk);
    if (f2) trSet(f2, { done: t.checked });
    return;
  }
  if (t.matches('[data-bdchk]')) {
    var cp2 = bdFind(t.getAttribute('data-bdchk'));
    if (cp2) bdSetSent(cp2, t.checked);
    return;
  }
  if (t.matches('[data-rtsel]')) {
    if (t.value) {
      nbExec(t.getAttribute('data-rtsel') === 'font' ? 'fontName' : 'fontSize', t.value);
    }
    t.selectedIndex = 0;
    return;
  }
  if (t.matches('[data-rtinput]')) {
    nbExec(t.getAttribute('data-rtinput'), t.value);
    return;
  }
  if (t.matches('[data-trt]')) {
    var f4 = trFind(t.dataset.trt);
    if (f4) trSet(f4, t.value && !f4.t.due ? { time: t.value, due: iso(TODAY) } : { time: t.value });
    return;
  }
  if (t.matches('[data-trd]')) {
    var f3 = trFind(t.dataset.trd);
    if (f3) trSet(f3, { due: t.value });
    return;
  }
  if (t.matches('[data-tk]')) {
    var c = currentCase();
    patch(openId, {
      tasks: (c.tasks || []).map(function (x) {
        return x.id === t.dataset.tk ? Object.assign({}, x, { done: t.checked }) : x;
      })
    });
    return;
  }
  if (t.id === 'stageSel') {
    stageFilter = t.value;
    render();
  }
  if (t.id === 'lenderSel') {
    lenderFilter = t.value;
    render();
  }
  if (t.id === 'revSel') {
    revFilter = t.value;
    render();
  }
  if (t.getAttribute && t.getAttribute('data-colk')) {
    var ck = t.getAttribute('data-colk');
    colsHide = colsHide.filter(function (x) {
      return x !== ck;
    });
    if (!t.checked) colsHide.push(ck);
    try {
      localStorage.setItem('cd.ui.colsHide', JSON.stringify(colsHide));
    } catch (e) {}
    render();
    var dp = document.querySelector('.colpick');
    if (dp) dp.open = true;
  }
  if (t.id === 'sortSel') {
    sortBy = t.value;
    try {
      localStorage.setItem('cd.ui.sortBy', sortBy);
    } catch (e) {}
    render();
  }
  if (t.id === 'fromClient' && t.value) {
    var s2 = cases.filter(function (x) {
      return x.id === t.value;
    })[0];
    if (s2) startFrom(s2);
  }
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.getAttribute && t.getAttribute('data-f') && t.closest && t.closest('#caseForm')) {
    if (t.hasAttribute('data-from')) {
      var af = T.byKey[t.getAttribute('data-f')];
      if (t.value) t.setAttribute('data-auto', '0');
      else {
        t.setAttribute('data-auto', '1');
        var src = $('#f-' + af.auto.from);
        t.value = src && src.value ? autoDate(src.value, af.auto) : '';
      }
    }
    autoChain(t.getAttribute('data-f'), 0);
    updStrip();
  }
  if (t.getAttribute && t.getAttribute('data-f') && t.closest) {
    var lb = t.closest('label'),
      cl = lb && lb.querySelector('.cl');
    if (cl) cl.innerHTML = contactLinks(t.value);
  }
  if (t.getAttribute && t.getAttribute('data-a') === 'email') {
    var el = t.parentNode.querySelector('.el');
    if (el) el.innerHTML = elinks(t.value);
  }
  if (t.getAttribute && t.getAttribute('data-a') === 'phone') {
    var pl = t.parentNode.querySelector('.pl');
    if (pl) pl.innerHTML = plinks(t.value);
  }
  if (t.getAttribute && t.getAttribute('data-s')) {
    var scd = t.closest('.sec2'),
      sk = t.getAttribute('data-s');
    if (scd) {
      if (sk === 'fixedUntil') {
        var sr = scd.querySelector('[data-s="reviewDate"]');
        if (sr && sr.getAttribute('data-auto') === '1') sr.value = t.value ? addMonths(t.value, -REVM) : '';
      }
      if (sk === 'reviewDate') t.setAttribute('data-auto', '0');
      var gv = function (k) {
        var q = scd.querySelector('[data-s="' + k + '"]');
        return q ? q.value.trim() : '';
      };
      var sm = scd.querySelector('.secsum');
      if (sm)
        sm.textContent = secSumText({
          lender: gv('lender'),
          rate: gv('rate'),
          fixedUntil: gv('fixedUntil'),
          reviewDate: gv('reviewDate')
        });
      updSRev();
    }
  }
  if (t.id === 'f-oneDriveLink') {
    var od = $('#odl');
    if (od) od.innerHTML = odLink(t.value);
  }
  if (t.id === 'calcCase') {
    var cc = cases.filter(function (x) {
      return x.id === t.value;
    })[0];
    if (cc) {
      $('#calcAmt').value = cc.loanAmount || '';
      var yy = cc.termLeft || cc.termYears || '';
      $('#calcYrs').value = yy;
      $('#calcMon').value = '';
      $('#calcRate').value = cc.rate || '';
    }
    calcUpdate();
  }
  if (
    t.id === 'tcVat' ||
    t.id === 'tcRate' ||
    t.id === 'tcMode' ||
    t.id === 'tcProfit' ||
    t.id === 'tcOther'
  ) {
    taxCalcUpdate();
    return;
  }
  if (t.id === 'calcAmt' || t.id === 'calcYrs' || t.id === 'calcMon' || t.id === 'calcRate') calcUpdate();
  if (t.id === 'mkQ') {
    mkQuery = t.value;
    mkList();
    return;
  }
  if (t.id === 'trQ') {
    trQuery = t.value;
    renderTray();
  }
  if (t.id === 'nbTitle' || t.id === 'nbBody') {
    nbSched();
  }
  if (t.id === 'nbQ') {
    nbQuery = t.value;
    nbList();
  }
  if (t.id === 'q') {
    query = t.value;
    render();
  }
  if (t.id === 'clQ') {
    clQuery = t.value;
    clRender();
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer();
  else if (e.key === 'Escape' && trayOpen) closeTray();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')) {
    e.preventDefault();
    openDrawer(e.target.dataset.open);
  }
  if (e.key === 'Enter' && e.target.id === 'tkText') {
    e.preventDefault();
    $('#tkAdd').click();
  }
});
/* drag between pipeline stages */
var dragId = null;
document.addEventListener('dragstart', function (e) {
  var c = e.target.closest && e.target.closest('.card');
  if (c) {
    dragId = c.dataset.open;
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', dragId);
    } catch (_) {}
  }
});
document.addEventListener('dragover', function (e) {
  var c = e.target.closest && e.target.closest('.col');
  if (c && dragId) {
    e.preventDefault();
    document.querySelectorAll('.col.over').forEach(function (x) {
      x.classList.remove('over');
    });
    c.classList.add('over');
  }
});
document.addEventListener('drop', function (e) {
  var c = e.target.closest && e.target.closest('.col');
  document.querySelectorAll('.col.over').forEach(function (x) {
    x.classList.remove('over');
  });
  if (c && dragId) {
    e.preventDefault();
    var cs = cases.filter(function (x) {
      return x.id === dragId;
    })[0];
    if (cs && cs.stage !== c.dataset.stage) patch(dragId, { stage: c.dataset.stage });
  }
  dragId = null;
});
document.addEventListener('dragend', function () {
  dragId = null;
  document.querySelectorAll('.col.over').forEach(function (x) {
    x.classList.remove('over');
  });
});

function autoChain(k, depth) {
  if (depth > 5) return;
  var srcEl = $('#f-' + k);
  if (!srcEl) return;
  var v = srcEl.value;
  document.querySelectorAll('#caseForm [data-from="' + k + '"]').forEach(function (dep) {
    if (dep.getAttribute('data-auto') !== '1') return;
    var f = T.byKey[dep.getAttribute('data-f')];
    if (!f) return;
    dep.value = v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? autoDate(v, f.auto) : '';
    autoChain(f.k, depth + 1);
  });
}
