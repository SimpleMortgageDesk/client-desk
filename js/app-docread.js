'use strict';
/* MySimpleDesk app: Read a document or a photo (every trade).
   Take a photo with the camera, or choose a PDF or picture. It is read on this device (nothing is sent anywhere),
   and what was found is listed for you to tick: contact details to start a new record or fill in the open one,
   dates to turn into reminders, and a note. The mortgage lender reader in app-lender-pdf.js uses the same chooser.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */

/* ---------- choose a photo or a file ---------- */
function drIsDocx(f) {
  return /\.docx$/i.test(f.name || '') || /wordprocessingml/i.test(f.type || '');
}
function drIsTxt(f) {
  return /\.txt$/i.test(f.name || '') || /^text\/plain/i.test(f.type || '');
}
function drIsPdf(f) {
  return /pdf/i.test(f.type || '') || /\.pdf$/i.test(f.name || '');
}
function drShell(html, label) {
  var old = document.getElementById('drOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'drOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:290;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div role="dialog" aria-modal="true" aria-label="' +
    esc(label) +
    '" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(560px,100%);max-height:92vh;overflow:auto;border-radius:14px;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
    html +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function (e) {
    if (e.target === ov && !ov.getAttribute('data-busy')) ov.remove();
  });
  return ov;
}
/* the two buttons: Take a photo, Choose a file. then(files) is called with what was picked. */
function drChoose(then) {
  var ov = drShell(
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h2 style="margin:0;font-size:20px">Document reader</h2><button type="button" class="btn ghost sm" id="drX">Close</button></div>' +
      '<p class="muted" style="margin:0 0 14px">Take a photo of a document, or choose a PDF, a Word document or a picture. It is read on this device and is not sent anywhere.</p>' +
      '<div style="display:grid;gap:10px"><button type="button" class="btn" id="drCam" style="min-height:52px;font-size:16px">Take a photo</button>' +
      '<button type="button" class="btn ghost" id="drFile" style="min-height:52px;font-size:16px">Choose a file (PDF, Word or picture)</button></div>' +
      '<p class="muted" style="font-size:12px;margin:14px 0 0">Tip: lay the page flat in good light and fill the screen with it. Printed text reads best.</p>',
    'Document reader'
  );
  var pick = function (cam) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = cam ? 'image/*' : 'application/pdf,.pdf,image/*,.docx,.txt';
    if (cam) inp.setAttribute('capture', 'environment');
    else inp.multiple = true;
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('cancel', function () {
      inp.remove();
    });
    inp.addEventListener('change', function () {
      var fs = [].slice.call(inp.files || []);
      inp.remove();
      if (fs.length) {
        ov.remove();
        then(fs);
      }
    });
    inp.click();
  };
  ov.querySelector('#drCam').onclick = function () {
    pick(true);
  };
  ov.querySelector('#drFile').onclick = function () {
    pick(false);
  };
  ov.querySelector('#drX').onclick = function () {
    ov.remove();
  };
}

