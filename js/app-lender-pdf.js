'use strict';
/* MySimpleDesk app: Mortgage adviser: reading a lender document (a decision in principle or a mortgage offer) on the device.
   The PDF is read here with pdf.js and never stored or sent. NI numbers, bank details, ID details, income, spending and health answers are ignored on purpose.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */

var DOC_LENDERS = [
  'Nationwide',
  'Halifax',
  'Barclays',
  'HSBC',
  'Santander',
  'NatWest',
  'Royal Bank of Scotland',
  'Lloyds',
  'TSB',
  'Virgin Money',
  'Yorkshire Building Society',
  'Coventry',
  'Leeds Building Society',
  'Skipton',
  'Accord',
  'Platform',
  'Kensington',
  'Precise',
  'Paragon',
  'The Mortgage Works',
  'Fleet Mortgages',
  'Aldermore',
  'Hinckley & Rugby',
  'Principality',
  'Newcastle',
  'West Brom',
  'Metro Bank',
  'Clydesdale',
  'Bank of Ireland',
  'Foundation',
  'Landbay',
  'Molo',
  'Keystone',
  'LiveMore',
  'Atom',
  'Cumberland',
  'Furness',
  'Marsden',
  'Bath Building Society',
  'Chorley',
  'Darlington',
  'Dudley',
  'Family Building Society',
  'Ipswich',
  'Loughborough',
  'Melton',
  'Monmouthshire',
  'Nottingham',
  'Penrith',
  'Saffron',
  'Scottish Building Society',
  'Stafford',
  'Swansea',
  'Tipton',
  'Vernon',
  'Earl Shilton',
  'Buckinghamshire',
  'Mansfield',
  'Teachers',
  'Post Office',
  'Tesco',
  'Sainsbury',
  'M&S Bank',
  'First Direct',
  'Co-operative',
  'Handelsbanken',
  'Shawbrook',
  'OSB',
  'InterBay',
  'Hampshire Trust',
  'Together',
  'Bluestone',
  'Pepper',
  'Hodge',
  'Vida',
  'MT Finance',
  'Gen H',
  'Perenna',
  'Zephyr',
  'Axis',
  'Allica',
  'Masthaven'
];
var DOC_MON = {
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
};
function docDate(s, old) {
  s = String(s || '');
  var m = s.match(
      /(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})/i
    ),
    d,
    mo,
    y;
  if (m) {
    d = +m[1];
    mo = DOC_MON[m[2].toLowerCase()];
    y = +m[3];
  } else {
    m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    if (!m) return null;
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  }
  if (!d || !mo || d > 31 || mo > 12 || y < (old ? 1900 : 2000) || y > 2100) return null;
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function docMoney(s) {
  var n = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}
