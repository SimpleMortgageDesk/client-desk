'use strict';
/* MySimpleDesk app: Marketing contacts and messages, and birthdays.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- marketing contacts ---------- */
var mkCol = null,
  mkItems = [],
  mkQuery = '',
  mkConsent = '',
  mkGroup = '',
  mkGroupKey = '',
  mkEditId = null,
  mkTab = 'contacts';
var MK_LABEL = { yes: 'Opted in', unknown: 'Unknown', no: 'Opted out' };
function mkSave() {
  var items = mkItems.slice();
  return write('mk', function () {
    return mkCol.doc('contacts').set({ items: items, updatedAt: Date.now() });
  });
}
function mkShell() {
  var tabs =
    '<div class="mktabs"><button type="button" class="mktab' +
    (mkTab === 'contacts' ? ' on' : '') +
    '" data-mktab="contacts">Contacts</button><button type="button" class="mktab' +
    (mkTab === 'messages' ? ' on' : '') +
    '" data-mktab="messages">Messages</button></div>';
  var head =
    '<div class="pagehead"><h1>Marketing</h1><span class="muted">' +
    (mkTab === 'messages' ? 'Messages to send to your contacts' : 'Contacts for your marketing') +
    '</span></div>';
  if (mkTab === 'messages')
    return '<div id="mkRoot" data-tab="messages">' + head + tabs + '<div id="mkMsgs"></div></div>';
  return (
    '<div id="mkRoot" data-tab="contacts">' +
    head +
    tabs +
    '<div class="mknote"><b>Before you message anyone:</b> only market to people who have agreed to hear from you (UK GDPR and PECR). Imported contacts start as <b>Unknown</b>. Mark them <b>Opted in</b> once they agree, and <b>Opted out</b> if they ask you to stop.</div>' +
    '<div class="mkbar"><input id="mkQ" type="search" placeholder="Search contacts" aria-label="Search contacts" value="' +
    esc(mkQuery) +
    '"><select id="mkConsent" aria-label="Filter by consent"><option value="">All consent</option><option value="yes">Opted in</option><option value="unknown">Unknown</option><option value="no">Opted out</option></select><select id="mkGroup" aria-label="Filter by group"></select>' +
    '<button type="button" class="btn" data-mkadd="1">Add contact</button><label class="btn ghost mkimp">Import<input type="file" id="mkImp" accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard,text/plain" hidden></label><button type="button" class="btn ghost" data-mkexp="1">Export CSV</button><span id="mkCount" class="muted"></span></div>' +
    '<div class="mkbar"><label class="mktpl">Message for the WhatsApp and Email buttons <select id="mkTpl" aria-label="Message"></select></label></div>' +
    '<div id="mkList"></div></div>'
  );
}
function mkGroups() {
  var g = {};
  mkItems.forEach(function (c) {
    if (c.group) g[c.group] = 1;
  });
  return Object.keys(g).sort();
}
function mkFiltered() {
  var q = mkQuery.trim().toLowerCase();
  return mkItems
    .filter(function (c) {
      if (mkConsent && (c.consent || 'unknown') !== mkConsent) return false;
      if (mkGroup && (c.group || '') !== mkGroup) return false;
      if (!q) return true;
      return (
        (
          (c.name || '') +
          ' ' +
          (c.phone || '') +
          ' ' +
          (c.email || '') +
          ' ' +
          (c.group || '') +
          ' ' +
          (c.notes || '')
        )
          .toLowerCase()
          .indexOf(q) >= 0
      );
    })
    .sort(function (a, b) {
      var na = mkNamed(a),
        nb = mkNamed(b);
      if (na !== nb) return na ? -1 : 1;
      return (na ? a.name : a.phone || a.email || '').localeCompare(
        nb ? b.name : b.phone || b.email || '',
        undefined,
        { sensitivity: 'base', numeric: true }
      );
    });
}
function mkNamed(c) {
  return !!(c.name && /\p{L}/u.test(c.name));
}
function mkWa(c) {
  var d = String(c.phone || '').replace(/\D/g, '');
  return d.length >= 8 ? 'https://wa.me/' + d : '';
}
function mkLinks(c) {
  var w = mkWa(c),
    h = '';
  var tp = mkTplCur();
  if (w && tp) w += '?text=' + encodeURIComponent(mkFill(tp.text, c));
  if (w)
    h +=
      '<a class="mklink wa" href="' +
      esc(w) +
      '" target="_blank" rel="noopener noreferrer" title="Open WhatsApp chat">WhatsApp</a>';
  if (c.email)
    h +=
      '<a class="mklink em" href="mailto:' +
      esc(c.email) +
      (tp
        ? '?subject=' +
          encodeURIComponent(tp.subject || tp.title) +
          '&body=' +
          encodeURIComponent(mkFill(tp.text, c).replace(/\n/g, '\r\n'))
        : '') +
      '" title="Send an email">Email</a>';
  return h || '<span class="muted">\u2014</span>';
}
function mkTplOpts() {
  var sel = $('#mkTpl');
  if (!sel) return;
  sel.innerHTML =
    '<option value="">No message (blank)</option>' +
    mkTpls()
      .map(function (m) {
        return (
          '<option value="' +
          esc(m.id) +
          '"' +
          (m.id === mkTplId ? ' selected' : '') +
          '>' +
          esc(m.title) +
          '</option>'
        );
      })
      .join('');
}
function mkList() {
  if (mkTab === 'messages') {
    mkMsgs();
    return;
  }
  var box = $('#mkList');
  if (!box) return;
  mkTplOpts();
  var gs = mkGroups(),
    key = gs.join('|') + '#' + mkGroup,
    sel = $('#mkGroup');
  if (sel && mkGroupKey !== key) {
    mkGroupKey = key;
    sel.innerHTML =
      '<option value="">All groups</option>' +
      gs
        .map(function (g) {
          return (
            '<option value="' + esc(g) + '"' + (g === mkGroup ? ' selected' : '') + '>' + esc(g) + '</option>'
          );
        })
        .join('');
  }
  var cs = $('#mkConsent');
  if (cs && cs.value !== mkConsent) cs.value = mkConsent;
  var l = mkFiltered(),
    n = mkItems.length,
    shown = l.slice(0, 500);
  var ct = $('#mkCount');
  if (ct)
    ct.textContent =
      l.length === n ? n + ' contact' + (n === 1 ? '' : 's') : l.length + ' of ' + n + ' shown';
  if (!n) {
    box.innerHTML =
      '<div class="empty"><h2>No contacts yet</h2>Use Import to load a CSV or vCard (.vcf) file, or Add contact to type one in.</div>';
    return;
  }
  if (!l.length) {
    box.innerHTML = '<div class="muted" style="margin-top:12px">No contacts match.</div>';
    return;
  }
  box.innerHTML =
    '<div class="tw" tabindex="0" role="region" aria-label="Table: scroll sideways to see more"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Group</th><th>Message</th><th>Consent</th><th>Notes</th></tr></thead><tbody>' +
    shown
      .map(function (c) {
        var k = c.consent || 'unknown';
        return (
          '<tr class="click" data-mkedit="' +
          esc(c.id) +
          '"><td><b>' +
          esc(c.name || '(no name)') +
          '</b></td><td class="num">' +
          esc(c.phone || '') +
          '</td><td>' +
          esc(c.email || '') +
          '</td><td>' +
          esc(c.group || '') +
          '</td><td class="mklinks">' +
          mkLinks(c) +
          '</td><td><span class="chip mk-' +
          k +
          '">' +
          MK_LABEL[k] +
          '</span></td><td class="ntc"><div class="nl1">' +
          esc(c.notes || '') +
          '</div></td></tr>'
        );
      })
      .join('') +
    '</tbody></table></div>' +
    (l.length > shown.length
      ? '<div class="muted" style="margin-top:8px">Showing the first 500. Use search or filters to narrow the list.</div>'
      : '');
}
function mkNorm(p) {
  var raw = String(p || '').trim();
  if (!raw) return '';
  var plus = raw.charAt(0) === '+',
    d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (!plus && d.slice(0, 2) === '00') {
    plus = true;
    d = d.slice(2);
  }
  if (plus) return '+' + d;
  if (d.charAt(0) === '0') return '+44' + d.slice(1);
  if (d.slice(0, 2) === '44' && d.length >= 12) return '+' + d;
  if (d.length === 10 && d.charAt(0) === '7') return '+44' + d;
  return d;
}
function mkKey(c) {
  return c.phone ? 'p' + c.phone : c.email ? 'e' + c.email.toLowerCase() : 'n' + (c.name || '').toLowerCase();
}
function mkId() {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function mkCsvRows(t) {
  var rows = [],
    row = [],
    f = '',
    q = false,
    i = 0,
    c;
  var first = t.split(/\r?\n/)[0] || '',
    dl = ',';
  [',', ';', '\t'].forEach(function (d) {
    if (first.split(d).length > first.split(dl).length) dl = d;
  });
  for (i = 0; i < t.length; i++) {
    c = t.charAt(i);
    if (q) {
      if (c === '"') {
        if (t.charAt(i + 1) === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === dl) {
      row.push(f);
      f = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t.charAt(i + 1) === '\n') i++;
      row.push(f);
      f = '';
      if (
        row.some(function (x) {
          return x.trim();
        })
      )
        rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (
    row.some(function (x) {
      return x.trim();
    })
  )
    rows.push(row);
  return rows;
}
function mkParseCsv(t) {
  var rows = mkCsvRows(t.replace(/^﻿/, ''));
  if (!rows.length) return [];
  var hasData = function (r) {
    return r.some(function (x) {
      return /@/.test(x) || x.replace(/\D/g, '').length >= 7;
    });
  };
  var head = !hasData(rows[0]),
    out = [];
  if (head) {
    var h = rows[0].map(function (x) {
        return x.trim().toLowerCase();
      }),
      body = rows.slice(1);
    var idx = function (re) {
      var r = [];
      h.forEach(function (x, i) {
        if (re.test(x)) r.push(i);
      });
      return r;
    };
    var nm = idx(/^(name|full name|display name|contact name|contact)$/),
      fn = idx(/^(first name|given name|first)$/),
      ln = idx(/^(last name|family name|surname|last)$/),
      ph = idx(/phone|mobile|tel|number|whatsapp/),
      em = idx(/e-?mail/),
      gr = idx(/^(group|groups|label|labels|source|list|group membership)$/),
      no = idx(/note/),
      co = idx(/consent|opt/);
    body.forEach(function (r) {
      var g = function (a) {
        for (var i = 0; i < a.length; i++) {
          var v = (r[a[i]] || '').trim();
          if (v) return v;
        }
        return '';
      };
      var name = g(nm) || (g(fn) + ' ' + g(ln)).trim(),
        cv = g(co).toLowerCase();
      out.push({
        name: name,
        phone: g(ph),
        email: g(em),
        group: g(gr).replace(/\s*:::\s*\*?$/, ''),
        notes: g(no),
        consent: /^(yes|y|opted in|opt in|true|1)$/.test(cv)
          ? 'yes'
          : /^(no|n|opted out|opt out|false|0)$/.test(cv) && cv
            ? 'no'
            : 'unknown'
      });
    });
  } else {
    rows.forEach(function (r) {
      var o = { name: '', phone: '', email: '', group: '', notes: '', consent: 'unknown' };
      r.forEach(function (x) {
        x = x.trim();
        if (!x) return;
        if (/@/.test(x) && !o.email) o.email = x;
        else if (x.replace(/\D/g, '').length >= 7 && /^[+()\d\s.-]+$/.test(x) && !o.phone) o.phone = x;
        else if (!o.name) o.name = x;
      });
      out.push(o);
    });
  }
  return out;
}
function mkParseVcf(t) {
  var lines = t
      .replace(/\r/g, '')
      .replace(/\n[ \t]/g, '')
      .split('\n'),
    out = [],
    cur = null;
  lines.forEach(function (l) {
    if (/^BEGIN:VCARD/i.test(l)) {
      cur = { name: '', phone: '', email: '', group: '', notes: '', consent: 'unknown' };
      return;
    }
    if (/^END:VCARD/i.test(l)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) return;
    var i = l.indexOf(':');
    if (i < 0) return;
    var k = l
        .slice(0, i)
        .split(';')[0]
        .toUpperCase()
        .replace(/^ITEM\d+\./, ''),
      v = l.slice(i + 1).trim();
    if (k === 'FN' && v) cur.name = v;
    else if (k === 'N' && !cur.name) {
      var p = v.split(';');
      cur.name = ((p[1] || '') + ' ' + (p[0] || '')).trim();
    } else if (k === 'TEL' && !cur.phone) cur.phone = v;
    else if (k === 'EMAIL' && !cur.email) cur.email = v;
    else if (k === 'ORG' && !cur.group) cur.group = v.replace(/;/g, ' ').trim();
    else if (k === 'NOTE' && !cur.notes) cur.notes = v;
  });
  return out;
}
function mkImport(file) {
  var rd = new FileReader();
  rd.onload = function () {
    try {
      var t = String(rd.result || ''),
        raw = /BEGIN:VCARD/i.test(t) ? mkParseVcf(t) : mkParseCsv(t),
        grp = file.name
          .replace(/\.[^.]+$/, '')
          .replace(/^WhatsApp (Chat|Group) with /i, '')
          .trim();
      var have = {};
      mkItems.forEach(function (c) {
        have[mkKey(c)] = 1;
      });
      var added = 0,
        skipped = 0,
        empty = 0;
      raw.forEach(function (r) {
        var c = {
          id: mkId(),
          name: (r.name || '').trim(),
          phone: mkNorm(r.phone),
          email: (r.email || '').trim(),
          group: (r.group || '').trim() || grp,
          notes: (r.notes || '').trim(),
          consent: r.consent || 'unknown',
          added: Date.now()
        };
        if (!c.name && !c.phone && !c.email) {
          empty++;
          return;
        }
        var k = mkKey(c);
        if (have[k]) {
          skipped++;
          return;
        }
        have[k] = 1;
        mkItems.push(c);
        added++;
      });
      if (added) mkSave();
      mkList();
      toast(
        'Imported ' +
          added +
          ' contact' +
          (added === 1 ? '' : 's') +
          (skipped ? ', skipped ' + skipped + ' duplicate' + (skipped === 1 ? '' : 's') : '') +
          (empty ? ', ignored ' + empty + ' empty row' + (empty === 1 ? '' : 's') : '') +
          (added ? '. Consent is set to Unknown.' : ''),
        true
      );
    } catch (x) {
      toast('That file could not be read as contacts.');
    }
  };
  rd.readAsText(file);
}
function mkExport() {
  var l = mkFiltered(),
    q = function (v) {
      v = csvCell(v);
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
  var rows = [['Name', 'Phone', 'Email', 'Group', 'Consent', 'Notes', 'Added'].join(',')];
  l.forEach(function (c) {
    rows.push(
      [
        c.name,
        c.phone,
        c.email,
        c.group,
        MK_LABEL[c.consent || 'unknown'],
        c.notes,
        c.added ? new Date(c.added).toISOString().slice(0, 10) : ''
      ]
        .map(q)
        .join(',')
    );
  });
  var blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'marketing-contacts-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
  toast('Exported ' + l.length + ' contact' + (l.length === 1 ? '' : 's'));
}
function mkSendBox(c) {
  var w = mkWa(c),
    h =
      '<div class="mksend"><b>Send a message</b><div class="muted" style="font-size:12px;margin:2px 0 8px">' +
      (w || c.email
        ? 'Pick a message. It opens in WhatsApp or your email app, filled in and ready to send. Check consent first.'
        : 'Add a phone number or email to send a message.') +
      '</div>';
  mkTpls().forEach(function (m) {
    var t = mkFill(m.text, c),
      pv = t.replace(/\s+/g, ' ').slice(0, 150) + (t.length > 150 ? '\u2026' : '');
    h +=
      '<div class="mksm"><div class="mkch"><b>' +
      esc(m.title) +
      '</b></div><div class="muted" style="font-size:12px;margin-bottom:6px">' +
      esc(pv) +
      '</div><div>' +
      (w
        ? '<a class="mklink wa" href="' +
          esc(w + '?text=' + encodeURIComponent(t)) +
          '" target="_blank" rel="noopener noreferrer">WhatsApp</a>'
        : '') +
      (c.email
        ? '<a class="mklink em" href="mailto:' +
          esc(c.email) +
          '?subject=' +
          encodeURIComponent(m.subject || m.title) +
          '&body=' +
          encodeURIComponent(t.replace(/\n/g, '\r\n')) +
          '">Email</a>'
        : '') +
      '</div></div>';
  });
  return h + '</div>';
}
function mkOpen(id) {
  var c =
      mkItems.filter(function (x) {
        return x.id === id;
      })[0] || {},
    ov = document.createElement('div');
  mkEditId = id || null;
  ov.id = 'mkOv';
  ov.className = 'mkov';
  ov.innerHTML =
    '<div class="mkpanel" role="dialog" aria-label="Contact"><h2>' +
    (id ? 'Edit contact' : 'Add contact') +
    '</h2>' +
    '<label class="f">Name<input id="mkf-name" value="' +
    esc(c.name || '') +
    '"></label><label class="f">Phone<input id="mkf-phone" inputmode="tel" value="' +
    esc(c.phone || '') +
    '"></label>' +
    (id && mkWa(c)
      ? '<div class="mkrow"><a class="mklink wa" href="' +
        esc(mkWa(c)) +
        '" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>'
      : '') +
    '<label class="f">Email<input id="mkf-email" type="email" value="' +
    esc(c.email || '') +
    '"></label>' +
    (id && c.email
      ? '<div class="mkrow"><a class="mklink em" href="mailto:' + esc(c.email) + '">Email</a></div>'
      : '') +
    '<label class="f">Group or source<input id="mkf-group" value="' +
    esc(c.group || '') +
    '"></label>' +
    '<label class="f">Consent<select id="mkf-consent"><option value="unknown"' +
    ((c.consent || 'unknown') === 'unknown' ? ' selected' : '') +
    '>Unknown</option><option value="yes"' +
    (c.consent === 'yes' ? ' selected' : '') +
    '>Opted in</option><option value="no"' +
    (c.consent === 'no' ? ' selected' : '') +
    '>Opted out</option></select></label><label class="f">Notes<textarea id="mkf-notes" rows="3">' +
    esc(c.notes || '') +
    '</textarea></label>' +
    (id ? mkSendBox(c) : '') +
    '<div class="mkact"><button type="button" class="btn" data-mksave="1">Save</button><button type="button" class="btn ghost" data-mkcancel="1">Cancel</button>' +
    (id
      ? '<button type="button" class="btn ghost" id="mkDel" data-mkdel="1" style="margin-left:auto">Delete</button>'
      : '') +
    '</div></div>';
  document.body.appendChild(ov);
  setTimeout(function () {
    var f = $('#mkf-name');
    if (f) f.focus();
  }, 30);
}
function mkClose() {
  var o = $('#mkOv');
  if (o) o.remove();
  mkEditId = null;
}
function mkSaveForm() {
  var g = function (i) {
      return ($('#mkf-' + i).value || '').trim();
    },
    c = {
      name: g('name'),
      phone: mkNorm(g('phone')),
      email: g('email'),
      group: g('group'),
      notes: g('notes'),
      consent: $('#mkf-consent').value
    };
  if (!c.name && !c.phone && !c.email) {
    toast('Add a name, phone or email');
    return;
  }
  if (mkEditId) {
    mkItems = mkItems.map(function (x) {
      return x.id === mkEditId ? Object.assign({}, x, c) : x;
    });
  } else mkItems.push(Object.assign({ id: mkId(), added: Date.now() }, c));
  mkSave();
  mkClose();
  mkList();
  toast('Saved');
}

/* ---------- marketing messages ---------- */
function profA() {
  try {
    return JSON.parse(localStorage.getItem('cd.profile') || '{}') || {};
  } catch (e) {
    return {};
  }
}
function ukPhone(p) {
  p = String(p || '');
  return /^44\d{9,10}$/.test(p) ? '0' + p.slice(2) : p ? '+' + p : '';
}
function mkSig() {
  var p = profA();
  return [
    p.name,
    p.role || (p.name ? T.label : ''),
    p.biz,
    p.reg,
    p.phone ? 'Mobile: ' + ukPhone(p.phone) : ''
  ]
    .filter(Boolean)
    .join('\n');
}
function mkDefaults() {
  var sg = mkSig(),
    ft = T.msgFoot;
  return T.msgs.map(function (m) {
    return {
      id: m.id,
      title: m.title,
      subject: m.subject,
      text: m.text
        .replace('{sig}', sg)
        .replace('{foot}', ft)
        .replace(/\n{3,}/g, '\n\n')
    };
  });
}
var mkMsgsDoc = null,
  mkTplId = '',
  mkMsgEdit = null,
  mkDraft = null;
function mkTpls() {
  return mkMsgsDoc || mkDefaults();
}
function mkTplSave(list) {
  mkMsgsDoc = list;
  return write('mkm', function () {
    return mkCol.doc('messages').set({ items: list, updatedAt: Date.now() });
  });
}
function mkFirst(c) {
  var n = ((c && c.name) || '').trim();
  return mkNamed(c) ? n.split(/\s+/)[0] : '';
}
function mkFill(t, c) {
  var f = mkFirst(c);
  return String(t || '').replace(/ ?\{name\}/g, f ? ' ' + f : '');
}
function mkTplCur() {
  return (
    mkTpls().filter(function (x) {
      return x.id === mkTplId;
    })[0] || null
  );
}
function mkMsgs() {
  var box = $('#mkMsgs');
  if (!box) return;
  var l = mkDraft ? [mkDraft].concat(mkTpls()) : mkTpls();
  box.innerHTML =
    '<div class="mknote">Where a message has {name}, the contact\u2019s first name is put in (or left out if there is no name). On the Contacts tab, choose a message and the WhatsApp and Email buttons open with it filled in. Your signature comes from My profile. Each message ends with a way to opt out' +
    (T.id === 'mortgage' ? ', and the usual mortgage warning' : '') +
    '.</div>' +
    '<div class="mkbar"><button type="button" class="btn" data-mkmnew="1">New message</button>' +
    (mkMsgsDoc
      ? '<button type="button" class="btn ghost" data-mkmreset="1">Restore the standard messages</button>'
      : '') +
    '</div>' +
    (l.length
      ? l
          .map(function (m) {
            if (mkMsgEdit === m.id)
              return (
                '<div class="mkcard"><label class="f">Title<input id="mkm-title" value="' +
                esc(m.title) +
                '"></label><label class="f">Email subject<input id="mkm-subject" value="' +
                esc(m.subject || '') +
                '"></label><label class="f">Message<textarea id="mkm-text" rows="12">' +
                esc(m.text) +
                '</textarea></label><div class="mkact"><button type="button" class="btn" data-mkmsave="' +
                esc(m.id) +
                '">Save</button><button type="button" class="btn ghost" data-mkmcancel="1">Cancel</button><button type="button" class="btn ghost" data-mkmdel="' +
                esc(m.id) +
                '" style="margin-left:auto">Delete</button></div></div>'
              );
            return (
              '<div class="mkcard"><div class="mkch"><b>' +
              esc(m.title) +
              '</b><span class="muted">' +
              esc(m.subject || '') +
              '</span></div><pre class="mkpre">' +
              esc(m.text) +
              '</pre><div class="mkact"><button type="button" class="btn ghost sm" data-mkmcopy="' +
              esc(m.id) +
              '">Copy message</button><button type="button" class="btn ghost sm" data-mkmedit="' +
              esc(m.id) +
              '">Edit</button></div></div>'
            );
          })
          .join('')
      : '<div class="muted">No messages. Use New message or Restore the standard messages.</div>');
}
function mkMsgAct(t) {
  var g = function (a) {
      var e = t.closest('[' + a + ']');
      return e ? e.getAttribute(a) : null;
    },
    v;
  if (g('data-mkmnew') !== null) {
    var id = 'c' + Date.now().toString(36);
    mkDraft = {
      id: id,
      title: 'New message',
      subject: '',
      text: 'Hello{name},\n\n\n\n' + mkSig() + '\n\n' + T.msgFoot
    };
    mkMsgEdit = id;
    mkMsgs();
    return true;
  }
  if (g('data-mkmreset') !== null) {
    if (!window.confirm('Replace your messages with the standard ones?')) return true;
    mkMsgsDoc = null;
    write('mkm', function () {
      return mkCol.doc('messages').delete();
    });
    mkMsgEdit = null;
    mkMsgs();
    return true;
  }
  if ((v = g('data-mkmedit'))) {
    mkMsgEdit = v;
    mkMsgs();
    return true;
  }
  if (g('data-mkmcancel') !== null) {
    mkMsgEdit = null;
    mkDraft = null;
    mkMsgs();
    return true;
  }
  if ((v = g('data-mkmsave'))) {
    var ti = ($('#mkm-title').value || '').trim() || 'Message';
    var nm = {
        id: v,
        title: ti,
        subject: ($('#mkm-subject').value || '').trim(),
        text: $('#mkm-text').value
      },
      cur = mkTpls(),
      has = cur.some(function (m) {
        return m.id === v;
      });
    mkTplSave(
      has
        ? cur.map(function (m) {
            return m.id === v ? nm : m;
          })
        : [nm].concat(cur)
    );
    mkDraft = null;
    mkMsgEdit = null;
    mkMsgs();
    toast('Message saved');
    return true;
  }
  if ((v = g('data-mkmdel'))) {
    if (!t.classList.contains('armed')) {
      t.classList.add('armed');
      t.textContent = 'Confirm delete';
      return true;
    }
    if (mkDraft && mkDraft.id === v) {
      mkDraft = null;
      mkMsgEdit = null;
      mkMsgs();
      return true;
    }
    mkTplSave(
      mkTpls().filter(function (m) {
        return m.id !== v;
      })
    );
    if (mkTplId === v) mkTplId = '';
    mkMsgEdit = null;
    mkMsgs();
    toast('Message deleted');
    return true;
  }
  if ((v = g('data-mkmcopy'))) {
    var m = mkTpls().filter(function (x) {
      return x.id === v;
    })[0];
    if (m) {
      var txt = mkFill(m.text, null);
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(txt).then(
          function () {
            toast('Message copied');
          },
          function () {
            toast('Could not copy');
          }
        );
      else toast('Could not copy');
    }
    return true;
  }
  return false;
}

/* ---------- birthdays ---------- */
var bdFilter = 'week',
  bdQuery = '',
  bdOpen = {},
  bdDraft = {},
  bdTplOpen = false;
var BD_MSGS = [
  'Happy Birthday {name}! 🎂🎉 Wishing you a wonderful day filled with joy, laughter and all your favourite things. May the year ahead bring you good health, happiness and lots of lovely surprises.',
  "Dear {name}, wishing you a very happy birthday! 🎈 I hope today is full of smiles, good company and a little bit of cake. Here's to a fantastic year ahead!",
  'Happy Birthday {name}! 🥳 Thinking of you today and hoping you have a lovely, relaxing day with the people who matter most to you.',
  'Many happy returns, {name}! 🎁 May your day be as special as you are, and may the coming year bring you everything you wish for.',
  "Hi {name}, just a quick note to wish you a very happy birthday! 🌟 I hope you're spoiled rotten today. Enjoy every moment!",
  'Happy Birthday {name}! 🎂 Wishing you health, happiness and success in the year ahead. Have a truly wonderful day!',
  'Warmest birthday wishes to you, {name}! 🌸 May this new year of life bring you peace, prosperity and plenty of reasons to celebrate.',
  'Happy Birthday {name}! 🎉 Hope your day is packed with good food, good company and lots of laughter. You deserve it!',
  'Hello {name}, sending you my very best wishes on your birthday! 💐 May it be the start of a brilliant year for you and your family.',
  "Happy Birthday {name}! 🥂 Here's to another great year. Wishing you a day full of love, laughter and wonderful surprises.",
  "Wishing you a fantastic birthday, {name}! 🎈 Take time to enjoy today. You deserve a day that's all about you!",
  'Happy Birthday {name}! ☀️ I hope today brings you plenty of joy and that the year ahead is your best yet.',
  'Dear {name}, happy birthday! 🎂 Thank you for being a valued client. Wishing you a wonderful day and a happy, healthy year ahead.',
  'Happy Birthday {name}! 🌹 May your day be filled with love and your year with happy moments. Enjoy every minute!',
  'Wishing you the happiest of birthdays, {name}! 🎊 May all your wishes come true today and throughout the year ahead.'
];
function bdDefSig() {
  var p = profA();
  return 'Warmest wishes,' + (p.name ? '\n' + p.name : '') + (p.role ? '\n' + p.role : '');
}
var bdCfg = { messages: null, signature: null, islamic: null },
  bdShuf = {};
var BD_ISL = [
  'Assalamu alaikum {name}! 🌙 Wishing you a very happy and blessed birthday. May Allah grant you good health, happiness and barakah in everything you do this year. Ameen.',
  'Assalamu alaikum {name}, many happy returns! 🤲 May Allah bless you with a long, healthy life filled with joy, peace and success, and keep you and your family safe. Ameen.',
  'Happy Birthday {name}! ✨ Barakallahu feek. May Allah make this coming year your best yet, fill your home with happiness and grant you ease in all your affairs.',
  'Assalamu alaikum {name}. Sending you warm birthday wishes today. May Allah shower you with His mercy, protect you and your loved ones, and bless every day of the year ahead. 🌟',
  'Dear {name}, Assalamu alaikum and happy birthday! 🎂 May Allah grant you good health, a blessed income and happiness for you and your family. Ameen.',
  'Happy Birthday {name}! Alhamdulillah for another year. May Allah fill it with barakah, good health and good news. Wishing you and your family all the best. 🤍',
  'Assalamu alaikum {name}! 🌸 Wishing you a lovely birthday. May Allah bless you with peace of heart, success and many more healthy years ahead. Ameen.',
  'Warm birthday wishes {name}! 🌙 May Allah accept your good deeds, guide you, and grant you and your family happiness and ease in the year ahead.',
  'Assalamu alaikum {name}, wishing you a happy birthday! May Allah protect you, bless your family and your home, and make the year ahead full of khayr. Jazakallah khair for being a valued client. 🤲',
  'Happy Birthday {name}! 🎈 Barakallahu fee umrik. May Allah bless your life and give you good health, happiness and success always.'
];
var BD_MUS_SET = {};
'mohammed muhammad mohammad mohamed mohamad mohd md mahmoud mahmood mehmood mahmud mahmuda hamza hamzah ibrahim ismail ismael yusuf yousuf yusuff usman uthman umar omar abdullah abdul abdur abdel abu bilal imran tariq kamran salman saeed saleem salim nadeem naeem shahid zahid zahidur jamal kamal kabir karim rashid rasheed rafiq rafique shafiq shafique anwar aslam arif asif adnan faisal farooq faruk habib harun haroon idris ilyas jahangir junaid khalid khalil masud masood mustafa nasir noor nur rizwan sadiq shoaib suleman sulaiman waseem wasim zubair zakaria zakir ahmed ahmad ahamed ali hussain hussein hossain hosen hassan hasan rahman rehman islam alam haque hoque huq siddiqui siddique sheikh shaikh syed sayed sayyid iqbal hafiz mirza qureshi malik butt ansari khan begum bibi khatun khanom akhter akhtar akter aktar miah mia mian uddin ullah sultana nasreen parveen perveen yasmin yasmeen fatima fatema fatimah aisha ayesha aysha khadija khadijah maryam mariam zainab zaynab amina aminah rabia ruqayya sumaiya sumayya samira salma jannat rahima rokeya rubina tahmina nazma nazneen shamsun shamim shamima ashraful mizanur rafiqul nazrul'
  .split(' ')
  .forEach(function (w) {
    BD_MUS_SET[w] = 1;
  });
function bdMuslim(nm) {
  return String(nm || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .some(function (w) {
      return (
        BD_MUS_SET[w] || /^(abdul|abdur|abdel|mohamm|muham|mohd)/.test(w) || /(uddin|uddeen|ullah)$/.test(w)
      );
    });
}
var bdGen = {};
var BD_FEM = {};
'jerin thania shumaya husneara fatema-tuz nipa mitu ria rima shapla popy poly lucky happy nilufa nilufar rumana rumi shilpi lipi fatima fatema fatimah fatma aisha ayesha aysha ayisha khadija khadijah khodeja maryam mariam mary zainab zaynab zeinab sana sara sarah amina aminah asma halima hajra hina nadia nadiya nasreen nasrin nazia nazma nazneen parveen perveen rubina sabina shabana shahida shazia sultana yasmin yasmeen zahra zara rehana rukhsana razia rashida salma samira sania sobia sadia sonia tahira tasneem uzma farzana farida fouzia fozia jannat rahima rokeya ruksana rabia ruqayya ruqayyah sumaiya sumayya sumaya tahmina shamima shamsun shahnaz shahina shirin shiren sharmin sharmeen sultana jesmin jasmin laila laylah lubna madiha maheen mahnoor mehreen mehwish misbah naila nargis noreen nusrat rizwana robina roksana saima sajida shaheen sidra sumi tamanna tania tanzila umme uzma yasmina zakia zarina zubaida zeenat bushra anisa anika hafsa hafsah iqra insha kulsum kalsoom kauser kishwar maliha momina munira nafisa naseem nazira parvin rahena rehena ruma selina shakila shamim sharifa suraiya sultana tahera '
  .trim()
  .split(/\s+/)
  .forEach(function (w) {
    BD_FEM[w] = 1;
  });
var BD_MALE = {};
'ijaz korban kurban foyjul foysal foyez ehsan ihsan ikram inam ilyaas imtiaz jamil jashim jakir kader kalam kaium khokon mamunur mannan matin mofiz motin nurul nazmul rashed rubel salauddin selim shahed shahidul tofazzul tuhin mohammed muhammad mohammad mohamed mohamad mohd md mahmoud mahmood mehmood mahmud hamza hamzah ibrahim ismail ismael yusuf yousuf yusuff usman uthman umar omar abdullah abdul abdur abdel abu bilal imran tariq kamran salman saeed saleem salim nadeem naeem shahid zahid jamal kamal kabir kobir karim rashid rasheed rafiq rafique shafiq shafique anwar aslam arif asif adnan faisal farooq faruk forhad habib harun haroon idris ilyas jahangir junaid khalid khalil masud masood mustafa nasir rizwan sadiq shoaib suleman sulaiman waseem wasim zubair zakaria zakir ahmed ahmad ahamed ali hussain hussein hossain hosen hassan hasan iqbal hafiz mirza sardar shorif sharif rahim rubel sohel monir sumon tanvir masum jahid mizan mizanur ashraful rafiqul nazrul osama usama talha yahya yaqub yacub zain zayn ayaan arman aziz amir ameen amin ashiq ashik babul belal billal dilwar enam farhan fahim fazal gulzar harris haris hanif jabir jalal javed jawad kaiser kashif liaquat luqman majid manzoor mamun masud mehdi mohsin mubarak muzammil nawaz obaid raihan rayhan ramzan rony saif shabir shafi shakil shamim shamsul shuvo siraj sultan tahir taslim tauhid wahid yasin younis zahir zia'
  .trim()
  .split(/\s+/)
  .forEach(function (w) {
    BD_MALE[w] = 1;
  });
function bdGuess(nm) {
  var toks = String(nm || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (!toks.length) return '';
  if (toks[0] === 'mr') return 'm';
  if (/^(mrs|miss|ms)$/.test(toks[0])) return 'f';
  var f =
    toks.filter(function (w) {
      return !/^(mr|mrs|miss|ms|dr)$/.test(w);
    })[0] || '';
  if (BD_FEM[f]) return 'f';
  if (BD_MALE[f] || /^(abdul|abdur|abdel|mohamm|muham|mohd)/.test(f) || /(uddin|uddeen|ullah)$/.test(f))
    return 'm';
  if (
    toks.some(function (w) {
      return /^(begum|khatun|bibi|banu|khanom|nessa)$/.test(w);
    })
  )
    return 'f';
  return '';
}
function bdGender(p) {
  return bdGen[p.key] || bdGuess(p.name);
}
function bdGenBtns(p) {
  var g = bdGender(p);
  return (
    '<span class="bdgenw" role="group" aria-label="Address as"><button type="button" class="btn ghost bdgen" data-bdgen="' +
    esc(p.key) +
    '|m" aria-pressed="' +
    (g === 'm') +
    '">Brother</button><button type="button" class="btn ghost bdgen" data-bdgen="' +
    esc(p.key) +
    '|f" aria-pressed="' +
    (g === 'f') +
    '">Sister</button></span>'
  );
}
var bdKind = {};
function bdMode(p) {
  return bdKind[p.key] || (p.muslim ? 'isl' : 'gen');
}
function bdIsl() {
  return bdCfg.islamic && bdCfg.islamic.length ? bdCfg.islamic : BD_ISL;
}
function bdList(p) {
  return bdMode(p) === 'isl' ? bdIsl() : bdMsgs();
}

function bdMsgs() {
  return bdCfg.messages && bdCfg.messages.length ? bdCfg.messages : BD_MSGS;
}
function bdSig() {
  return bdCfg.signature != null ? bdCfg.signature : bdDefSig();
}
function bdHash(t) {
  var h = 0;
  for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h;
}
function bdPick(p) {
  var l = bdList(p);
  return bdHash(p.slug + '|' + p.year + '|' + (bdShuf[p.key] || 0)) % l.length;
}
function bdFirst(nm) {
  var t = String(nm || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (t.length > 1 && /^(mr|mrs|miss|ms|dr|md|mohd)\.?$/i.test(t[0])) t.shift();
  var f = t[0] || '';
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}
function bdSlug(nm) {
  return String(nm || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
function bdIntl(ph) {
  var d = String(ph || '').replace(/[^\d+]/g, '');
  if (d.replace(/\D/g, '').length < 7) return '';
  return d.charAt(0) === '+' ? d.slice(1) : d.charAt(0) === '0' ? '44' + d.slice(1) : d;
}
function bdLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function bdPeople() {
  var map = {},
    withDob = {},
    noDob = {};
  cases.forEach(function (c) {
    (c.applicants || []).forEach(function (a) {
      var nm = String(a.name || '').trim();
      if (!nm) return;
      var nk = nm.toLowerCase().replace(/\s+/g, ' ');
      if (!a.dob || !/^\d{4}-\d{2}-\d{2}$/.test(a.dob)) {
        noDob[nk] = 1;
        return;
      }
      withDob[nk] = 1;
      var key = nk + '|' + a.dob,
        p = map[key] || (map[key] = { key: key, name: nm, dob: a.dob, phone: '', cases: [] });
      if (!p.phone && a.phone) p.phone = a.phone;
      p.cases.push(c);
    });
  });
  var list = Object.keys(map)
    .map(function (k) {
      var p = map[k],
        m = +p.dob.slice(5, 7),
        d = +p.dob.slice(8, 10),
        y = TODAY.getFullYear();
      var occ = function (yr) {
        return m === 2 && d === 29 && !bdLeap(yr) ? new Date(yr, 1, 28) : new Date(yr, m - 1, d);
      };
      var n = occ(y);
      if (n < TODAY) n = occ(y + 1);
      p.next = n;
      p.days = Math.round((n - TODAY) / 864e5);
      p.age = n.getFullYear() - +p.dob.slice(0, 4);
      p.slug = bdSlug(p.name);
      p.year = n.getFullYear();
      p.muslim = bdMuslim(p.name);
      p.sent = p.cases.some(function (c) {
        return c.bdaySent && c.bdaySent[p.slug] === p.year;
      });
      return p;
    })
    .sort(function (a, b) {
      return a.days - b.days || a.name.localeCompare(b.name);
    });
  var missing = Object.keys(noDob).filter(function (k) {
    return !withDob[k];
  }).length;
  return { list: list, missing: missing };
}
function bdCounts(list) {
  var c = { today: 0, week: 0, month: 0, all: list.length };
  list.forEach(function (p) {
    if (p.sent) return;
    if (p.days === 0) c.today++;
    if (p.days <= 7) c.week++;
    if (p.days <= 30) c.month++;
  });
  return c;
}
function bdMessage(p) {
  if (bdDraft[p.key] != null) return bdDraft[p.key];
  var isl = bdMode(p) === 'isl',
    g = isl ? bdGender(p) : '',
    who = g === 'm' ? 'brother' : g === 'f' ? 'sister' : bdFirst(p.name),
    t = bdList(p)[bdPick(p)].replace(/\{name\}/g, who),
    sg = bdSig().trim();
  if (isl && g === 'f') t = t.replace(/\bfeek\b/g, 'feeki');
  return sg ? t + '\n\n' + sg : t;
}
function bdShell() {
  return (
    '<div class="pagehead"><h1>Birthdays</h1><span class="muted">Send a birthday message with one click</span></div><div id="bdTplBox"></div><div class="filters" style="margin:10px 0"><input type="search" id="bdQ" class="search" style="width:100%" placeholder="Search by name" aria-label="Search birthdays" value="' +
    esc(bdQuery) +
    '"></div><div id="bdChips" class="chips" style="margin:10px 0"></div><div id="bdList"></div>'
  );
}
function bdTplRender() {
  var b = $('#bdTplBox');
  if (!b) return;
  b.innerHTML = bdTplOpen
    ? '<div class="bdc" style="border-left-color:var(--accent)"><b>Birthday messages</b><div class="muted" style="font-size:12px;margin:2px 0 6px">' +
      bdMsgs().length +
      ' messages. Each client is given one of them automatically (standard greetings). Write {name} where the first name goes, and put a line with --- between messages.</div><textarea id="bdMsgsText" rows="14">' +
      esc(bdMsgs().join('\n---\n')) +
      '</textarea><div class="muted" style="font-size:12px;margin:8px 0 2px">Signature, added at the end of every message</div><textarea id="bdSigText" rows="3">' +
      esc(bdSig()) +
      '</textarea><div class="muted" style="font-size:12px;margin:10px 0 2px">Islamic greetings (' +
      bdIsl().length +
      '). Used first for clients whose names suggest they may be Muslim. Write {name} where "brother" or "sister" should go (chosen from the name, and you can change it on each client). Same format, with --- between messages.</div><textarea id="bdIslText" rows="10">' +
      esc(bdIsl().join('\n---\n')) +
      '</textarea><div class="add" style="margin-top:8px"><button type="button" class="btn" id="bdTplSave">Save</button><button type="button" class="btn ghost" id="bdTplReset">Reset to the standard messages</button><button type="button" class="btn ghost" id="bdTplBtn">Close</button></div></div>'
    : '<button type="button" class="btn ghost sm" id="bdTplBtn">Edit messages and signature</button>';
}
function bdDobText(p) {
  var y = +p.dob.slice(0, 4),
    d = new Date(y, +p.dob.slice(5, 7) - 1, +p.dob.slice(8, 10));
  return d.toLocaleDateString(
    'en-GB',
    y >= 1900 && y <= TODAY.getFullYear()
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' }
  );
}
function bdSentAt(p) {
  var t = 0;
  p.cases.forEach(function (c) {
    if (c.bdaySent && c.bdaySent[p.slug] === p.year && c.bdaySentAt && c.bdaySentAt[p.slug] > t)
      t = c.bdaySentAt[p.slug];
  });
  return t;
}
function bdItem(p) {
  var intl = bdIntl(p.phone),
    open = bdOpen[p.key] !== undefined ? bdOpen[p.key] : p.days <= 7;
  var when =
    p.days === 0
      ? 'Today'
      : p.days === 1
        ? 'Tomorrow'
        : p.next.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  var meta = [
    when + (p.days > 1 ? ' · in ' + p.days + ' days' : ''),
    p.age >= 16 && p.age <= 110 ? 'turns ' + p.age : '',
    p.phone ? esc(p.phone) : 'no phone number'
  ]
    .filter(Boolean)
    .join(' · ');
  var c0 = p.cases.slice().sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    })[0],
    sa = p.sent ? bdSentAt(p) : 0;
  var h =
    '<div class="bdc' +
    (p.sent ? ' sent' : '') +
    '" data-bdkey="' +
    esc(p.key) +
    '"><div class="bdh"><div><b>' +
    esc(p.name) +
    '</b> <span class="muted" style="font-size:13px">🎂 ' +
    esc(bdDobText(p)) +
    '</span>' +
    (p.sent ? '<span class="bdok">✓ Sent' + (sa ? ' ' + shortStamp(sa) : '') + '</span>' : '') +
    '</div><div class="muted" style="font-size:12px">' +
    meta +
    ' · <button type="button" class="lnk" data-open="' +
    c0.id +
    '">' +
    (c0.clientNo ? esc(c0.clientNo) : 'open case') +
    '</button></div></div>';
  if (!open)
    return (
      h +
      '<div class="add" style="margin-top:6px"><button type="button" class="btn ghost sm" data-bdopen="' +
      esc(p.key) +
      '">Write message</button><label class="bdchk"><input type="checkbox" data-bdchk="' +
      esc(p.key) +
      '"' +
      (p.sent ? ' checked' : '') +
      '> Sent</label></div></div>'
    );
  var isl = bdMode(p) === 'isl',
    tip =
      isl && p.muslim && !bdKind[p.key]
        ? '<div class="muted" style="font-size:12px;margin:4px 0">Suggested: Islamic greeting, chosen from the name. Check it suits this client, or switch to the standard greeting.</div>'
        : '';
  if (isl && !bdGender(p))
    tip +=
      '<div style="font-size:12px;margin:4px 0;color:#8A5A00">Choose Brother or Sister below. The name does not show which, so the first name is used until you pick.</div>';
  return (
    h +
    tip +
    '<textarea data-bdmsg="' +
    esc(p.key) +
    '" rows="7" aria-label="Birthday message for ' +
    esc(p.name) +
    '">' +
    esc(bdMessage(p)) +
    '</textarea><div class="add" style="margin-top:6px">' +
    (intl
      ? '<button type="button" class="btn bdwa" data-bdsend="' + esc(p.key) + '">Send on WhatsApp</button>'
      : '<span class="muted" style="align-self:center;font-size:12px">Add a phone number to the case to send on WhatsApp.</span>') +
    (isl ? bdGenBtns(p) : '') +
    '<button type="button" class="btn ghost" data-bdkind="' +
    esc(p.key) +
    '">' +
    (isl ? 'Use standard greeting' : 'Use Islamic greeting') +
    '</button><button type="button" class="btn ghost" data-bdshuf="' +
    esc(p.key) +
    '" title="Pick a different message">Another message</button><button type="button" class="btn ghost" data-bdcopy="' +
    esc(p.key) +
    '">Copy message</button><label class="bdchk"><input type="checkbox" data-bdchk="' +
    esc(p.key) +
    '"' +
    (p.sent ? ' checked' : '') +
    '> Sent</label>' +
    (bdOpen[p.key] !== undefined && p.days > 7
      ? '<button type="button" class="btn ghost sm" data-bdopen="' + esc(p.key) + '">Hide</button>'
      : '') +
    '</div></div>'
  );
}
function bdRender() {
  var box = $('#bdList');
  if (!box) return;
  var ae = document.activeElement;
  if (ae && ae.matches && ae.matches('[data-bdmsg]')) return;
  var r = bdPeople(),
    cnt = bdCounts(r.list),
    q = bdQuery.trim().toLowerCase();
  var chips = [
    ['today', 'Today'],
    ['week', 'Next 7 days'],
    ['month', 'Next 30 days'],
    ['all', 'All']
  ];
  $('#bdChips').innerHTML = chips
    .map(function (c) {
      return (
        '<button type="button" data-bdf="' +
        c[0] +
        '" aria-pressed="' +
        (bdFilter === c[0]) +
        '">' +
        c[1] +
        ' ' +
        cnt[c[0]] +
        '</button>'
      );
    })
    .join('');
  var max = { today: 0, week: 7, month: 30, all: 400 }[bdFilter];
  var items = r.list.filter(function (p) {
    return p.days <= max && (!q || p.name.toLowerCase().indexOf(q) > -1);
  });
  var h = '';
  if (!r.list.length)
    h =
      '<div class="empty"><h2>No birthdays yet</h2>Birthdays come from the date of birth saved on each client. Add dates of birth to the cases and they will appear here.</div>';
  else if (!items.length) h = '<div class="empty">Nobody has a birthday in this period.</div>';
  else {
    var groups = [
      [
        'Today',
        function (p) {
          return p.days === 0;
        }
      ],
      [
        'Next 7 days',
        function (p) {
          return p.days > 0 && p.days <= 7;
        }
      ],
      [
        'Next 30 days',
        function (p) {
          return p.days > 7 && p.days <= 30;
        }
      ],
      [
        'Later',
        function (p) {
          return p.days > 30;
        }
      ]
    ];
    groups.forEach(function (g) {
      var gi = items.filter(g[1]);
      if (!gi.length) return;
      h += '<div class="tgh">' + g[0] + ' · ' + gi.length + '</div>' + gi.map(bdItem).join('');
    });
  }
  if (r.missing)
    h +=
      '<p class="muted" style="margin-top:14px">' +
      r.missing +
      ' client' +
      (r.missing === 1 ? ' has' : 's have') +
      ' no date of birth saved, so they cannot appear here.</p>';
  box.innerHTML = h;
}
function bdFind(key) {
  return bdPeople().list.filter(function (p) {
    return p.key === key;
  })[0];
}
function bdText(p) {
  var ta = document.querySelector(
    '[data-bdmsg="' + (window.CSS && CSS.escape ? CSS.escape(p.key) : p.key) + '"]'
  );
  return ta ? ta.value : bdMessage(p);
}
function bdSetSent(p, on) {
  var jobs = [];
  p.cases.forEach(function (c) {
    var o = Object.assign({}, c.bdaySent || {}),
      at = Object.assign({}, c.bdaySentAt || {});
    if (on) {
      if (c !== p.cases[0]) return;
      o[p.slug] = p.year;
      at[p.slug] = Date.now();
    } else {
      if (o[p.slug] !== p.year) return;
      delete o[p.slug];
      delete at[p.slug];
    }
    jobs.push([c, { bdaySent: o, bdaySentAt: at }]);
  });
  jobs.forEach(function (j) {
    patch(j[0].id, j[1]);
  });
}
function bdBanner() {
  var b = $('#bdBanner');
  if (!b) return;
  var c = bdCounts(bdPeople().list);
  b.innerHTML =
    c.today || c.week
      ? '<div class="bdban"><b>🎂 Birthdays</b><span>' +
        (c.today ? c.today + ' today' : 'none today') +
        ' · ' +
        c.week +
        ' in the next 7 days</span><button type="button" class="btn sm" data-bdgo="1" style="margin-left:auto">Send birthday messages</button></div>'
      : '';
}
function shortStamp(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
var editNote = null,
  editTk = null;
function tkKey(t) {
  return (t.due || '9999-99-99') + ' ' + (t.time || '99:99');
}
function tkEditor(k, t) {
  return (
    '<div class="tkedit" data-tkbox="' +
    k +
    '"><input type="text" data-tkf="text" value="' +
    esc(t.text) +
    '" aria-label="Task"><input type="date" data-tkf="due" value="' +
    esc(t.due || '') +
    '" aria-label="Due date"><input type="time" data-tkf="time" value="' +
    esc(t.time || '') +
    '" aria-label="Time"><label class="prichk"><input type="checkbox" data-tkf="pri"' +
    (t.pri ? ' checked' : '') +
    '> High priority</label><button type="button" class="btn" data-tkesave="' +
    k +
    '">Save</button><button type="button" class="btn ghost" data-tkecancel="1">Cancel</button></div>'
  );
}
function rerenderTasks() {
  if (openId) renderLive();
  if ($('#trList')) renderTray();
  renderSide();
}
function noteItem(n, list, suffix, fmt) {
  var head = stampOf(n.ts) + suffix + (n.edited ? ' · edited ' + shortStamp(n.edited) : '');
  if (editNote && editNote.list === list && editNote.ts === n.ts)
    return (
      '<div class="note"><small>' +
      head +
      '</small><textarea id="ntEdit" class="nbb" style="min-height:140px" aria-label="Edit note">' +
      esc(n.text || '') +
      '</textarea><div class="add"><button type="button" class="btn" id="ntEditSave">Save changes</button><button type="button" class="btn ghost" id="ntEditCancel">Cancel</button></div>' +
      tblBlock(n, list) +
      '</div>'
    );
  return (
    '<div class="note"><small>' +
    head +
    ' <button type="button" class="btn ghost sm" data-nedit="' +
    list +
    '|' +
    n.ts +
    '" style="margin-left:8px">Edit</button></small>' +
    fmt(n.text) +
    tblBlock(n, list) +
    '</div>'
  );
}
var colOpen = {};