/* ---------- read the text: PDF text, or a picture through the on-device text reader ---------- */
/* a big phone photo is made smaller first, so reading it is quick */
function drShrink(blob) {
  if (!window.createImageBitmap) return Promise.resolve(blob);
  return createImageBitmap(blob).then(
    function (bm) {
      var k = Math.min(1, 2200 / Math.max(bm.width, bm.height)),
        c = document.createElement('canvas');
      c.width = Math.round(bm.width * k);
      c.height = Math.round(bm.height * k);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      return new Promise(function (r) {
        c.toBlob(function (b) {
          r(b || blob);
        }, 'image/png');
      });
    },
    function () {
      return blob;
    }
  );
}
function drBusy(on, msg) {
  var ov = document.getElementById('drOv');
  if (!on) {
    if (ov) ov.remove();
    return;
  }
  if (!ov || !ov.getAttribute('data-busy')) {
    ov = drShell('<p id="drMsg" role="status" style="margin:6px 0;font-size:16px"></p>', 'Reading');
    ov.setAttribute('data-busy', '1');
  }
  document.getElementById('drMsg').textContent = msg;
}
/* ---------- Word documents (.docx): a zip file with the words in word/document.xml ---------- */
function drZipFile(buf, want) {
  var v = new DataView(buf),
    u = new Uint8Array(buf),
    e = -1,
    i;
  for (i = u.length - 22; i >= Math.max(0, u.length - 65600); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  if (e < 0) return Promise.reject(new Error('That file is not a Word document.'));
  var n = v.getUint16(e + 10, true),
    p = v.getUint32(e + 16, true),
    dec = new TextDecoder();
  for (i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    var method = v.getUint16(p + 10, true),
      csize = v.getUint32(p + 20, true),
      usize = v.getUint32(p + 24, true),
      nl = v.getUint16(p + 28, true),
      xl = v.getUint16(p + 30, true),
      cl = v.getUint16(p + 32, true),
      off = v.getUint32(p + 42, true),
      name = dec.decode(u.subarray(p + 46, p + 46 + nl));
    if (name === want) {
      if (usize > 30e6) return Promise.reject(new Error('That Word document is too big to read here.'));
      var start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true),
        data = u.subarray(start, start + csize);
      if (method === 0) return Promise.resolve(data);
      if (method !== 8 || typeof DecompressionStream === 'undefined')
        return Promise.reject(
          new Error('This browser cannot open Word documents. Save it as a PDF instead.')
        );
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')))
        .arrayBuffer()
        .then(function (ab) {
          return new Uint8Array(ab);
        });
    }
    p += 46 + nl + xl + cl;
  }
  return Promise.reject(new Error('That Word document has no text in it.'));
}
/* the text of one paragraph element */
function drPara(el) {
  var out = '';
  (function walk(n) {
    for (var c = n.firstChild; c; c = c.nextSibling) {
      var t = c.nodeName;
      if (t === 'w:t') out += c.textContent;
      else if (t === 'w:tab') out += '\t';
      else if (t === 'w:br' || t === 'w:cr') out += '\n';
      else if (t === 'w:del') continue;
      else if (c.firstChild) walk(c);
    }
  })(el);
  return out;
}
/* a table becomes lines: a two-column row is "Label: value", and a header row with one row under it pairs each heading with its value */
function drTable(tbl) {
  var rows = [].slice
    .call(tbl.childNodes)
    .filter(function (r) {
      return r.nodeName === 'w:tr';
    })
    .map(function (r) {
      return [].slice
        .call(r.childNodes)
        .filter(function (c) {
          return c.nodeName === 'w:tc';
        })
        .map(function (c) {
          return [].slice
            .call(c.getElementsByTagName('w:p'))
            .map(drPara)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        });
    });
  var out = [],
    short =
      rows.length > 1 &&
      rows[0].length > 2 &&
      rows[0].every(function (c) {
        return c && c.length <= 28;
      });
  if (
    short &&
    rows.slice(1).every(function (r) {
      return r.length === rows[0].length;
    })
  ) {
    rows.slice(1).forEach(function (r) {
      r.forEach(function (c, i) {
        if (c) out.push(rows[0][i].replace(/:\s*$/, '') + ': ' + c);
      });
      out.push('');
    });
    return out.join('\n');
  }
  rows.forEach(function (r) {
    var cells = r.filter(Boolean);
    if (cells.length === 2 && cells[0].length <= 40)
      out.push(cells[0].replace(/:\s*$/, '') + ': ' + cells[1]);
    else if (cells.length) out.push(cells.join('  '));
  });
  return out.join('\n');
}
function drDocx(file) {
  if (file.size > 40e6) return Promise.reject(new Error('That file is too big to read here.'));
  return file
    .arrayBuffer()
    .then(function (buf) {
      return drZipFile(buf, 'word/document.xml');
    })
    .then(function (xml) {
      var doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'text/xml'),
        body = doc.getElementsByTagName('w:body')[0],
        out = [];
      if (!body) throw new Error('That Word document has no text in it.');
      [].slice.call(body.childNodes).forEach(function (n) {
        if (n.nodeName === 'w:p') out.push(drPara(n));
        else if (n.nodeName === 'w:tbl') out.push(drTable(n));
      });
      return out.join('\n');
    });
}
/* the text of one file */
function drText(file) {
  if (drIsDocx(file)) {
    drBusy(true, 'Reading ' + file.name + '…');
    return drDocx(file);
  }
  if (drIsTxt(file)) return file.text();
  var prog = function (st, p) {
    drBusy(true, 'Reading the ' + (drIsPdf(file) ? 'page' : 'photo') + '… ' + Math.round(p * 100) + '%');
  };
  drBusy(true, 'Reading ' + file.name + '…');
  if (!drIsPdf(file))
    return drShrink(file).then(function (b) {
      return dxOcr(b, prog);
    });
  return dxPdf(file).then(function (r) {
    if (r.text.replace(/\s/g, '').length >= 40) return r.text;
    /* a scanned PDF has no text: draw the first page and read it like a photo */
    return dxPdfPic(r.doc).then(function (pic) {
      return dxOcr(pic, prog);
    });
  });
}

