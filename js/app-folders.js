/* MySimpleDesk app: Client folders.
   Makes <your records folder> > Clients > <client name> in the person's own OneDrive (or Google Drive), one folder per client,
   to keep that client's documents in. The folder's link is saved on the client's record (the "Open OneDrive folder" link). */
var cfRun = false;
function cfUsable() {
  return !!(window.CD_files && window.CD_files.clientFolder && window.CD_files.can());
}
/* the cases that share one client's folder (the mortgage adviser keeps all of a client's cases in one folder) */
function cfSame(c) {
  if (T.id !== 'mortgage') return [c];
  var k = clientKey(c);
  return cases.filter(function (x) {
    return trOf(x) === T.id && clientKey(x) === k;
  });
}
/* one case per client that has no folder yet */
function cfWanted() {
  var seen = {};
  return cases.filter(function (c) {
    if (trOf(c) !== T.id || T.tenancyMode || !T.jobDocs) return false;
    var grp = cfSame(c);
    if (
      grp.some(function (x) {
        return x.folder && x.folder.url;
      })
    )
      return false;
    var k = T.id === 'mortgage' ? clientKey(c) : c.id;
    if (seen[k] || !pfName(c, {})) return false;
    seen[k] = 1;
    return true;
  });
}
/* one client: make the folder and save it on the client's cases */
function cfMake(c, used) {
  var have = cfSame(c).filter(function (x) {
    return x.folder && x.folder.name;
  })[0];
  var nm = (have && have.folder.name) || (c.folder && c.folder.name) || pfName(c, used || {});
  if (!nm) return Promise.reject(new Error('This client has no name yet.'));
  if (used) used[nm.toLowerCase()] = clientKey(c);
  return window.CD_files.clientFolder(nm, dzRoot()).then(function (f) {
    if (!f || !f.url) throw new Error('The folder was made but its link could not be read.');
    return Promise.all(
      cfSame(c).map(function (x) {
        return patch(x.id, {
          folder: Object.assign({}, x.folder || {}, { name: f.name || nm, id: f.id, url: f.url })
        });
      })
    ).then(function () {
      return f;
    });
  });
}
/* the drawer's "Create the folder now" button */
function cfDrawer() {
  var c = currentCase(),
    b = $('#cfMake'),
    m = $('#cfMsg');
  if (!c || !b) return;
  if (!cfUsable()) {
    if (m) m.textContent = 'Folders can be made once you are signed in and online.';
    return;
  }
  b.disabled = true;
  if (m) m.textContent = 'Making the folder…';
  cfMake(c, {}).then(
    function () {
      setTimeout(function () {
        var cur = currentCase();
        if (cur) dzRefresh(cur);
      }, 300);
    },
    function (e) {
      if (b) b.disabled = false;
      if (m) m.textContent = 'Could not make the folder: ' + ((e && e.message) || 'try again');
    }
  );
}
/* every client without a folder */
function cfBulk() {
  var old = $('#cfOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'cfOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:275;background:rgba(8,14,18,.6);display:flex;align-items:center;justify-content:center;padding:16px';
  document.body.appendChild(ov);
  var card = function (h, p, btns) {
    ov.innerHTML =
      '<div role="dialog" aria-modal="true" style="background:#fff;color:#101C26;width:min(520px,100%);border-radius:12px;padding:22px 24px;font:14.5px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,28,38,.3)"><h2 style="margin:0 0 8px;font-size:20px">' +
      h +
      '</h2><div style="margin:0 0 14px;color:#34475A">' +
      p +
      '</div><div style="display:flex;gap:8px;justify-content:flex-end">' +
      btns +
      '</div></div>';
  };
  var list = cfWanted();
  var close = '<button type="button" class="btn ghost" data-cf="x">Close</button>';
  ov.onclick = function (e) {
    var b = e.target.closest && e.target.closest('[data-cf]');
    if (e.target === ov && !cfRun) return ov.remove();
    if (!b) return;
    var k = b.getAttribute('data-cf');
    if (k === 'x' && !cfRun) {
      ov.remove();
      render();
    }
    if (k === 'go') go();
  };
  if (!cfUsable()) {
    card(
      'Client folders',
      'Sign in and be online to make folders in your ' +
        (window.CD_files ? window.CD_files.where() : 'storage') +
        '.',
      close
    );
    return;
  }
  if (!list.length) {
    card('Client folders', 'Every client already has a folder link. Nothing to do.', close);
    return;
  }
  card(
    'Make client folders',
    'This makes a folder called <b>' +
      esc(dzRootL()) +
      '</b> in your ' +
      esc(window.CD_files.where()) +
      ' records folder, with one folder inside it for each client, named after the client. <b>' +
      list.length +
      '</b> client' +
      (list.length === 1 ? ' has' : 's have') +
      ' no folder yet. Open any client to see its folder link and keep their documents there. Existing folders are never changed or moved.',
    close +
      '<button type="button" class="btn" data-cf="go">Make ' +
      list.length +
      ' folder' +
      (list.length === 1 ? '' : 's') +
      '</button>'
  );
  function go() {
    cfRun = true;
    var used = {},
      n = 0,
      fail = 0,
      streak = 0,
      i = 0;
    var show = function () {
      card(
        'Making folders…',
        '<div style="font-weight:600">Folder ' +
          Math.min(i + 1, list.length) +
          ' of ' +
          list.length +
          '</div><div style="height:10px;border-radius:99px;background:#D4E8DE;margin:10px 0;overflow:hidden"><i style="display:block;height:100%;width:' +
          Math.max(3, Math.round((i / list.length) * 100)) +
          '%;background:#0A6B50;border-radius:99px"></i></div><div style="font-size:13px;color:#58697A">Please keep this window open until it finishes.</div>',
        ''
      );
    };
    show();
    (function next() {
      if (i >= list.length || streak >= 5) {
        cfRun = false;
        card(
          fail ? 'Finished, with some problems' : 'Done',
          '<b>' +
            n +
            '</b> folder' +
            (n === 1 ? '' : 's') +
            ' made.' +
            (fail
              ? ' <b>' +
                fail +
                '</b> could not be made' +
                (streak >= 5 ? ' (stopped after 5 in a row; check you are online and try again)' : '') +
                '. Press the button again to retry those.'
              : ' Open a client to see its folder link.'),
          '<button type="button" class="btn" data-cf="x">Close</button>'
        );
        return;
      }
      var c = list[i];
      cfMake(c, used).then(
        function () {
          n++;
          streak = 0;
          i++;
          show();
          next();
        },
        function () {
          fail++;
          streak++;
          i++;
          show();
          next();
        }
      );
    })();
  }
}

window.CD_folderCount = function () {
  return cfWanted().length;
};
window.CD_foldersOpen = cfBulk;