function docExtract(text) {
  var flat = String(text || '').replace(/[ \t\u00a0]+/g, ' '),
    lines = flat
      .split('\n')
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean),
    all = lines.join('\n'),
    out = [];
  function add(k, v, src) {
    if (v == null || v === '') return;
    if (
      out.some(function (o) {
        return o.k === k;
      })
    )
      return;
    out.push({ k: k, v: v, src: String(src || '').slice(0, 90) });
  }
  function first(re) {
    var m = all.match(re);
    return m;
  }
  var isOffer =
      /mortgage offer|offer of (?:a )?(?:loan|mortgage)|your offer|offer (?:number|reference)/i.test(all),
    isDip =
      /decision in principle|agreement in principle|mortgage in principle|\bDIP\b|\bAIP\b/i.test(all) &&
      !isOffer;
  // lender: the most-mentioned known lender name
  var best = null,
    bc = 0;
  DOC_LENDERS.forEach(function (n) {
    var re = new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'),
      c = (all.match(re) || []).length;
    if (c > bc) {
      bc = c;
      best = n;
    }
  });
  if (best) add('lender', best, 'Mentioned ' + bc + ' time' + (bc > 1 ? 's' : ''));
  // money
  var m = first(
    /(?:loan amount|amount of (?:the )?(?:loan|mortgage)|amount (?:you(?:'|’)?(?:d| would| want to)? )?(?:to )?borrow(?:ing)?|mortgage amount|total loan(?: amount)?|amount advanced)[^£\d\n]{0,40}£\s?([\d,]+(?:\.\d{2})?)/i
  );
  if (m) add('loanAmount', docMoney(m[1]), m[0]);
  m = first(
    /(?:valuation|property value|valued at|estimated value|market value)[^£\d\n]{0,40}£\s?([\d,]+(?:\.\d{2})?)/i
  );
  if (m) add('propertyValue', docMoney(m[1]), m[0]);
  m = first(
    /(?:purchase price|price of (?:the )?property|price you(?:'|’)?re paying)[^£\d\n]{0,40}£\s?([\d,]+(?:\.\d{2})?)/i
  );
  if (m) add('purchasePrice', docMoney(m[1]), m[0]);
  m = first(
    /(?:initial monthly payment|monthly payment|first monthly payment|payment of)[^£\d\n]{0,40}£\s?([\d,]+\.\d{2})/i
  );
  if (m) add('monthlyPayment', docMoney(m[1]), m[0]);
  // term
  m = first(
    /(?:mortgage term|loan term|term of (?:the )?(?:loan|mortgage)|term)[^\d\n]{0,30}(\d{1,2})\s*years?(?:\s*(?:and\s*)?(\d{1,2})\s*months?)?/i
  );
  if (m) {
    var yrs = +m[1] + (m[2] ? Math.round((+m[2] / 12) * 100) / 100 : 0);
    if (yrs > 0 && yrs <= 50) add('termYears', yrs, m[0]);
  }
  // rates
  var rl = lines.filter(function (l) {
    return /(\d{1,2}\.\d{1,3})\s?%/.test(l);
  });
  for (var i = 0; i < rl.length; i++) {
    if (
      /initial|fixed|product rate|discount|tracker|introductory/i.test(rl[i]) &&
      !/reversion|variable rate|svr|thereafter/i.test(rl[i])
    ) {
      var rm = rl[i].match(/(\d{1,2}\.\d{1,3})\s?%/);
      add('rate', parseFloat(rm[1]), rl[i]);
      break;
    }
  }
  for (i = 0; i < rl.length; i++) {
    if (
      /reversion|standard variable|\bSVR\b|follow[- ]on|thereafter|after the (?:initial|fixed)/i.test(rl[i])
    ) {
      var fm = rl[i].match(/(\d{1,2}\.\d{1,3})\s?%/);
      add('followOnRate', parseFloat(fm[1]), rl[i]);
      break;
    }
  }
  // dates (a date can sit on the same line as its label or on the next)
  function dateAfter(re) {
    for (var j = 0; j < lines.length; j++) {
      var mm = lines[j].match(re);
      if (!mm) continue;
      var rest = lines[j].slice(mm.index + mm[0].length),
        d = docDate(rest) || docDate(lines[j + 1] || '');
      if (d) return { d: d, s: lines[j] };
    }
    return null;
  }
  var r = dateAfter(
    /(?:initial (?:rate|interest|deal|fixed)(?: rate)? period (?:ends?|ending|until)|(?:deal|rate|fixed(?: rate)?|product) (?:period )?ends?(?: on)?|fixed until)\b/i
  );
  if (r) add('fixedUntil', r.d, r.s);
  if (isDip || !isOffer) {
    r = dateAfter(/(?:date of (?:issue|letter|decision)|issued on|date issued|date)\s*[:\-]?/i);
    if (r && isDip) add('dipDate', r.d, r.s);
    r = dateAfter(/(?:valid until|valid to|expires?(?: on)?|expiry date|expiry)\s*[:\-]?/i);
    if (r && isDip) add('dipExpiry', r.d, r.s);
  }
  if (isOffer) {
    r = dateAfter(/(?:offer date|date of offer|date of issue|date issued|issued on)\s*[:\-]?/i);
    if (r) add('offerDate', r.d, r.s);
    r = dateAfter(
      /(?:offer (?:expires?|expiry|valid until)|valid until|expires?(?: on)?|expiry date)\s*[:\-]?/i
    );
    if (r) add('offerExpiry', r.d, r.s);
  }
  r = dateAfter(/(?:completion date|target completion|date of completion|expected completion)\s*[:\-]?/i);
  if (r) add('completionDate', r.d, r.s);
  if (isDip) {
    m = first(
      /(?:maximum (?:loan|amount|borrowing)|you can borrow up to|we could lend(?: you)?(?: up to)?|up to)[^£\d\n]{0,40}£\s?([\d,]+)/i
    );
    if (m) add('dipAmount', docMoney(m[1]), m[0]);
  }
  // product code and reference (only clearly labelled mortgage references: never a bare account number)
  m = first(/product (?:code|name)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 \-\/\.]{2,40})/i);
  if (m) add('product', m[1].trim(), m[0]);
  m = first(
    /(?:roll number|mortgage account number|application (?:reference|number|ref)|case (?:reference|number)|offer (?:reference|number)|mortgage reference)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{4,19})/i
  );
  if ((m && !/^\d{8}$/.test(m[1])) || (m && /roll|mortgage account/i.test(m[0])))
    add('lenderRef', m[1], m[0]);
  // security address (up to a postcode)
  m = first(
    /(?:security address|property (?:address|being purchased|to be mortgaged|you(?:'|’)?re (?:buying|remortgaging))|address of (?:the )?(?:property|security)|mortgaged property|the property)\s*[:\-]?\s*\n?\s*([^\n]{4,110}?[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i
  );
  if (m) add('propertyAddress', m[1].replace(/\s+/g, ' ').trim(), m[0]);
  // repayment type from a labelled line only
  for (i = 0; i < lines.length; i++) {
    if (/repayment (?:type|method)|type of repayment|how (?:you|will) repay/i.test(lines[i])) {
      var L = lines[i] + ' ' + (lines[i + 1] || '');
      var rv = /part (?:and|&) part|part repayment/i.test(L)
        ? 'part-and-part'
        : /interest[- ]only/i.test(L)
          ? 'interest-only'
          : /capital (?:and|&) interest|repayment/i.test(L.replace(/repayment (?:type|method)/gi, ''))
            ? 'repayment'
            : null;
      if (rv) {
        add('repayment', rv, lines[i]);
        break;
      }
    }
  }
  // early repayment charge: the percentages listed next to it
  for (i = 0; i < lines.length; i++) {
    if (/early repayment charge|\bERC\b/i.test(lines[i])) {
      var seg = lines[i] + ' ' + (lines[i + 1] || ''),
        pc = seg.match(/\d{1,2}(?:\.\d+)?\s?%(?:[^\n%]{0,25}\d{1,2}(?:\.\d+)?\s?%){0,5}/);
      if (pc) {
        /* stepped charges (5% then 4% then 3%) are listed on the lines that follow */
        var steps = [];
        lines.slice(i, i + 9).forEach(function (ln) {
          if (
            /rate|svr|variable|reversion|apr|interest|fee of|£/i.test(
              ln.replace(/early repayment charges?/gi, '')
            )
          )
            return;
          (ln.match(/\b\d{1,2}(?:\.\d)?\s?%/g) || []).forEach(function (x) {
            x = x.replace(/\s+/g, '');
            if (steps.indexOf(x) < 0) steps.push(x);
          });
        });
        add(
          'erc',
          steps.length > 1 && !/%[^%]+%/.test(pc[0]) ? steps.join(' / ') : pc[0].replace(/\s+/g, ' ').trim(),
          lines[i]
        );
        break;
      }
    }
  }
  // deal end date from the early repayment charge section, when the document does not say it in so many words.
  // The charge normally runs to the end of the deal, so "charges apply until 31 March 2029" is the deal end date.
  if (
    !out.some(function (o) {
      return o.k === 'fixedUntil';
    })
  ) {
    var ei = -1;
    for (i = 0; i < lines.length; i++)
      if (/early repayment (?:charge|fee)s?|\bERC\b/i.test(lines[i])) {
        ei = i;
        break;
      }
    if (ei > -1) {
      var win = lines.slice(ei, ei + 12).join('\n'),
        dre =
          /(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{4}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/gi,
        dm,
        best = null,
        dts = [];
      while ((dm = dre.exec(win))) {
        var dd = docDate(dm[0]);
        if (!dd) continue;
        var before = win.slice(Math.max(0, dm.index - 45), dm.index);
        var ls0 = win.lastIndexOf('\n', dm.index) + 1,
          le0 = win.indexOf('\n', dm.index),
          ctx = win.slice(ls0, le0 < 0 ? win.length : le0);
        if (!/charge|\bERC\b|repay|%|appl(?:y|ies)|period|rate|fixed|deal|product/i.test(ctx)) continue;
        if (/offer|valid until|decision|date of|issued/i.test(ctx) && !/charge|\bERC\b|repay/i.test(ctx))
          continue;
        dts.push({ d: dd, s: ctx });
        if (
          /(?:until|up to|to|ends?|ending|expires?|expiry|finish(?:es)?|before|prior to|period of|lasts? until|[-–—])\s*(?:and including\s*)?(?:on\s*)?(?:the\s*)?[:\-]?\s*$/i.test(
            before
          )
        )
          if (!best || dd > best.d) best = { d: dd, s: ctx };
      }
      if (!best && dts.length === 1 && /charge|erc|repay|applies|apply|period/i.test(dts[0].s)) best = dts[0];
      if (best) add('fixedUntil', best.d, 'Early repayment charge section: ' + best.s.replace(/\s+/g, ' '));
      else {
        // "for the first 5 years" with a known completion date
        var yrs = win.match(
          /(?:for|during|over) the (?:first |initial )?(\d{1,2}) years?|(\d{1,2})[- ]year (?:early repayment|ERC|fixed|term|period)/i
        );
        var comp = out.filter(function (o) {
          return o.k === 'completionDate';
        })[0];
        if (yrs && comp && /^\d{4}-\d{2}-\d{2}$/.test(comp.v))
          add(
            'fixedUntil',
            addMonths(comp.v, 12 * +(yrs[1] || yrs[2])),
            'Worked out: ' + (yrs[1] || yrs[2]) + ' years from the completion date (' + yrs[0] + ')'
          );
      }
    }
  }
  // applicants: titled names (or Title / First name / Surname labels), then each person's DOB, email, phone and home address
  var apps = [],
    seenN = {};
  var NM = "[A-Za-z][A-Za-z0-9'’\\-]*",
    TT = '(?:MR|MRS|MS|MISS|MX|DR|PROF)\\.?';
  var nameRe = new RegExp(
    '^(?:(?:applicants?|borrowers?|customers?|clients?|names?)(?:\\s*\\d)?\\s*[:\\-]\\s*)?(' +
      TT +
      '\\s+' +
      NM +
      '(?:\\s+' +
      NM +
      '){0,3}(?:\\s+(?:and|&)\\s+' +
      TT +
      '\\s+' +
      NM +
      '(?:\\s+' +
      NM +
      '){0,3})*)\\s*$',
    'i'
  );
  lines.forEach(function (l) {
    var mm = l.match(nameRe);
    if (!mm) return;
    mm[1].split(new RegExp('\\s+(?:and|&)\\s+(?=' + TT + '\\b)', 'i')).forEach(function (n) {
      n = n.trim();
      var k = n.toLowerCase();
      if (n && !seenN[k] && apps.length < 4) {
        seenN[k] = 1;
        apps.push({ name: n });
      }
    });
  });
  if (!apps.length) {
    var tl = [],
      fl = [],
      sl = [];
    lines.forEach(function (l) {
      var m1 = l.match(/^title\s*[:\-]?\s*(mr|mrs|ms|miss|mx|dr|prof)\b/i),
        m2 = l.match(/^(?:first(?: name)?s?|forenames?)\s*[:\-]\s*(\S.{0,40})$/i),
        m3 = l.match(/^(?:surname|last name|family name)\s*[:\-]\s*(\S.{0,40})$/i);
      if (m1) tl.push(m1[1]);
      if (m2) fl.push(m2[1].trim());
      if (m3) sl.push(m3[1].trim());
    });
    for (var q = 0; q < Math.min(fl.length, sl.length, 4); q++)
      apps.push({
        name: ((tl[q] ? tl[q].toUpperCase() + ' ' : '') + fl[q] + ' ' + sl[q]).replace(/\s+/g, ' ')
      });
  }
  function many(re) {
    var o = [],
      m;
    re = new RegExp(re.source, 'gi');
    while ((m = re.exec(all))) o.push(m);
    return o;
  }
  var dobL = [];
  lines.forEach(function (l, j) {
    if (/date of birth|\bD\.?O\.?B\b/i.test(l)) {
      var d =
        docDate(l.replace(/^.*?(date of birth|DOB)\s*[:\-]?/i, ''), 1) || docDate(lines[j + 1] || '', 1);
      if (d) dobL.push(d);
    }
  });
  var emL = many(/e-?mail(?: address)?\s*[:\-]?\s*([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/).map(
    function (m) {
      return m[1];
    }
  );
  var phL = many(
    /(?:mobile|telephone|phone|tel|contact number)(?: number| no\.?)?\s*[:\-]?\s*((?:\+44\s?|0)\d[\d ]{8,12}\d)/
  ).map(function (m) {
    return m[1].replace(/\s+/g, ' ').trim();
  });
  var adL = many(
    /(?:current address|home address|residential address|correspondence address|your address|address of (?:the )?applicant|applicant(?:'|’)?s address)\s*[:\-]?\s*\n?\s*([^\n]{4,110}?[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/
  ).map(function (m) {
    return m[1].replace(/\s+/g, ' ').trim();
  });
  apps.forEach(function (a, j) {
    if (dobL[j]) a.dob = dobL[j];
    if (emL[j] || (apps.length === 1 && emL[0])) a.email = emL[j] || emL[0];
    if (phL[j] || (apps.length === 1 && phL[0])) a.phone = phL[j] || phL[0];
    if (adL[j] || (apps.length > 1 && adL.length === 1 && j === 0)) a.address = adL[j] || adL[0];
  });
  // property use and case type, from clear wording (check these in the review list)
  var puv = null,
    puw = '';
  if (/buy[- ]to[- ]let|\bBTL\b|let property/i.test(all)) {
    puv = 'btl';
    puw = (all.match(/buy[- ]to[- ]let|\bBTL\b|let property/i) || [''])[0];
  } else if (/second (?:home|residence)/i.test(all)) {
    puv = 'second';
    puw = 'second home';
  } else if (/holiday (?:home|let)/i.test(all)) {
    puv = 'holiday';
    puw = 'holiday home';
  } else if (
    /owner[- ]occup|main residence|residential (?:mortgage|purchase)|your (?:new )?home/i.test(all)
  ) {
    puv = 'main';
    puw = (all.match(
      /owner[- ]occup\w*|main residence|residential (?:mortgage|purchase)|your (?:new )?home/i
    ) || [''])[0];
  }
  if (puv) add('propUse', puv, puw);
  var tyv = null,
    tyw = '';
  [
    [/product transfer|product switch/i, 'Product transfer'],
    [/further advance|additional borrowing/i, 'Further advance'],
    [/re-?mortgage|switching (?:your )?mortgage/i, 'Remortgage'],
    [/first[- ]time buyer|\bFTB\b/i, 'First-time buyer']
  ].some(function (p) {
    var m = all.match(p[0]);
    if (m) {
      tyv = p[1];
      tyw = m[0];
      return true;
    }
  });
  if (!tyv && puv === 'btl') {
    tyv = 'Buy to let';
    tyw = 'buy to let';
  }
  if (
    !tyv &&
    (out.some(function (o) {
      return o.k === 'purchasePrice';
    }) ||
      /\bpurchase\b/i.test(all))
  ) {
    tyv = 'Purchase';
    tyw = 'purchase';
  }
  if (tyv) add('type', tyv, tyw);
  add(
    'stage',
    isOffer ? 'offer' : isDip ? 'dip' : null,
    isOffer ? 'mortgage offer' : 'decision in principle'
  );
  // limited company
  var cn = first(
    /(?:company (?:registration )?(?:number|no\.?)|registered (?:company )?(?:number|no\.?)|companies house (?:number|no\.?))\s*[:\-]?\s*((?:[A-Z]{2})?\d{6,8})\b/i
  );
  if (cn) {
    add('companyNumber', cn[1].toUpperCase(), cn[0]);
    add('borrowerType', 'spv', 'Company number found');
    var cm =
      first(
        /(?:company name|borrower|limited company|name of company)\s*[:\-]\s*([^\n]{3,80}?(?:limited|ltd\.?|llp|plc))\b/i
      ) || first(/^([A-Z][^\n]{2,70}?\s(?:limited|ltd\.?|llp|plc))\s*$/im);
    if (cm) add('companyName', cm[1].trim(), cm[0]);
  }
  // conveyancer and estate agent (kept in the note, there is no field for them)
  var cv = first(/(?:conveyancer|solicitor|legal representative)s?\s*[:\-]\s*([^\n]{3,80})/i),
    ea = first(/(?:estate agent|selling agent)\s*[:\-]\s*([^\n]{3,80})/i);
  var kd = [];
  function kdate(k, l) {
    var it = out.filter(function (o) {
      return o.k === k;
    })[0];
    if (it) kd.push(l + ' ' + fd(it.v));
  }
  kdate('dipDate', 'AIP date');
  kdate('dipExpiry', 'AIP expires');
  kdate('offerDate', 'Offer date');
  kdate('offerExpiry', 'Offer expires');
  kdate('completionDate', 'Completion date');
  if (cv) kd.push('Conveyancer: ' + cv[1].trim());
  if (ea) kd.push('Estate agent: ' + ea[1].trim());
  var kind = isOffer ? 'mortgage offer' : isDip ? 'decision in principle' : 'document';
  var noteText = kd.length ? 'From the ' + kind + ': ' + kd.join('; ') + '.' : '';
  // what we deliberately ignore
  var skipped = [];
  if (
    /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/.test(flat) ||
    /national insurance/i.test(flat)
  )
    skipped.push('National Insurance numbers');
  if (/sort code|account number|iban/i.test(flat)) skipped.push('bank details');
  if (/passport|driving licen[cs]e|share code|\bUTR\b/i.test(flat)) skipped.push('ID details');
  if (/salary|income|expenditure|outgoings|health|smok/i.test(flat))
    skipped.push('income, spending or health answers');
  return {
    items: out,
    kind: kind,
    skipped: skipped,
    applicants: apps,
    isOffer: isOffer,
    isDip: isDip,
    noteText: noteText
  };
}

var DOC_FIELDS = {
  lender: ['Lender name', 'text'],
  loanAmount: ['Loan amount', 'gbp'],
  propertyValue: ['Valuation', 'gbp'],
  purchasePrice: ['Purchase price', 'gbp'],
  monthlyPayment: ['Monthly payment', 'gbp'],
  termYears: ['Initial term (years)', 'num'],
  rate: ['Initial rate (%)', 'pct'],
  followOnRate: ['Rate after (%)', 'pct'],
  fixedUntil: ['Initial deal ends', 'date'],
  dipDate: ['AIP date', 'date'],
  dipExpiry: ['AIP expires', 'date'],
  dipAmount: ['AIP amount', 'gbp'],
  offerDate: ['Offer date', 'date'],
  offerExpiry: ['Offer expires', 'date'],
  completionDate: ['Completion date', 'date'],
  product: ['Product code', 'text'],
  lenderRef: ['Lender reference', 'text'],
  propertyAddress: ['Property address', 'text'],
  repayment: ['Repayment method', 'rep'],
  erc: ['Early repayment charge', 'text'],
  propUse: ['Property type', 'pu'],
  type: ['Case type', 'text'],
  stage: ['Stage', 'stage'],
  borrowerType: ['Applying as', 'bt'],
  companyName: ['Company name', 'text'],
  companyNumber: ['Company number', 'text']
};
var DOC_ORDER = [
  'lender',
  'propertyAddress',
  'loanAmount',
  'propertyValue',
  'purchasePrice',
  'termYears',
  'repayment',
  'rate',
  'fixedUntil',
  'followOnRate',
  'monthlyPayment',
  'product',
  'lenderRef',
  'erc',
  'dipDate',
  'dipExpiry',
  'dipAmount',
  'offerDate',
  'offerExpiry',
  'completionDate',
  'type',
  'propUse',
  'stage',
  'borrowerType',
  'companyNumber',
  'companyName'
];
function docShow(k, v) {
  var f = DOC_FIELDS[k] || [k, 'text'];
  if (v == null || v === '') return '';
  if (f[1] === 'pu')
    return (PROP_TYPES.filter(function (p) {
      return p[0] === v;
    })[0] || [0, v])[1];
  if (f[1] === 'stage')
    return { dip: 'AIP', offer: 'Offered', enquiry: 'Enquiry', application: 'FMA' }[v] || v;
  if (f[1] === 'bt') return v === 'spv' ? 'Limited company (SPV)' : 'Personal';
  if (f[1] === 'gbp') return '£' + Number(v).toLocaleString('en-GB');
  if (f[1] === 'pct') return v + '%';
  if (f[1] === 'date') return fd(v);
  if (f[1] === 'rep')
    return (
      { 'repayment': 'Repayment', 'interest-only': 'Interest only', 'part-and-part': 'Part and part' }[v] || v
    );
  return String(v);
}

/* ---------- reading the PDF text (one line per row of the page) ---------- */
function docLoadPdfjs() {
  return dxLoad('/lib/pdfjs/load.mjs', true);
}
function pdfText(file) {
  return file
    .arrayBuffer()
    .then(function (buf) {
      return window.pdfjsLib.getDocument({ data: new Uint8Array(buf), wasmUrl: PDFJS_WASM }).promise;
    })
    .then(function (pdf) {
      var out = '',
        chain = Promise.resolve();
      for (var i = 1; i <= Math.min(pdf.numPages, 40); i++)
        (function (n) {
          chain = chain
            .then(function () {
              return pdf.getPage(n);
            })
            .then(function (pg) {
              return pg.getTextContent();
            })
            .then(function (tc) {
              var last = null,
                line = '';
              tc.items.forEach(function (it) {
                var y = it.transform[5];
                if (last !== null && Math.abs(y - last) > 2) {
                  out += line + '\n';
                  line = '';
                }
                line += it.str + ' ';
                last = y;
              });
              out += line + '\n';
            });
        })(i);
      return chain.then(function () {
        return out;
      });
    });
}
/* the text of one or more PDFs; a scanned PDF has no text and is refused with a clear message */
function docTexts(files) {
  return docLoadPdfjs().then(function () {
    var texts = [];
    return files
      .reduce(function (ch, f) {
        return ch
          .then(function () {
            return pdfText(f);
          })
          .then(function (tx) {
            if (tx.replace(/\s/g, '').length < 60)
              throw new Error(f.name + ' has no readable text. Scanned documents cannot be read.');
            texts.push(tx);
          });
      }, Promise.resolve())
      .then(function () {
        return texts.join('\n');
      });
  });
}
function docChoose(then) {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/pdf,.pdf';
  inp.multiple = true;
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', function () {
    var fs = [].slice.call(inp.files || []);
    inp.remove();
    if (fs.length) then(fs);
  });
  inp.click();
}
/* an open case: read the document, then list what was found for the adviser to tick */
function docPick() {
  if (!openId) {
    toast('Open a case first');
    return;
  }
  docChoose(docRead);
}
function docRead(files) {
  var caseId = openId;
  toast('Reading ' + (files.length > 1 ? files.length + ' documents' : files[0].name) + '…', true);
  docTexts(files)
    .then(function (text) {
      $('#toast').hidden = true;
      if (openId !== caseId) {
        toast('The case was closed, so nothing was changed');
        return;
      }
      var res = docExtract(text),
        here = currentCase(),
        mine = docCandidates(res.applicants, '').filter(function (k) {
          return here && k.c.id === here.id;
        }).length,
        other = docCandidates(res.applicants, '').filter(function (k) {
          return !here || k.c.id !== here.id;
        })[0];
      /* the document names someone else (name and date of birth) and nobody on this case */
      if (!mine && other && other.dobHit && res.applicants.length) {
        var oc = other.c;
        docAsk(
          'This looks like a different client',
          "The document's name and date of birth match <b>" +
            esc(names(oc)) +
            (oc.clientNo ? ' (' + esc(oc.clientNo) + ')' : '') +
            '</b>, not the case you have open.',
          [
            {
              pri: true,
              label: '<b>Open ' + esc(names(oc)) + ' and use the document there</b>',
              go: function () {
                openDrawer(oc.id);
                setTimeout(function () {
                  docReview(res, files);
                }, 350);
              }
            },
            {
              label: '<b>Use it on this case anyway</b>',
              go: function () {
                docReview(res, files);
              }
            },
            { label: 'Cancel', go: null }
          ]
        );
        return;
      }
      docReview(res, files);
    })
    .catch(function (e) {
      toast((e && e.message) || 'Could not read the document', false);
    });
}
/* a new client straight from the document: the case is created and saved, then opened to check */
function importPdfs(files) {
  if (!col) {
    toast('Saving is not available yet. Try again in a moment.');
    return;
  }
  toast('Reading ' + (files.length > 1 ? files.length + ' documents' : files[0].name) + '…', true);
  docTexts(files)
    .then(function (text) {
      var r = docExtract(text),
        d = {};
      r.items.forEach(function (it) {
        d[it.k] = it.v;
      });
      ['dipDate', 'dipExpiry', 'dipAmount', 'offerDate', 'offerExpiry', 'completionDate'].forEach(
        function (k) {
          delete d[k];
        }
      );
      if (!r.items.length && !r.applicants.length) {
        $('#toast').hidden = true;
        toast(
          'Nothing could be found that matches a case. This works on text-based lender documents such as a decision in principle or a mortgage offer.'
        );
        return;
      }
      d.applicants = r.applicants.length ? r.applicants : [{}];
      if (d.borrowerType !== 'spv') d.borrowerType = 'personal';
      if (!d.stage) d.stage = 'enquiry';
      if (!d.type) d.type = d.purchasePrice ? 'Purchase' : 'Remortgage';
      d.repayment = d.repayment || 'repayment';
      d.notes = [
        {
          ts: Date.now(),
          text:
            'Created from PDF: ' +
            files
              .map(function (f) {
                return f.name;
              })
              .join(', ') +
            '.' +
            (r.noteText ? ' ' + r.noteText : '')
        }
      ];
      $('#toast').hidden = true;
      var cands = docCandidates(d.applicants, d.propertyAddress);
      if (!cands.length) return docCreate(d);
      docChooseClient(d, cands, files, r);
    })
    .catch(function (e) {
      toast((e && e.message) || 'Could not read the PDFs', false);
    });
}

/* ---------- does the document belong to someone who is already here? (name, date of birth, address) ---------- */
function docCandidates(aps, propAddr) {
  var out = [];
  cases.forEach(function (c) {
    if (trOf(c) !== T.id) return;
    var hit = 0,
      conflict = false,
      dobHit = false,
      addrHit = false;
    (aps || []).forEach(function (ap) {
      if (!ap || !ap.name) return;
      (c.applicants || []).forEach(function (x) {
        if (!docSameName(x.name, ap.name)) return;
        var d1 = String(ap.dob || '').slice(0, 10),
          d2 = String(x.dob || '').slice(0, 10);
        if (d1 && d2 && d1 !== d2) {
          conflict = true;
          return;
        }
        hit++;
        if (d1 && d1 === d2) dobHit = true;
        if (
          ap.address &&
          x.address &&
          dupAddr({ propertyAddress: ap.address }) === dupAddr({ propertyAddress: x.address })
        )
          addrHit = true;
      });
    });
    if (!hit || (conflict && !dobHit)) return;
    var sameProp = !!(propAddr && c.propertyAddress && dupAddr({ propertyAddress: propAddr }) === dupAddr(c));
    out.push({
      c: c,
      score: hit * 2 + (dobHit ? 3 : 0) + (addrHit ? 2 : 0) + (sameProp ? 4 : 0),
      sameProp: sameProp,
      dobHit: dobHit
    });
  });
  return out
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .slice(0, 4);
}
function docAsk(title, body, buttons) {
  var old = document.getElementById('docAsk');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'docAsk';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:295;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div role="dialog" aria-modal="true" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:12px;padding:20px 22px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:14px/1.45 system-ui,sans-serif"><h2 style="margin:0 0 8px;font-size:20px">' +
    esc(title) +
    '</h2><div style="margin:0 0 14px">' +
    body +
    '</div><div style="display:flex;flex-direction:column;gap:8px">' +
    buttons
      .map(function (b, i) {
        return (
          '<button type="button" class="btn' +
          (b.pri ? '' : ' ghost') +
          '" data-dk="' +
          i +
          '" style="text-align:left;white-space:normal">' +
          b.label +
          '</button>'
        );
      })
      .join('') +
    '</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-dk]');
    if (!b) {
      if (e.target === ov) ov.remove();
      return;
    }
    ov.remove();
    var f = buttons[+b.getAttribute('data-dk')].go;
    if (f) f();
  });
}
function docCreate(d) {
  openDrawer(null, d);
  newBase = '';
  setTimeout(autoSave, 300);
  toast('Case created from the document and saved. Check every detail before relying on it.');
}
/* the document matches someone already here: update them, add a second property, or really make a new client */
function docChooseClient(d, cands, files, r) {
  var btns = [];
  cands.forEach(function (k) {
    var c = k.c,
      who = esc(names(c)) + (c.clientNo ? ' (' + esc(c.clientNo) + ')' : '');
    var why =
      (k.dobHit ? 'name and date of birth match' : 'name matches') +
      (k.sameProp ? ', same property' : c.propertyAddress ? ', property: ' + esc(c.propertyAddress) : '');
    btns.push({
      pri: btns.length === 0,
      label:
        '<b>Add to ' +
        who +
        '</b><br><span style="font-size:12.5px;opacity:.8">' +
        why +
        '. The details found are listed for you to tick.</span>',
      go: function () {
        openDrawer(c.id);
        setTimeout(function () {
          docReview(r, files);
        }, 350);
      }
    });
    if (!k.sameProp)
      btns.push({
        label:
          '<b>New case for ' +
          who +
          '</b><br><span style="font-size:12.5px;opacity:.8">A second property for the same client: keeps their details and client number.</span>',
        go: function () {
          var nd = JSON.parse(JSON.stringify(d));
          nd.applicants = (c.applicants || []).map(function (x) {
            var m = (d.applicants || []).filter(function (a) {
              return docSameName(a.name, x.name);
            })[0];
            return Object.assign(
              {},
              x,
              m ? { dob: x.dob || m.dob, phone: x.phone || m.phone, email: x.email || m.email } : {}
            );
          });
          (d.applicants || []).forEach(function (a) {
            if (
              a.name &&
              !nd.applicants.some(function (x) {
                return docSameName(x.name, a.name);
              })
            )
              nd.applicants.push(a);
          });
          if (c.clientNo) nd.clientNo = c.clientNo;
          docCreate(nd);
        }
      });
  });
  btns.push({
    label:
      '<b>Create a new client anyway</b><br><span style="font-size:12.5px;opacity:.8">This is a different person.</span>',
    go: function () {
      docCreate(d);
    }
  });
  btns.push({ label: 'Cancel', go: null });
  docAsk(
    'This client may already be here',
    'The document names someone who matches a client you already have. Choose what to do, so you do not end up with the same client twice.',
    btns
  );
}

function docNorm(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/^(?:(?:mr|mrs|ms|miss|mx|dr|prof)\.?\s+)+/, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function docSameName(a, b) {
  a = docNorm(a);
  b = docNorm(b);
  if (!a || !b) return false;
  if (a === b) return true;
  var x = a.split(' '),
    y = b.split(' ');
  return x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
}
function docSet(el, v) {
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function docReview(res, files) {
  var old = document.getElementById('docOv');
  if (old) old.remove();
  var items = [],
    sorted = res.items.slice().sort(function (a, b) {
      return DOC_ORDER.indexOf(a.k) - DOC_ORDER.indexOf(b.k);
    });
  sorted.forEach(function (it) {
    var el = document.getElementById('f-' + it.k);
    if (!el) return;
    var f = DOC_FIELDS[it.k] || [it.k, 'text'],
      cur = el.value,
      same = String(cur) === String(it.v),
      cs =
        cur === ''
          ? ''
          : f[1] === 'gbp' || f[1] === 'pct'
            ? docShow(it.k, Number(cur))
            : f[1] === 'text'
              ? cur
              : docShow(it.k, cur);
    items.push({
      label: f[0],
      show: docShow(it.k, it.v),
      cur: cur,
      curShow: cs,
      same: same,
      src: it.src,
      apply: function () {
        docSet(el, it.v);
      }
    });
  });
  var rowsNow = [].slice.call(document.querySelectorAll('#apps .app')),
    gv = function (r, k) {
      var e = r.querySelector('[data-a="' + k + '"]');
      return e ? e.value.trim() : '';
    };
  var AK = [
    ['dob', 'Date of birth', 'date'],
    ['phone', 'Phone', 'text'],
    ['email', 'Email', 'text'],
    ['address', 'Current address', 'text']
  ];
  res.applicants.forEach(function (ap, ai) {
    var m = rowsNow.filter(function (r) {
      return docSameName(gv(r, 'name'), ap.name);
    })[0];
    if (!m && rowsNow.length === 1 && !gv(rowsNow[0], 'name')) m = rowsNow[0];
    var who = 'Applicant ' + (ai + 1) + ' (' + ap.name + ')';
    if (m) {
      if (!gv(m, 'name'))
        items.push({
          label: who + ': Name',
          show: ap.name,
          cur: '',
          curShow: '',
          same: false,
          src: 'Name in the document',
          apply: function () {
            docSet(m.querySelector('[data-a="name"]'), ap.name);
          }
        });
      AK.forEach(function (k) {
        if (!ap[k[0]]) return;
        var e = m.querySelector('[data-a="' + k[0] + '"]');
        if (!e) return;
        var cur = e.value.trim();
        items.push({
          label: who + ': ' + k[1],
          show: k[2] === 'date' ? fd(ap[k[0]]) : ap[k[0]],
          cur: cur,
          curShow: k[2] === 'date' && cur ? fd(cur) : cur,
          same: cur === ap[k[0]],
          src: 'Found in the document',
          apply: function () {
            docSet(e, ap[k[0]]);
          }
        });
      });
    } else {
      var sum = [ap.dob ? 'born ' + fd(ap.dob) : '', ap.phone, ap.email, ap.address]
        .filter(Boolean)
        .join(' · ');
      items.push({
        label:
          'Add ' +
          (isSpv({ borrowerType: (document.getElementById('f-borrowerType') || {}).value })
            ? 'director'
            : 'applicant') +
          ': ' +
          ap.name,
        show: sum || '(name only)',
        cur: '',
        curShow: '',
        same: false,
        src: 'Not on this case yet',
        apply: function () {
          var rs = [].slice.call(document.querySelectorAll('#apps .app')),
            blank = rs.filter(function (r) {
              return (
                !gv(r, 'name') && !gv(r, 'email') && !gv(r, 'phone') && !gv(r, 'address') && !gv(r, 'dob')
              );
            })[0];
          if (!blank) {
            var ab = document.getElementById('addApp');
            if (ab) ab.click();
            rs = [].slice.call(document.querySelectorAll('#apps .app'));
            blank = rs[rs.length - 1];
          }
          if (!blank) return;
          docSet(blank.querySelector('[data-a="name"]'), ap.name);
          AK.forEach(function (k) {
            if (ap[k[0]]) {
              var e = blank.querySelector('[data-a="' + k[0] + '"]');
              if (e) docSet(e, ap[k[0]]);
            }
          });
        }
      });
    }
  });
  if (res.noteText && openId) {
    var nid = openId;
    items.push({
      label: 'Add a note to the case',
      show: res.noteText,
      cur: '',
      curShow: '',
      same: false,
      src: 'Key dates and contacts (there is no field for them)',
      apply: function () {
        var c4 = currentCase();
        if (c4 && c4.id === nid)
          patch(nid, { notes: (c4.notes || []).concat([{ ts: Date.now(), text: res.noteText }]) });
      }
    });
  }
  var ov = document.createElement('div');
  ov.id = 'docOv';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:290;background:rgba(8,14,18,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  var rows = items
    .map(function (it, i) {
      return (
        '<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--line,#E5EAED);cursor:pointer"><input type="checkbox" data-doci="' +
        i +
        '" ' +
        (it.cur === '' || it.same ? 'checked' : '') +
        (it.same ? ' disabled' : '') +
        ' style="margin-top:3px"><span style="flex:1;min-width:0"><b>' +
        esc(it.label) +
        '</b><br><span>' +
        esc(it.show) +
        '</span>' +
        (it.cur !== '' && !it.same
          ? ' <span class="muted" style="font-size:12px">· replaces "' + esc(it.curShow) + '"</span>'
          : '') +
        (it.same ? ' <span class="muted" style="font-size:12px">· already the same</span>' : '') +
        '<br><span class="muted" style="font-size:12px">From: ' +
        esc(it.src) +
        '</span></span></label>'
      );
    })
    .join('');
  ov.innerHTML =
    '<div role="dialog" aria-modal="true" aria-label="Details found in the document" style="background:var(--surface,#fff);color:var(--ink,#101C26);width:min(680px,100%);max-height:88vh;display:flex;flex-direction:column;border-radius:12px;padding:20px 22px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:14px system-ui,sans-serif">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h2 style="margin:0;font-size:20px">Details found</h2><button type="button" class="btn ghost" id="docX">Cancel</button></div>' +
    '<div class="muted" style="font-size:13px;margin-bottom:10px">Looks like a ' +
    esc(res.kind) +
    ' (' +
    esc(
      files
        .map(function (f) {
          return f.name;
        })
        .join(', ')
    ) +
    '). Tick what you want on this case. Please check each one against the document. The document itself is not saved.</div>' +
    (res.skipped.length
      ? '<div style="font-size:13px;margin-bottom:10px;padding:8px 10px;border-radius:8px;background:#EEF3F6">Ignored on purpose: ' +
        esc(res.skipped.join(', ')) +
        '.</div>'
      : '') +
    (items.length
      ? '<div style="overflow:auto;border:1px solid var(--line,#D4DBDF);border-radius:8px">' + rows + '</div>'
      : '<div style="padding:14px;border:1px solid var(--line,#D4DBDF);border-radius:8px">Nothing could be found that matches the case. This reader works on text-based lender documents such as a decision in principle or a mortgage offer.</div>') +
    (items.length
      ? '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button type="button" class="btn" id="docGo">Fill in ticked details</button></div>'
      : '') +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function (e) {
    if (e.target === ov) ov.remove();
  });
  ov.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.id === 'docX') {
      ov.remove();
      return;
    }
    if (b.id === 'docGo') {
      var n = 0;
      ov.querySelectorAll('[data-doci]').forEach(function (x) {
        if (!x.checked || x.disabled) return;
        var it = items[+x.getAttribute('data-doci')];
        if (!it) return;
        try {
          it.apply();
          n++;
        } catch (er) {}
      });
      ov.remove();
      toast(
        n
          ? 'Filled in ' + n + ' detail' + (n === 1 ? '' : 's') + '. Check them before relying on them.'
          : 'Nothing was changed'
      );
    }
  });
}