/* ---------- find the useful details in the text ---------- */
var DR_KINDS = [
  [/gas safety|cp12|landlord gas/i, 'Gas safety record'],
  [/electrical installation condition|eicr/i, 'Electrical report (EICR)'],
  [/energy performance|\bepc\b/i, 'Energy performance certificate'],
  [/certificate of insurance|insurance|policy (?:number|schedule)|premium/i, 'Insurance document'],
  [/quotation|\bquote\b|estimate/i, 'Quote'],
  [/invoice/i, 'Invoice'],
  [/engagement letter|letter of engagement/i, 'Engagement letter'],
  [/tenancy agreement|assured shorthold/i, 'Tenancy agreement'],
  [/\bmot\b|vehicle|registration/i, 'Vehicle document'],
  [/warranty|guarantee/i, 'Guarantee'],
  [/certificate/i, 'Certificate']
];
var DR_DATE_END =
  /(renewal|renews?|expir\w*|valid (?:until|till|to)|due|next (?:service|inspection|test|review|check)|re-?test|review (?:date|by)|end date|ends?|cover ends|policy ends)/;
var DR_DATE_LABEL =
  /(date of (?:inspection|issue|test|service|certificate|report)|inspection date|issue date|issued|next (?:service|inspection|test|review)|review (?:date|by)|re-?test|renewal date|renewal|renews?|expiry date|expires?|expiry|valid (?:until|till|to)|due date|due|end date|cover ends|policy ends|completion date|test date)/;
function drTitle(s) {
  return s.replace(/\b[a-z]/g, function (c) {
    return c.toUpperCase();
  });
}
/* a date of birth written as 12/03/1984, 12 March 1984, March 12 1984 or 1984-03-12 (day first, as in the UK) */
function drDobParse(t) {
  var MON = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12
    },
    mk = function (y, mo, d, txt) {
      y = +y;
      if (y < 100) y += y > 30 ? 1900 : 2000;
      var dt = new Date(y, mo - 1, +d);
      return y >= 1900 && dt.getMonth() === mo - 1 && dt.getDate() === +d ? { iso: iso(dt), txt: txt } : null;
    },
    m;
  if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return mk(m[1], +m[2], m[3], m[0]);
  if ((m = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/))) return mk(m[3], +m[2], m[1], m[0]);
  if (
    (m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?[ \-]+([A-Za-z]{3,9})[ ,\-]+(\d{4})\b/)) &&
    MON[m[2].slice(0, 3).toLowerCase()]
  )
    return mk(m[3], MON[m[2].slice(0, 3).toLowerCase()], m[1], m[0]);
  if (
    (m = t.match(/\b([A-Za-z]{3,9})[ ]+(\d{1,2})(?:st|nd|rd|th)?,?[ ]+(\d{4})\b/)) &&
    MON[m[1].slice(0, 3).toLowerCase()]
  )
    return mk(m[3], MON[m[1].slice(0, 3).toLowerCase()], m[2], m[0]);
  return null;
}
function drExtract(text) {
  var src = String(text || '').replace(/\r/g, ''),
    flat = src.replace(/\s+/g, ' '),
    lines = src
      .split('\n')
      .map(function (l) {
        return l.replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean),
    r = {
      kind: '',
      name: '',
      phone: '',
      email: '',
      address: '',
      postcode: '',
      dob: '',
      rest: '',
      dates: [],
      amounts: [],
      refs: [],
      text: src
    };
  DR_KINDS.some(function (k) {
    if (k[0].test(flat)) {
      r.kind = k[1];
      return true;
    }
  });
  var m = flat.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
  if (m) r.email = m[0];
  m = flat.match(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:7\d{3}|\d{3,4})[\s-]?\d{3}[\s-]?\d{3,4}\b/);
  if (m) r.phone = m[0].replace(/\s+/g, ' ').trim();
  /* name: a label, or Mr / Mrs / Ms / Miss / Dr and the words after it */
  m = flat.match(
    /(?:customer|client|landlord|tenant|insured|policy ?holder|account holder|applicant|prepared for|installed for|property owner|name)\s*(?:name)?\s*[:\-]\s*((?:Mr|Mrs|Ms|Miss|Mx|Dr)?\.?\s*[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3})/
  );
  if (!m) m = flat.match(/\b((?:Mr|Mrs|Ms|Miss|Mx|Dr)\.?\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})/);
  if (m) r.name = m[1].replace(/\s+(?:Address|Phone|Tel|Email|Date|Ref)\b.*$/i, '').trim();
  /* address: the line with the first postcode, with the line above it when that is short */
  var pc = /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/i;
  for (var i = 0; i < lines.length; i++) {
    var pm = lines[i].match(pc);
    if (!pm) continue;
    r.postcode = (pm[1] + ' ' + pm[2]).toUpperCase();
    var line = lines[i]
      .replace(/^.*?(?:address|property|premises|site)\s*[:\-]\s*/i, '')
      .replace(/\s*(?:tel|phone|email|mobile)\b.*$/i, '')
      .trim();
    if (line.toUpperCase().replace(/\s+/g, ' ') === r.postcode && i > 0) line = lines[i - 1] + ', ' + line;
    else if (
      i > 0 &&
      lines[i - 1].length < 45 &&
      /\d/.test(lines[i - 1]) &&
      !/date|tel|phone|ref|no\b|number/i.test(lines[i - 1])
    )
      line = lines[i - 1].replace(/^.*?(?:address|property|premises|site)\s*[:\-]\s*/i, '') + ', ' + line;
    r.address = line.slice(0, 140);
    break;
  }
  /* date of birth: it is not a reminder date (and it can be before 1990, which the reminder-date reader ignores) */
  m = flat.match(/(?:date of birth|d\.?o\.?b\.?|born(?: on)?)\s*[:\-]?\s*([0-9A-Za-z ,\/.\-]{6,24})/i);
  var dobTxt = '';
  if (m) {
    var bd = drDobParse(m[1]);
    if (bd && bd.iso < iso(TODAY)) {
      r.dob = bd.iso;
      dobTxt = bd.txt;
    }
  }
  /* dates, with the words in front of them */
  var seen = {};
  dxDates(flat).forEach(function (d) {
    if (seen[d.iso] || d.iso === r.dob || r.dates.length >= 8) return;
    seen[d.iso] = 1;
    var tail = d.before.slice(-45),
      lm = tail.match(DR_DATE_LABEL);
    r.dates.push({
      iso: d.iso,
      label: lm ? drTitle(lm[1].replace(/\s+/g, ' ')) : 'Date on the document',
      end: DR_DATE_END.test(tail) && d.iso >= iso(TODAY)
    });
  });
  /* amounts */
  var re =
      /(?:(total|amount due|balance|quote|quoted|price|premium|fee|cost|estimate|net|gross|vat)[^£\d]{0,25})?£\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi,
    am;
  while ((am = re.exec(flat)) && r.amounts.length < 4) {
    var v = '£' + am[2];
    if (
      !r.amounts.some(function (a) {
        return a.v === v;
      })
    )
      r.amounts.push({ v: v, label: am[1] ? drTitle(am[1]) : 'Amount' });
  }
  /* reference numbers */
  var rr =
      /(certificate|policy|reference|ref|invoice|quote|job|registration|licence|gas safe|vat|account)\s*(?:no|number|num|id|#)?\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9\/-]{4,22})/gi,
    rm;
  while ((rm = rr.exec(flat)) && r.refs.length < 3) {
    if (!/\d/.test(rm[2])) continue;
    r.refs.push({ v: rm[2], label: drTitle(rm[1]) });
  }
  /* everything else on the page, for the notes: the lines that only repeat the contact details are left out */
  var used = [r.name, r.email, r.phone, r.postcode, r.dob]

    .concat(dobTxt ? [dobTxt] : [])
    .filter(function (x) {
      return x && x.length > 3;
    })
    .map(function (x) {
      return x.toLowerCase();
    });
  r.rest = lines
    .filter(function (l) {
      var lo = l.toLowerCase();
      return !used.some(function (u) {
        return lo.indexOf(u) > -1;
      });
    })
    .join('\n')
    .slice(0, 6000);
  return r;
}

/* ---------- the list of what was found ---------- */
var DR_LEAD = [
  ['0', 'On the day'],
  ['7', '1 week before'],
  ['14', '2 weeks before'],
  ['30', '1 month before']
];
function drFieldHtml(id, label, val, type) {
  return (
    '<label class="f" style="margin:0"><span>' +
    esc(label) +
    '</span><input id="' +
    id +
    '" type="' +
    (type || 'text') +
    '" value="' +
    esc(val) +
    '"></label>'
  );
}
function drReview(res, file) {
  var noun = T.noun[0].toLowerCase(),
    open = openId ? currentCase() : null,
    ll = !!T.tenancyMode;
  var datesHtml = res.dates
    .map(function (d, i) {
      return (
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--line,#E5EAED)"><input type="checkbox" data-drd="' +
        i +
        '"' +
        (d.end ? ' checked' : '') +
        ' aria-label="Remind me about this date" style="width:20px;height:20px"><input data-drdl="' +
        i +
        '" value="' +
        esc(d.label) +
        '" aria-label="What this date is" style="flex:1 1 160px;min-width:0"><input data-drdv="' +
        i +
        '" type="date" value="' +
        esc(d.iso) +
        '" aria-label="Date"></div>'
      );
    })
    .join('');
  var body =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h2 style="margin:0;font-size:20px">Found in the document</h2><button type="button" class="btn ghost sm" id="drX">Close</button></div>' +
    '<p class="muted" style="margin:0 0 12px;font-size:13px">' +
    (res.kind ? 'Looks like: <b>' + esc(res.kind) + '</b>. ' : '') +
    'Check each detail against the document, change anything that is wrong, and untick what you do not want. The document itself is not saved.</p>' +
    '<div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">' +
    (ll
      ? ''
      : drFieldHtml('drName', 'Name', res.name) +
        drFieldHtml('drPhone', 'Phone', res.phone, 'tel') +
        drFieldHtml('drEmail', 'Email', res.email, 'email') +
        (T.dob ? drFieldHtml('drDob', 'Date of birth', res.dob, 'date') : '')) +
    '<div style="grid-column:1/-1">' +
    drFieldHtml('drAddr', ll ? 'Property address' : 'Address', res.address) +
    '</div>' +
    (ll ? '<div>' + drFieldHtml('drPc', 'Postcode', res.postcode) + '</div>' : '') +
    '</div>' +
    (res.dates.length
      ? '<h3 style="margin:16px 0 4px;font-size:15px">Dates to remind you about</h3><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px"><span class="muted" style="font-size:13px">Remind me</span><select id="drLead" aria-label="How long before">' +
        DR_LEAD.map(function (l) {
          return (
            '<option value="' + l[0] + '"' + (l[0] === '14' ? ' selected' : '') + '>' + l[1] + '</option>'
          );
        }).join('') +
        '</select></div>' +
        datesHtml
      : '<p class="muted" style="margin:14px 0 0;font-size:13px">No dates were found.</p>') +
    (res.amounts.length || res.refs.length
      ? '<label style="display:flex;gap:10px;align-items:flex-start;margin-top:14px;cursor:pointer"><input type="checkbox" id="drNote" checked style="margin-top:3px;width:18px;height:18px"><span>Add a note with what was found<br><span class="muted" style="font-size:12px">' +
        esc(
          res.refs
            .map(function (x) {
              return x.label + ' ' + x.v;
            })
            .concat(
              res.amounts.map(function (x) {
                return x.label + ' ' + x.v;
              })
            )
            .join(' · ')
        ) +
        '</span></span></label>'
      : '') +
    (res.rest
      ? '<label style="display:flex;gap:10px;align-items:flex-start;margin-top:14px;cursor:pointer"><input type="checkbox" id="drRestOn"' +
        (drIsDocx(file || {}) || drIsTxt(file || {}) ? ' checked' : '') +
        ' style="margin-top:3px;width:18px;height:18px"><span style="flex:1;min-width:0">Add the rest of the document to the notes<br><span class="muted" style="font-size:12px">You can edit it first.</span></span></label><textarea id="drRest" rows="6" aria-label="Notes to add" style="width:100%;margin-top:6px;font:inherit">' +
        esc(res.rest) +
        '</textarea>'
      : '') +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:18px">' +
    (open
      ? '<button type="button" class="btn ghost" id="drAdd">Add to this ' + esc(noun) + '</button>'
      : '') +
    '<button type="button" class="btn" id="drNew">Create a new ' +
    esc(noun) +
    '</button></div>';
  var ov = drShell(body, 'Found in the document');
  var val = function (id) {
    var e = ov.querySelector('#' + id);
    return e ? e.value.trim() : '';
  };
  var chosen = function () {
    var lead = +val('drLead') || 0,
      tasks = [],
      now = Date.now();
    ov.querySelectorAll('[data-drd]').forEach(function (c) {
      if (!c.checked) return;
      var i = c.getAttribute('data-drd'),
        d = ov.querySelector('[data-drdv="' + i + '"]').value,
        lb = ov.querySelector('[data-drdl="' + i + '"]').value.trim() || 'Date on the document';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var due = lead ? addDays(d, -lead) : d;
      if (due < iso(TODAY)) due = iso(TODAY);
      tasks.push({
        id: uid(),
        text: (res.kind ? res.kind + ': ' : '') + lb + ' ' + fd(d),
        due: due,
        time: '',
        done: false,
        created: now,
        pri: false,
        from: 'document'
      });
    });
    var note = '';
    var nb = ov.querySelector('#drNote');
    if (nb && nb.checked)
      note =
        'Read from ' +
        (file && file.name ? file.name : 'a document') +
        (res.kind ? ' (' + res.kind + ')' : '') +
        ': ' +
        res.refs
          .map(function (x) {
            return x.label + ' ' + x.v;
          })
          .concat(
            res.amounts.map(function (x) {
              return x.label + ' ' + x.v;
            })
          )
          .join(', ');
    var rest = ov.querySelector('#drRestOn'),
      notes = [];
    if (note) notes.push(note);
    if (rest && rest.checked && val('drRest')) notes.push(ov.querySelector('#drRest').value.trim());
    return {
      tasks: tasks,
      note: note,
      notes: notes,
      p: {
        name: val('drName'),
        phone: val('drPhone'),
        email: val('drEmail'),
        address: val('drAddr'),
        postcode: val('drPc'),
        dob: val('drDob')
      }
    };
  };
  ov.querySelector('#drX').onclick = function () {
    ov.remove();
  };
  ov.querySelector('#drNew').onclick = function () {
    var c = chosen();
    ov.remove();
    drCreate(c);
  };
  var add = ov.querySelector('#drAdd');
  if (add)
    add.onclick = function () {
      var c = chosen();
      ov.remove();
      drAddTo(c);
    };
}

/* ---------- use what was ticked ---------- */
/* tasks and a note go onto a record once it exists */
function drAttach(id, c) {
  var tries = 0,
    go = function () {
      var rec = cases.filter(function (x) {
        return x.id === id;
      })[0];
      if (!rec) {
        if (++tries < 25) setTimeout(go, 200);
        return;
      }
      var up = {};
      if (c.tasks.length) up.tasks = (rec.tasks || []).concat(c.tasks);
      var nn = c.notes || (c.note ? [c.note] : []);
      if (nn.length)
        up.notes = (rec.notes || []).concat(
          nn.map(function (x, k) {
            return { ts: Date.now() + k, text: x };
          })
        );
      if (up.tasks || up.notes) patch(id, up);
    };
  go();
}
function drCreate(c) {
  var d = {};
  if (T.tenancyMode) {
    if (c.p.address) d.propertyAddress = c.p.address;
    if (c.p.postcode) d.postcode = c.p.postcode;
  } else {
    d.applicants = [
      { name: c.p.name, phone: c.p.phone, email: c.p.email, address: c.p.address, dob: c.p.dob }
    ];
  }
  closeDrawer();
  openDrawer(null, d);
  var ready = T.tenancyMode ? !!c.p.address : !!c.p.name;
  if (!ready) {
    toast(
      'Add ' + (T.tenancyMode ? 'the address' : 'a name') + ' and it saves. The reminders were not added.'
    );
    return;
  }
  newBase = '';
  setTimeout(autoSave, 300);
  var t0 = Date.now(),
    wait = function () {
      if (openId) {
        drAttach(openId, c);
        toast(T.noun[0] + ' created from the document. Check every detail before relying on it.');
      } else if (Date.now() - t0 < 6000) setTimeout(wait, 250);
    };
  setTimeout(wait, 400);
}
function drAddTo(c) {
  var id = openId;
  if (!id) return;
  if (!T.tenancyMode) {
    var row = document.querySelector('#apps .app');
    if (row)
      [
        ['name', c.p.name],
        ['phone', c.p.phone],
        ['email', c.p.email],
        ['address', c.p.address],
        ['dob', c.p.dob]
      ].forEach(function (k) {
        var el = row.querySelector('[data-a="' + k[0] + '"]');
        if (el && k[1] && !String(el.value || '').trim()) docSet(el, k[1]);
      });
  }
  drAttach(id, c);
  toast(
    'Added to this ' +
      T.noun[0].toLowerCase() +
      (c.tasks.length ? ' with ' + c.tasks.length + ' reminder' + (c.tasks.length === 1 ? '' : 's') : '') +
      '. Existing details were left as they were.'
  );
}

/* ---------- start ---------- */
/* an old .doc file cannot be opened here: say how to get a .docx */
function drOldDoc(files) {
  if (
    files.some(function (f) {
      return /\.doc$/i.test(f.name || '') || /^application\/msword/i.test(f.type || '');
    })
  ) {
    toast(
      'That is an old Word file (.doc). In Word choose File, Save As, then Word Document (.docx), and read that one.'
    );
    return true;
  }
  return false;
}
function drRun(files) {
  if (drOldDoc(files)) return;
  drText(files[0])
    .then(function (text) {
      drBusy(false);
      if (!String(text).replace(/\s/g, '').length) {
        toast('Nothing could be read. Try a clearer photo, with the page flat and well lit.');
        return;
      }
      drReview(drExtract(text), files[0]);
    })
    .catch(function (e) {
      drBusy(false);
      toast((e && e.message) || 'Could not read that document');
    });
}
function drStart() {
  /* mortgage advisers keep their lender reader; the chooser is shared so it can take a photo too */
  if (T.id === 'mortgage') {
    drChoose(function (files) {
      if (drOldDoc(files)) return;
      /* a Word document or text file is a client sheet, read by the general reader; lender PDFs and photos go to the lender reader */
      if (drIsDocx(files[0]) || drIsTxt(files[0])) drRun(files);
      else if (openId) docRead(files);
      else importPdfs(files);
    });
    return;
  }
  drChoose(drRun);
}
