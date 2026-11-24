'use strict';
/* MySimpleDesk app: My tradesmen, and import from Excel or CSV.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- My tradesmen (home owners and landlords): preferred tradespeople, name and phone only ---------- */
var tmItems = [],
  tmEdit = null;
function tmIntl(p) {
  var w = String(p || '').replace(/[^\d+]/g, '');
  return w.charAt(0) === '+' ? w.slice(1) : w.charAt(0) === '0' ? '44' + w.slice(1) : w;
}
function tmSave(items) {
  tmItems = items;
  if (setCol)
    write('set-tradesmen', function () {
      return setCol.doc('tradesmen').set({ items: items, updatedAt: Date.now() });
    });
  if (view === 'tradesmen') render();
}
function tmHTML() {
  var l = tmItems.slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    }),
    ed = tmEdit
      ? tmItems.filter(function (x) {
          return x.id === tmEdit;
        })[0]
      : null;
  if (!ed) tmEdit = null;
  return (
    '<div class="pagehead"><h1>My tradesmen</h1><span class="muted">' +
    l.length +
    ' saved</span></div>' +
    '<div class="tmpage"><p class="muted" style="margin:0 0 12px">Keep the name and phone number of the tradespeople you trust, so they are to hand when something needs fixing.</p>' +
    '<form id="tmForm" class="tmadd" novalidate><label class="f">Name<input id="tm-name" maxlength="80" autocomplete="off" placeholder="For example: Sam the plumber" value="' +
    esc(ed ? ed.name : '') +
    '"></label>' +
    '<label class="f">Phone number<input id="tm-phone" type="tel" inputmode="tel" maxlength="30" autocomplete="off" placeholder="For example: 07700 900123" value="' +
    esc(ed ? ed.phone : '') +
    '"></label>' +
    '<div class="add" style="margin:0;align-self:end"><button type="submit" class="btn">' +
    (ed ? 'Save changes' : 'Add tradesman') +
    '</button>' +
    (ed ? '<button type="button" class="btn ghost" data-tmcancel="1">Cancel</button>' : '') +
    '</div></form>' +
    '<p id="tmMsg" role="alert" class="tmmsg"></p>' +
    (l.length
      ? '<ul class="tmlist">' +
        l
          .map(function (x) {
            var d = String(x.phone || '').replace(/[^\d+]/g, ''),
              ok = d.replace(/\D/g, '').length >= 7;
            return (
              '<li><div class="tmwho"><b>' +
              esc(x.name) +
              '</b><span>' +
              esc(x.phone || '') +
              '</span></div><div class="tmact">' +
              (ok
                ? '<a class="btn sm" href="tel:' +
                  esc(d) +
                  '">Call</a><a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/' +
                  esc(tmIntl(x.phone)) +
                  '">WhatsApp</a>'
                : '') +
              '<button type="button" class="btn ghost sm" data-tmedit="' +
              esc(x.id) +
              '">Edit</button><button type="button" class="btn ghost sm danger" data-tmdel="' +
              esc(x.id) +
              '">Delete</button></div></li>'
            );
          })
          .join('') +
        '</ul>'
      : '<div class="empty"><h2>No tradesmen saved yet</h2>Add your plumber, electrician, gas engineer or handyman above.</div>') +
    '</div>'
  );
}
document.addEventListener('submit', function (e) {
  if (!e.target || e.target.id !== 'tmForm') return;
  e.preventDefault();
  var nm = ($('#tm-name').value || '').trim(),
    ph = ($('#tm-phone').value || '').trim(),
    msg = $('#tmMsg');
  if (!nm) {
    msg.textContent = 'Add a name.';
    $('#tm-name').focus();
    return;
  }
  if (ph.replace(/\D/g, '').length < 7) {
    msg.textContent = ph ? 'That does not look like a phone number.' : 'Add a phone number.';
    $('#tm-phone').focus();
    return;
  }
  var items = tmEdit
    ? tmItems.map(function (x) {
        return x.id === tmEdit ? Object.assign({}, x, { name: nm, phone: ph }) : x;
      })
    : tmItems.concat([{ id: 'tm' + uid(), name: nm, phone: ph }]);
  var was = tmEdit;
  tmEdit = null;
  tmSave(items);
  toast(was ? 'Saved' : 'Tradesman added');
});
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var b;
  if ((b = t.closest('[data-tmedit]'))) {
    tmEdit = b.getAttribute('data-tmedit');
    render();
    var f = $('#tm-name');
    if (f) f.focus();
    return;
  }
  if (t.closest('[data-tmcancel]')) {
    tmEdit = null;
    render();
    return;
  }
  if ((b = t.closest('[data-tmdel]'))) {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Delete?';
      return;
    }
    var id = b.getAttribute('data-tmdel');
    if (tmEdit === id) tmEdit = null;
    tmSave(
      tmItems.filter(function (x) {
        return x.id !== id;
      })
    );
    toast('Deleted');
  }
});
/* ---------- import from Excel (.xlsx) or CSV ---------- */
var imRows = [],
  imHead = [],
  imMap = [],
  imName = '',
  imSheet = '',
  imBusy = false,
  imFill = false;
var IM_TRADE = {
  landlord: {
    noun: 'propert',
    one: 'property',
    many: 'properties',
    fields: [
      [
        'addr',
        'Property address (line one)',
        [
          'address',
          'propertyaddress',
          'addressline1',
          'address1',
          'property',
          'street',
          'propertyaddressline1'
        ]
      ],
      ['pc', 'Postcode', ['postcode', 'postalcode', 'zip', 'zipcode']],
      ['type', 'Property type', ['propertytype', 'type']],
      ['beds', 'Bedrooms', ['bedrooms', 'beds', 'bedroom']],
      ['agent', 'Letting agent', ['lettingagent', 'agent']],
      ['tname', 'Tenant name', ['tenant', 'tenantname', 'tenants', 'tenantsname', 'name', 'customer']],
      [
        'tphone',
        'Tenant phone',
        ['tenantphone', 'phone', 'mobile', 'telephone', 'tel', 'tenantmobile', 'phonenumber', 'mobilenumber']
      ],
      ['temail', 'Tenant email', ['tenantemail', 'email', 'emailaddress']],
      ['rent', 'Rent', ['rent', 'monthlyrent', 'rentamount', 'rentpcm', 'rentpm']],
      ['rfreq', 'Rent paid (monthly, weekly)', ['rentfrequency', 'frequency', 'rentperiod', 'rentpaid']],
      ['rday', 'Rent due day (1 to 31)', ['rentday', 'rentdueday', 'dueday', 'rentdue']],
      [
        'tstart',
        'Tenancy start date',
        ['tenancystart', 'tenancystartdate', 'startdate', 'tenancystarted', 'start']
      ],
      ['deposit', 'Deposit', ['deposit', 'depositamount']],
      [
        'gsr',
        'Gas safety record date',
        ['gassafety', 'gassafetydate', 'gsr', 'cp12', 'gassafetyrecord', 'gassafetycertificate']
      ],
      ['eicr', 'EICR date', ['eicr', 'eicrdate', 'electrical', 'electricalreport', 'electricalsafety']],
      ['epcr', 'EPC rating', ['epcrating', 'epc']],
      ['epcd', 'EPC issued date', ['epcdate', 'epcissued', 'epcissuedate']],
      [
        'ins',
        'Insurance renewal date',
        ['insurancerenewal', 'insurance', 'insurancerenewaldate', 'landlordinsurance']
      ]
    ],
    req: ['addr'],
    reqL: 'a property address'
  },
  gas: {
    noun: 'job',
    one: 'job',
    many: 'jobs',
    fields: [
      ['name', 'Customer name', ['customer', 'customername', 'name', 'client', 'clientname', 'fullname']],
      [
        'phone',
        'Phone',
        ['phone', 'mobile', 'telephone', 'tel', 'phonenumber', 'mobilenumber', 'customerphone']
      ],
      ['email', 'Email', ['email', 'emailaddress', 'customeremail']],
      ['addr', 'Job address', ['address', 'jobaddress', 'siteaddress', 'property', 'street', 'addressline1']],
      ['pc', 'Postcode', ['postcode', 'postalcode', 'zip']],
      ['type', 'Job type', ['jobtype', 'type', 'service', 'work']],
      ['appliance', 'Boiler or appliance', ['appliance', 'boiler', 'makeandmodel', 'boilermodel', 'model']],
      ['last', 'Last service date', ['lastservice', 'lastserviced', 'servicedate', 'lastservicedate']],
      ['next', 'Next service due', ['nextservice', 'nextservicedue', 'servicedue', 'duedate']],
      ['gsr', 'Gas safety record date', ['gassafety', 'gsr', 'cp12', 'gassafetyrecord', 'gassafetydate']],
      ['quote', 'Quote or price', ['quote', 'price', 'amount', 'cost', 'quoted']]
    ],
    req: ['name', 'addr'],
    reqL: 'a customer name or an address',
    any: 1
  },
  accountant: {
    noun: 'client',
    one: 'client',
    many: 'clients',
    fields: [
      [
        'name',
        'Client or contact name',
        ['name', 'client', 'clientname', 'contact', 'contactname', 'fullname', 'customer']
      ],
      ['phone', 'Phone', ['phone', 'mobile', 'telephone', 'tel', 'phonenumber', 'mobilenumber']],
      ['email', 'Email', ['email', 'emailaddress']],
      [
        'biz',
        'Business or trading name',
        ['business', 'businessname', 'tradingname', 'trading', 'company', 'companyname']
      ],
      [
        'btype',
        'Business type (sole trader, limited company…)',
        ['businesstype', 'clienttype', 'entitytype', 'structure']
      ],
      ['type', 'Main service', ['service', 'mainservice', 'servicetype', 'type', 'work']],
      ['fee', 'Annual fee', ['fee', 'annualfee', 'fees', 'price']],
      [
        'fbasis',
        'Billed (monthly, quarterly, annually)',
        ['billed', 'billing', 'feebasis', 'billingfrequency']
      ],
      ['yend', 'Accounting year end', ['yearend', 'accountingyearend', 'ye', 'yearenddate']],
      ['sadue', 'Self Assessment due date', ['sadue', 'selfassessmentdue', 'taxreturndue', 'sa']],
      ['nature', 'What the business does', ['nature', 'natureofbusiness', 'activity', 'whatthebusinessdoes']],
      [
        'start',
        'Trading started on',
        ['tradingstart', 'tradingstarted', 'startdate', 'commenced', 'started']
      ],
      ['basis', 'Accounting basis (cash or accruals)', ['basis', 'accountingbasis', 'cashbasis']],
      ['turn', 'Turnover, latest year', ['turnover', 'sales', 'income', 'revenue']],
      ['vat', 'VAT registered (yes or no)', ['vat', 'vatregistered']],
      ['vatno', 'VAT number', ['vatnumber', 'vatno', 'vatreg']]
    ],
    req: ['name', 'biz'],
    reqL: 'a client name or a business name',
    any: 1
  }
};
/* the mortgage adviser's import: the columns other mortgage apps and spreadsheets usually have (the fourth item is the example in the sample file) */
IM_TRADE.mortgage = {
  noun: 'case',
  one: 'case',
  many: 'cases',
  fields: [
    [
      'cno',
      'Client number',
      ['clientno', 'clientnumber', 'clientid', 'caseno', 'casenumber', 'accountno'],
      'C101'
    ],
    [
      'name',
      'Applicant 1 name',
      [
        'name',
        'fullname',
        'client',
        'clientname',
        'clients',
        'clientnames',
        'customer',
        'customername',
        'applicant',
        'applicant1',
        'applicant1name',
        'borrower',
        'borrowername',
        'firstapplicant'
      ],
      'MR TEST PERSON1'
    ],
    ['fn', 'First name (if separate)', ['firstname', 'forename', 'forenames', 'givenname'], ''],
    ['sn', 'Surname (if separate)', ['surname', 'lastname', 'familyname'], ''],
    ['dob', 'Applicant 1 date of birth', ['dob', 'dateofbirth', 'birthdate', 'applicant1dob'], '01/02/1980'],
    [
      'phone',
      'Applicant 1 phone',
      ['phone', 'mobile', 'telephone', 'tel', 'phonenumber', 'mobilenumber', 'applicant1phone'],
      '07000000001'
    ],
    ['email', 'Applicant 1 email', ['email', 'emailaddress', 'applicant1email'], 'test.person1@example.com'],
    [
      'address',
      'Applicant 1 current address',
      ['address', 'homeaddress', 'currentaddress', 'residentialaddress', 'correspondenceaddress'],
      '5 Old Street, AB1 2CD'
    ],
    [
      'name2',
      'Applicant 2 name',
      [
        'applicant2',
        'applicant2name',
        'secondapplicant',
        'jointapplicant',
        'jointname',
        'partner',
        'partnername',
        'coapplicant',
        'name2',
        'secondname'
      ],
      ''
    ],
    [
      'dob2',
      'Applicant 2 date of birth',
      [
        'partnerdob',
        'partnerdateofbirth',
        'applicant2dateofbirth',
        'coapplicantdob',
        'jointdob',
        'dob2',
        'applicant2dob',
        'secondapplicantdob'
      ],
      ''
    ],
    [
      'phone2',
      'Applicant 2 phone',
      ['partnerphone', 'partnermobile', 'phone2', 'applicant2phone', 'mobile2'],
      ''
    ],
    ['email2', 'Applicant 2 email', ['partneremail', 'email2', 'applicant2email'], ''],
    [
      'addr',
      'Property address (the security)',
      [
        'propertyaddress',
        'securityaddress',
        'security',
        'securityproperty',
        'mortgagedproperty',
        'purchaseaddress',
        'newaddress',
        'property'
      ],
      '22 Demo Lane, AB3 4EF'
    ],
    ['lender', 'Lender', ['lender', 'lendername', 'mortgagelender', 'bank', 'provider'], 'Nationwide'],
    [
      'loan',
      'Loan amount',
      ['loan', 'loanamount', 'mortgageamount', 'borrowing', 'advance', 'amountborrowed'],
      '200000'
    ],
    ['value', 'Property value', ['propertyvalue', 'valuation', 'estimatedvalue', 'value'], '250000'],
    ['price', 'Purchase price', ['purchaseprice', 'price'], ''],
    ['rate', 'Initial rate (%)', ['rate', 'initialrate', 'interestrate', 'productrate', 'fixedrate'], '4.29'],
    ['term', 'Term (years)', ['term', 'termyears', 'mortgageterm', 'termofloan'], '25'],
    ['pay', 'Monthly payment', ['monthlypayment', 'payment', 'paymentpermonth'], ''],
    [
      'fixed',
      'Initial deal ends',
      [
        'fixeduntil',
        'fixedend',
        'dealends',
        'dealend',
        'rateends',
        'rateend',
        'productends',
        'productend',
        'initialrateends',
        'fixedrateend',
        'expiry',
        'expirydate',
        'endofdeal'
      ],
      '31/03/2029'
    ],
    ['review', 'Review date', ['reviewdate', 'nextreview', 'mortgagereview', 'reviewon'], ''],
    ['stage', 'Stage', ['stage', 'status', 'casestatus', 'pipelinestage', 'progress'], 'Offered'],
    [
      'type',
      'Case type',
      ['casetype', 'mortgagetype', 'purpose', 'type', 'typeofmortgage', 'purposeofmortgage'],
      'Purchase'
    ],
    ['use', 'Property use', ['propertyuse', 'use', 'propertytype', 'btl'], 'Buy to let'],
    ['repay', 'Repayment method', ['repayment', 'repaymenttype', 'repaymentmethod'], 'Repayment'],
    [
      'lref',
      'Lender reference',
      [
        'lenderref',
        'lenderreference',
        'mortgageref',
        'mortgagereference',
        'rollnumber',
        'accountnumber',
        'reference',
        'ref'
      ],
      ''
    ],
    ['product', 'Product code', ['product', 'productcode', 'productname'], ''],
    [
      'co',
      'Company name (limited company)',
      ['company', 'companyname', 'spv', 'limitedcompany', 'borrowercompany'],
      ''
    ],
    ['cono', 'Company number', ['companynumber', 'companyno', 'companyreg', 'crn', 'registrationnumber'], ''],
    [
      'note',
      'Notes',
      ['notes', 'note', 'comments', 'comment', 'remarks', 'history', 'casenotes'],
      'Spoke to client. Documents received.'
    ],
    [
      'task',
      'Task or next action',
      ['task', 'nexttask', 'nextaction', 'action', 'todo', 'followup'],
      'Chase the valuation'
    ],
    [
      'taskdue',
      'Task due date',
      ['taskdue', 'taskduedate', 'duedate', 'nextactiondate', 'followupdate', 'actiondate'],
      '30/11/2026'
    ],
    [
      'apps',
      'All applicants (names, one after another, split by |)',
      ['applicants', 'applicantnames', 'allapplicants', 'borrowers'],
      'MR TEST PERSON1 | MRS TEST PERSON2'
    ],
    [
      'dobs',
      'Dates of birth (one per applicant, split by |)',
      ['datesofbirth', 'dobs', 'birthdates', 'datesofbirths'],
      '01/02/1980 | 03/04/1982'
    ],
    [
      'phones',
      'Phones (one per applicant, split by |)',
      ['phones', 'phonenumbers', 'mobiles', 'telephones'],
      '07000000001 | 07000000002'
    ],
    [
      'emails',
      'Emails (one per applicant, split by |)',
      ['emails', 'emailaddresses'],
      'one@example.com | two@example.com'
    ],
    [
      'addrs',
      'Home addresses (one per applicant, split by |)',
      ['addresses', 'homeaddresses', 'applicantaddresses', 'currentaddresses'],
      '5 Old Street, AB1 2CD | 5 Old Street, AB1 2CD'
    ]
  ],
  req: ['name'],
  reqL: 'the applicant’s name (or first name and surname, or a list of applicants)',
  any: 1
};
/* turning the words in a column into the app's own values */
function imStage(v) {
  var s = String(v || '').toLowerCase();
  if (!s) return 'enquiry';
  return /lost|declin|dead|cancel|withdr|abandon|not proceed/.test(s)
    ? 'lost'
    : /complet|drawn|done|paid out|released/.test(s)
      ? 'completed'
      : /offer/.test(s)
        ? 'offer'
        : /fma|full mortgage|application|submitted|applied/.test(s)
          ? 'application'
          : /dip|aip|principle/.test(s)
            ? 'dip'
            : /fact/.test(s)
              ? 'factfind'
              : 'enquiry';
}
function imUse(v) {
  var s = String(v || '').toLowerCase();
  return !s
    ? ''
    : /btl|buy.?to.?let|let\b|investment|rental/.test(s)
      ? 'btl'
      : /holiday/.test(s)
        ? 'holiday'
        : /second/.test(s)
          ? 'second'
          : /main|resid|home|owner|live/.test(s)
            ? 'main'
            : '';
}
function imRepay(v) {
  var s = String(v || '').toLowerCase();
  return /part/.test(s)
    ? 'part-and-part'
    : /interest.?only|\bio\b/.test(s)
      ? 'interest-only'
      : /repay|capital/.test(s)
        ? 'repayment'
        : '';
}
function imMgRecord(g) {
  var lst = function (v) {
    return String(v || '')
      .split(/\s*\|\s*/)
      .map(function (x) {
        x = x.trim();
        return /^[-–—]$/.test(x) ? '' : x;
      });
  };
  var aps = lst(g('apps')).filter(Boolean),
    nm = aps[0] || g('name') || [g('fn'), g('sn')].filter(Boolean).join(' '),
    co = g('co');
  if (!nm && !co) return null;
  var person = function (n, d, p, e, a) {
    var o = { name: n };
    if (d) o.dob = imDate(d);
    if (p) o.phone = imPhone(p);
    if (e) o.email = e;
    if (a) o.address = a;
    return o;
  };
  var names = aps.slice();
  if (!names.length) {
    var nm2 = g('name2');
    if (nm && !nm2) {
      /* "Mr A Smith & Mrs B Smith" in one cell = two applicants */
      var sp = nm.split(/\s+(?:&|and|\+)\s+/i);
      if (sp.length === 2 && sp[0].trim() && sp[1].trim()) {
        nm = sp[0].trim();
        nm2 = sp[1].trim();
      }
    }
    if (nm) names.push(nm);
    if (nm2) names.push(nm2);
  }
  /* dates of birth, phones, emails and addresses: one per applicant, in order (a list split by |), or the single columns */
  var dl = lst(g('dobs')),
    pl = lst(g('phones')),
    el = lst(g('emails')),
    al = lst(g('addrs'));
  var ap = [];
  names.slice(0, 4).forEach(function (n, i) {
    ap.push(
      person(
        n,
        dl[i] || (i === 0 ? g('dob') : i === 1 && !aps.length ? g('dob2') : ''),
        pl[i] || (i === 0 ? g('phone') : i === 1 && !aps.length ? g('phone2') : ''),
        el[i] || (i === 0 ? g('email') : i === 1 && !aps.length ? g('email2') : ''),
        al[i] || (i === 0 ? g('address') : '')
      )
    );
  });
  var use = imUse(g('use')),
    d = {
      applicants: ap.length ? ap : [{}],
      stage: imStage(g('stage')),
      type: imType(g('type')) || (use === 'btl' ? 'Buy to let' : T.types[0]),
      repayment: imRepay(g('repay')) || 'repayment',
      tasks: [],
      notes: []
    };
  if (g('cno')) d.clientNo = g('cno');
  if (g('addr')) d.propertyAddress = g('addr');
  if (g('lender')) d.lender = g('lender');
  var m;
  if ((m = imNum(g('loan')))) d.loanAmount = +m;
  if ((m = imNum(g('value')))) d.propertyValue = +m;
  if ((m = imNum(g('price')))) d.purchasePrice = +m;
  if ((m = imNum(g('rate')))) d.rate = +m;
  if ((m = imNum(g('term')))) d.termYears = +m;
  if ((m = imNum(g('pay')))) d.monthlyPayment = +m;
  if ((m = imDate(g('fixed')))) d.fixedUntil = m;
  if ((m = imDate(g('review')))) d.reviewDate = m;
  if (use) d.propUse = use;
  if (g('lref')) d.lenderRef = g('lref');
  if (g('product')) d.product = g('product');
  if (co) {
    d.borrowerType = 'spv';
    d.companyName = co;
    if (g('cono')) d.companyNumber = g('cono');
  }
  var now = Date.now();
  if (g('note')) d.notes.push({ ts: now, text: g('note') });
  if (g('task'))
    d.tasks.push({
      id: uid(),
      text: g('task'),
      due: imDate(g('taskdue')),
      time: '',
      done: false,
      created: now,
      pri: false,
      from: 'import'
    });
  return d;
}
function imKind() {
  return T.tenancyMode
    ? 'landlord'
    : T.id === 'gas'
      ? 'gas'
      : T.id === 'accountant'
        ? 'accountant'
        : T.id || '';
}
/* every other trade imports the same simple list: name, phone, email, address or main detail, type of work and price */
function imDef(k) {
  k = k || imKind();
  if (!k) return null;
  if (IM_TRADE[k]) return IM_TRADE[k];
  var al = T.byKey && T.addr && T.byKey[T.addr];
  IM_TRADE[k] = {
    noun: String(T.noun[0]).toLowerCase(),
    one: String(T.noun[0]).toLowerCase(),
    many: String(T.noun[1]).toLowerCase(),
    fields: [
      [
        'name',
        T.person[0] + ' name',
        [
          'name',
          'fullname',
          'client',
          'clientname',
          'customer',
          'customername',
          'pupil',
          'learner',
          'contact',
          'contactname',
          'applicant'
        ]
      ],
      ['phone', 'Phone', ['phone', 'mobile', 'telephone', 'tel', 'phonenumber', 'mobilenumber']],
      ['email', 'Email', ['email', 'emailaddress']],
      [
        'addr',
        (al && al.l) || 'Address',
        [
          'address',
          'jobaddress',
          'siteaddress',
          'addressline1',
          'street',
          'property',
          'pickup',
          'usualservice'
        ]
      ],
      [
        'type',
        'Type of work',
        ['type', 'service', 'work', 'jobtype', 'course', 'mattertype', 'casetype', 'projecttype', 'treatment']
      ],
      [
        'val',
        (T.value && T.value.l) || 'Price',
        ['price', 'amount', 'cost', 'fee', 'fees', 'value', 'quote', 'lessonprice', 'spend', 'usualspend']
      ]
    ],
    req: ['name'],
    reqL: 'a name',
    any: 1
  };
  return IM_TRADE[k];
}
function imN(n) {
  var d = imDef();
  return n === 1 ? d.one : d.many;
}
function imNorm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
/* CSV: quotes, commas, semicolons or tabs, a byte-order mark */
function imCsv(t) {
  t = String(t || '').replace(/^﻿/, '');
  var first = t.split(/\r?\n/)[0] || '',
    d = [',', ';', '\t']
      .map(function (c) {
        return [c, (first.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length];
      })
      .sort(function (a, b) {
        return b[1] - a[1];
      })[0][0];
  var rows = [],
    row = [],
    cur = '',
    q = false,
    i = 0;
  for (; i < t.length; i++) {
    var ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}
/* Excel (.xlsx) is a zip of XML files: read it here, nothing is uploaded anywhere */
async function imInflate(u8) {
  var ds = new DecompressionStream('deflate-raw'),
    w = ds.writable.getWriter();
  w.write(u8);
  w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
function imZip(buf) {
  var v = new DataView(buf),
    u = new Uint8Array(buf),
    e = -1,
    i;
  for (i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  }
  if (e < 0) throw new Error('zip');
  var n = v.getUint16(e + 10, true),
    p = v.getUint32(e + 16, true),
    out = {};
  for (i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('zip');
    var method = v.getUint16(p + 10, true),
      cs = v.getUint32(p + 20, true),
      nl = v.getUint16(p + 28, true),
      xl = v.getUint16(p + 30, true),
      cl = v.getUint16(p + 32, true),
      lo = v.getUint32(p + 42, true),
      name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
    var ln = v.getUint16(lo + 26, true),
      lx = v.getUint16(lo + 28, true),
      st = lo + 30 + ln + lx;
    out[name] = { method: method, data: u.subarray(st, st + cs) };
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function imEntry(z, name) {
  var f = z[name];
  if (!f) return null;
  var d = f.method === 0 ? f.data : await imInflate(f.data);
  return new TextDecoder().decode(d);
}
function imXml(s) {
  var d = new DOMParser().parseFromString(s, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('xml');
  return d;
}
function imCol(ref) {
  var m = /^([A-Z]+)/.exec(ref || ''),
    n = 0;
  if (!m) return 0;
  for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64;
  return n - 1;
}
async function imXlsx(buf) {
  var z = imZip(buf),
    shared = [],
    ss = await imEntry(z, 'xl/sharedStrings.xml');
  if (ss) {
    var sd = imXml(ss).getElementsByTagName('si');
    for (var i = 0; i < sd.length; i++) {
      var ts = sd[i].getElementsByTagName('t'),
        s = '';
      for (var j = 0; j < ts.length; j++) {
        if (ts[j].parentNode.nodeName !== 'rPh') s += ts[j].textContent;
      }
      shared.push(s);
    }
  }
  var wb = imXml(await imEntry(z, 'xl/workbook.xml')),
    sheets = wb.getElementsByTagName('sheet'),
    rels = imXml(await imEntry(z, 'xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship'),
    rmap = {};
  for (var r = 0; r < rels.length; r++) rmap[rels[r].getAttribute('Id')] = rels[r].getAttribute('Target');
  var best = null;
  for (var k = 0; k < sheets.length; k++) {
    var rid =
        sheets[k].getAttributeNS(
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
          'id'
        ) || sheets[k].getAttribute('r:id'),
      tg = rmap[rid] || '',
      path = tg.charAt(0) === '/' ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, ''),
      xml = await imEntry(z, path);
    if (!xml) continue;
    var rows = [],
      rs = imXml(xml).getElementsByTagName('row');
    for (var a = 0; a < rs.length; a++) {
      var cs = rs[a].getElementsByTagName('c'),
        row = [];
      for (var b = 0; b < cs.length; b++) {
        var c = cs[b],
          t = c.getAttribute('t'),
          ve = c.getElementsByTagName('v')[0],
          val = '';
        if (t === 's') val = ve ? shared[+ve.textContent] || '' : '';
        else if (t === 'inlineStr') {
          var it = c.getElementsByTagName('t');
          for (var x = 0; x < it.length; x++) val += it[x].textContent;
        } else if (t === 'b') val = ve && ve.textContent === '1' ? 'TRUE' : 'FALSE';
        else val = ve ? ve.textContent : '';
        row[imCol(c.getAttribute('r'))] = val;
      }
      for (var y = 0; y < row.length; y++) if (row[y] == null) row[y] = '';
      rows.push(row);
    }
    var filled = rows.filter(function (rw) {
      return rw.some(function (c) {
        return String(c).trim();
      });
    }).length;
    if (!best || filled > best.n)
      best = { n: filled, rows: rows, name: sheets[k].getAttribute('name') || '' };
    if (filled > 1) break;
  }
  if (!best) throw new Error('empty');
  imSheet = best.name;
  return best.rows;
}
function imDate(v) {
  v = String(v == null ? '' : v).trim();
  if (!v) return '';
  if (/^\d{5}(\.\d+)?$/.test(v) && +v > 20000 && +v < 80000) {
    var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 864e5);
    return d.toISOString().slice(0, 10);
  }
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(v);
  if (m) {
    var y = +m[3];
    if (y < 100) y += y < 70 ? 2000 : 1900;
    var dd = +m[1],
      mm = +m[2];
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
    return y + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2);
  }
  var t = Date.parse(v + ' UTC');
  if (!isNaN(t)) {
    var x = new Date(t);
    return x.toISOString().slice(0, 10);
  }
  return '';
}
function imNum(v) {
  var s = String(v == null ? '' : v).replace(/[£€\s]/g, '');
  s = /^-?\d+,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? String(+s) : '';
}
function imPhone(v) {
  var s = String(v == null ? '' : v).trim();
  if (/^\d{10}$/.test(s) && s.charAt(0) === '7') s = '0' + s;
  if (/^\d{12}$/.test(s) && s.slice(0, 2) === '44') s = '+' + s;
  return s;
}
function imFreq(v) {
  var s = String(v || '').toLowerCase();
  return /4|four/.test(s)
    ? 'Every 4 weeks'
    : /week/.test(s)
      ? 'Weekly'
      : /quarter/.test(s)
        ? 'Quarterly'
        : 'Monthly';
}
function imType(v) {
  var s = String(v || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  var ex =
    T.types.filter(function (t) {
      return t.toLowerCase() === s;
    })[0] ||
    T.types.filter(function (t) {
      return t.toLowerCase().indexOf(s) > -1 || s.indexOf(t.toLowerCase()) > -1;
    })[0];
  return ex || '';
}
function imAuto(h) {
  var n = imNorm(h),
    k = imKind(),
    def = imDef(k);
  if (!n || !def) return '';
  var hit = '';
  def.fields.forEach(function (f) {
    if (!hit && (f[2].indexOf(n) > -1 || imNorm(f[1]) === n)) hit = f[0];
  });
  return hit;
}
function imRecord(row) {
  var k = imKind(),
    g = function (key) {
      var i = imMap.indexOf(key);
      return i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim();
    };
  if (k === 'mortgage') return imMgRecord(g);
  var d;
  if (k === 'landlord') {
    var addr = g('addr');
    if (!addr) return null;
    d = {
      propertyAddress: addr,
      postcode: g('pc'),
      type: imType(g('type')) || T.types[0],
      tasks: [],
      notes: [],
      expenses: [],
      tenancies: []
    };
    var bd = imNum(g('beds'));
    if (bd) d.bedrooms = +bd;
    if (g('agent')) d.agent = g('agent');
    var gs = imDate(g('gsr'));
    if (gs) d.gsrDate = gs;
    var ei = imDate(g('eicr'));
    if (ei) d.eicrDate = ei;
    var ep = imDate(g('epcd'));
    if (ep) d.epcDate = ep;
    if (g('epcr')) d.epcRating = g('epcr').toUpperCase().slice(0, 1);
    var ir = imDate(g('ins'));
    if (ir) d.insuranceRenewal = ir;
    var tn = g('tname'),
      rent = imNum(g('rent'));
    if (tn || rent) {
      var tt = {
        id: 't' + uid(),
        status: 'current',
        tenantType: 'private',
        people: tn ? [{ name: tn, phone: imPhone(g('tphone')), email: g('temail') }] : [],
        rent: rent,
        rentFreq: imFreq(g('rfreq'))
      };
      var rd = imNum(g('rday'));
      if (rd && +rd >= 1 && +rd <= 31) tt.rentDay = rd;
      var st = imDate(g('tstart'));
      if (st) tt.tenancyStart = st;
      var dp = imNum(g('deposit'));
      if (dp) tt.deposit = dp;
      d.tenancies.push(tt);
    }
    d.stage = d.tenancies.length ? 'let' : 'vacant';
  } else if (k === 'accountant') {
    var cn = g('name'),
      bz = g('biz');
    if (!cn && !bz) return null;
    var yes = function (v) {
      v = String(v || '').toLowerCase();
      return /^(y|yes|true|registered)/.test(v) ? 'Yes' : /^(n|no|false)/.test(v) ? 'No' : '';
    };
    d = {
      applicants: cn ? [{ name: cn, phone: imPhone(g('phone')), email: g('email') }] : [],
      bizName: bz,
      type: imType(g('type')) || T.types[0],
      stage: 'active',
      tasks: [],
      notes: [],
      expenses: []
    };
    var bt =
      T.byKey.bizType.o.filter(function (o) {
        return o && o.toLowerCase() === g('btype').toLowerCase();
      })[0] ||
      (/sole|self|individual/i.test(g('btype'))
        ? 'Sole trader'
        : /ltd|limited|company/i.test(g('btype'))
          ? 'Limited company'
          : /partner/i.test(g('btype'))
            ? 'Partnership'
            : '');
    if (bt) d.bizType = bt;
    var fe = imNum(g('fee'));
    if (fe) d.fee = +fe;
    var fb = /month/i.test(g('fbasis'))
      ? 'Monthly'
      : /quarter/i.test(g('fbasis'))
        ? 'Quarterly'
        : /annual|year/i.test(g('fbasis'))
          ? 'Annually'
          : /job/i.test(g('fbasis'))
            ? 'Per job'
            : '';
    if (fb) d.feeBasis = fb;
    var ye = imDate(g('yend'));
    if (ye) d.yearEnd = ye;
    var sd = imDate(g('sadue'));
    if (sd) d.saDue = sd;
    if (g('nature')) d.stNature = g('nature');
    var st0 = imDate(g('start'));
    if (st0) d.stStart = st0;
    var bs = /cash/i.test(g('basis'))
      ? 'Cash basis'
      : /accru|tradition/i.test(g('basis'))
        ? 'Traditional (accruals)'
        : '';
    if (bs) d.stBasis = bs;
    var tu = imNum(g('turn'));
    if (tu) d.stTurnover = +tu;
    var vt = yes(g('vat'));
    if (vt) d.stVat = vt;
    else if (g('vatno')) d.stVat = 'Yes';
    if (g('vatno')) d.stVatNo = g('vatno');
  } else if (k !== 'gas') {
    var nm0 = g('name'),
      ad0 = g('addr');
    if (!nm0 && !ad0) return null;
    d = {
      applicants: nm0 ? [{ name: nm0, phone: imPhone(g('phone')), email: g('email') }] : [],
      type: imType(g('type')) || T.types[0],
      stage: T.defaultStage,
      tasks: [],
      notes: [],
      expenses: []
    };
    if (T.addr && ad0) d[T.addr] = ad0;
    var v0 = imNum(g('val'));
    if (v0 && T.value) d[T.value.k] = +v0;
  } else {
    var nm = g('name'),
      ad = g('addr');
    if (!nm && !ad) return null;
    d = {
      applicants: nm ? [{ name: nm, phone: imPhone(g('phone')), email: g('email') }] : [],
      jobAddress: ad,
      postcode: g('pc'),
      type: imType(g('type')) || T.types[0],
      stage: T.defaultStage,
      tasks: [],
      notes: [],
      expenses: []
    };
    if (g('appliance')) d.appliance = g('appliance');
    var l = imDate(g('last'));
    if (l) d.lastService = l;
    var nx = imDate(g('next'));
    if (nx) d.nextService = nx;
    var gr = imDate(g('gsr'));
    if (gr) d.gsrDate = gr;
    var qt = imNum(g('quote'));
    if (qt) d.quote = +qt;
  }
  return d;
}
function imKey(d) {
  return imKind() === 'accountant'
    ? ((d.applicants && d.applicants[0] ? d.applicants[0].name : '') + '|' + String(d.bizName || ''))
        .toLowerCase()
        .replace(/\s+/g, '')
    : imKind() === 'landlord'
      ? (String(d.propertyAddress || '') + '|' + String(d.postcode || '')).toLowerCase().replace(/\s+/g, '')
      : (
          (d.applicants && d.applicants[0] ? d.applicants[0].name : '') +
          '|' +
          String(d[T.addr] || d.jobAddress || '')
        )
          .toLowerCase()
          .replace(/\s+/g, '');
}
function imPlan() {
  var have = {};
  cases.forEach(function (c) {
    have[imKey(c)] = c;
  });
  var seen = {},
    upd = [],
    add = [],
    dup = 0,
    empty = 0,
    def = imDef();
  imRows.forEach(function (r) {
    var d = imRecord(r);
    if (!d) {
      if (
        r.some(function (c) {
          return String(c).trim();
        })
      )
        empty++;
      return;
    }
    var k = imKey(d);
    if (have[k] || seen[k]) {
      dup++;
      /* a client already here: work out what the file could fill in (never replacing anything already there) */
      if (have[k] && !seen['u' + k] && typeof dupMerge === 'function') {
        seen['u' + k] = 1;
        var ex = have[k],
          m = dupMerge(ex, [d], true),
          a0 = JSON.parse(JSON.stringify(ex));
        delete a0.id;
        delete a0.updatedAt;
        delete m.updatedAt;
        if (JSON.stringify(a0) !== JSON.stringify(m)) upd.push({ c: ex, m: m });
      }
      return;
    }
    seen[k] = 1;
    add.push(d);
  });
  return {
    add: add,
    upd: upd,
    dup: dup,
    empty: empty,
    missing: def.req.filter(function (x) {
      return (
        imMap.indexOf(x) < 0 &&
        !(
          imKind() === 'mortgage' &&
          x === 'name' &&
          ((imMap.indexOf('fn') > -1 && imMap.indexOf('sn') > -1) || imMap.indexOf('apps') > -1)
        )
      );
    }),
    def: def
  };
}
function imHtml() {
  var k = imKind(),
    def = imDef(k);
  if (!imHead.length)
    return (
      '<div class="dhd"><h2>Import from Excel or CSV</h2><button type="button" class="btn ghost" data-imclose="1">Close</button></div>' +
      '<p class="muted" style="margin:6px 0 12px">Bring in a list you already keep, from an Excel (.xlsx) or CSV file. The file is read on this device. You choose which column is which before anything is added, and nothing is changed until you press Import.</p>' +
      '<div class="add" style="margin:0 0 10px"><label class="btn imfile">Choose a file<input type="file" id="imFile" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none"></label><button type="button" class="btn ghost" data-imtemplate="1">Download an example file</button></div>' +
      '<p id="imMsg" role="alert" class="tmmsg"></p>' +
      '<p class="muted" style="font-size:12.5px;margin:0">The first row must be the column names. Older .xls files are not supported: in Excel choose Save As and pick .xlsx or CSV. Up to 500 rows at a time. Columns it recognises are matched for you, for example ' +
      esc(
        def.fields
          .slice(0, 5)
          .map(function (f) {
            return f[1];
          })
          .join(', ')
      ) +
      '.</p>'
    );
  var p = imPlan(),
    head =
      '<div class="dhd"><h2>Import from Excel or CSV</h2><button type="button" class="btn ghost" data-imclose="1">Close</button></div>' +
      '<p class="muted" style="margin:6px 0 10px"><b>' +
      esc(imName) +
      '</b>' +
      (imSheet ? ' · sheet “' + esc(imSheet) + '”' : '') +
      ' · ' +
      imRows.length +
      ' row' +
      (imRows.length === 1 ? '' : 's') +
      '. Check what each column is used for.</p>';
  var opts = function (sel) {
    return (
      '<option value="">Do not import</option>' +
      def.fields
        .map(function (f) {
          return (
            '<option value="' + f[0] + '"' + (f[0] === sel ? ' selected' : '') + '>' + esc(f[1]) + '</option>'
          );
        })
        .join('')
    );
  };
  var tbl =
    '<div class="imlist"><div class="imrow imhd"><span>Column in your file</span><span>Example</span><span>Use it for</span></div>' +
    imHead
      .map(function (h, i) {
        var ex = imRows
          .slice(0, 3)
          .map(function (r) {
            return String(r[i] == null ? '' : r[i]).trim();
          })
          .filter(Boolean)
          .slice(0, 2)
          .join(' · ');
        return (
          '<div class="imrow"><b>' +
          esc(h || '(no name)') +
          '</b><span class="muted">' +
          esc(ex.slice(0, 60)) +
          '</span><select data-immap="' +
          i +
          '" aria-label="Use ' +
          esc(h) +
          ' for">' +
          opts(imMap[i]) +
          '</select></div>'
        );
      })
      .join('') +
    '</div>';
  var msg = p.missing.length
    ? '<p class="gnwarn">Choose a column for ' + esc(def.reqL) + ', then you can import.</p>'
    : '<p style="margin:10px 0 0"><b>' +
      p.add.length +
      '</b> ' +
      imN(p.add.length) +
      ' will be added' +
      (p.dup ? ', <b>' + p.dup + '</b> already here or repeated (skipped)' : '') +
      (p.empty
        ? ', <b>' + p.empty + '</b> row' + (p.empty === 1 ? '' : 's') + ' with nothing usable (skipped)'
        : '') +
      '. ' +
      (imFill ? 'Records already here only get empty boxes filled.' : 'Existing records are never changed.') +
      '</p>' +
      (imKind() === 'mortgage' && p.upd.length
        ? '<label style="display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;padding:10px 12px;border:1px solid #F0D58A;background:#FFF6E0;color:#4A3A0A;border-radius:10px;cursor:pointer"><input type="checkbox" id="imFill"' +
          (imFill ? ' checked' : '') +
          ' style="margin-top:3px"><span><b>Also fill in missing details on ' +
          p.upd.length +
          ' client' +
          (p.upd.length === 1 ? '' : 's') +
          ' already here</b><br><span style="font-size:13px">Adds dates of birth, phones, emails, addresses, notes and tasks from this file where they are empty. Anything already filled in is never changed.</span></span></label>'
        : '');
  return (
    head +
    tbl +
    msg +
    (imBusy
      ? '<div id="imProg" style="margin:12px 0;padding:12px 14px;border:1px solid #BFE0D2;border-radius:10px;background:#EEF8F3"><div id="imProgTxt" style="font-weight:600">Saving…</div><div style="height:10px;border-radius:99px;background:#D4E8DE;margin:8px 0;overflow:hidden"><i id="imProgFill" style="display:block;height:100%;width:3%;background:#0A6B50;border-radius:99px;transition:width .3s"></i></div><div class="muted" style="font-size:13px">Please keep this window open until it finishes.</div></div>'
      : '') +
    '<div class="add" style="margin:12px 0 0"><button type="button" class="btn" data-imgo="1"' +
    (p.missing.length || (!p.add.length && !(imFill && p.upd.length)) || imBusy ? ' disabled' : '') +
    '>' +
    (imBusy
      ? 'Importing…'
      : imFill && p.upd.length
        ? (p.add.length ? 'Import ' + p.add.length + ' and update ' : 'Update ') +
          p.upd.length +
          ' client' +
          (p.upd.length === 1 ? '' : 's')
        : 'Import ' + p.add.length + ' ' + imN(p.add.length)) +
    '</button><button type="button" class="btn ghost" data-imagain="1">Choose a different file</button></div><p id="imMsg" role="alert" class="tmmsg"></p>'
  );
}
function imDraw() {
  overlay('imOv', imHtml(), true);
}
function imOpen() {
  if (!imKind()) {
    toast('Import is not available for this kind of work yet.');
    return;
  }
  imRows = [];
  imHead = [];
  imMap = [];
  imName = '';
  imSheet = '';
  imBusy = false;
  imFill = false;
  imDraw();
}
async function imLoad(file) {
  var m = $('#imMsg'),
    say = function (t) {
      if (m) m.textContent = t;
    };
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    say('That file is over 10 MB. Save a smaller one.');
    return;
  }
  if (/\.xls$/i.test(file.name)) {
    say('Older .xls files are not supported. In Excel choose Save As, then .xlsx or CSV.');
    return;
  }
  say('Reading the file…');
  try {
    var rows,
      isX =
        /\.xlsx$/i.test(file.name) ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    imSheet = '';
    if (isX) {
      if (typeof DecompressionStream === 'undefined') {
        say('This browser cannot read .xlsx files. Save the sheet as CSV instead.');
        return;
      }
      rows = await imXlsx(await file.arrayBuffer());
    } else rows = imCsv(await file.text());
    rows = rows.filter(function (r) {
      return r.some(function (c) {
        return String(c == null ? '' : c).trim();
      });
    });
    if (rows.length < 2) {
      say('No data found. The first row must be the column names, with the records below it.');
      return;
    }
    imHead = rows[0].map(function (h) {
      return String(h == null ? '' : h).trim();
    });
    imRows = rows.slice(1, 501).map(function (r) {
      var o = [];
      for (var i = 0; i < imHead.length; i++) o.push(r[i] == null ? '' : r[i]);
      return o;
    });
    imMap = imHead.map(imAuto);
    var used = {};
    imMap = imMap.map(function (x) {
      if (x && used[x]) return '';
      if (x) used[x] = 1;
      return x;
    });
    imName = file.name;
    imDraw();
    if (rows.length > 501) toast('Only the first 500 rows are used. Import the rest in a second file.');
  } catch (e) {
    say(
      'That file could not be read. Check it is a normal Excel (.xlsx) or CSV file, with the column names in the first row.'
    );
  }
}
function imRun() {
  if (imBusy || !col) return;
  var p = imPlan(),
    ups = imFill ? p.upd : [];
  if (p.missing.length || (!p.add.length && !ups.length)) return;
  imBusy = true;
  imDraw();
  var now = Date.now(),
    n = 0,
    chain = Promise.resolve(),
    list = p.add,
    base = +nextClientNo().slice(1);
  /* the mortgage adviser keeps the client numbers in the file, and gives a client's other properties the same number;
     a number already used by a different client is replaced by the next free one */
  if (imKind() === 'mortgage') {
    var maxN = base - 1,
      used = {},
      byClient = {};
    casesAll.forEach(function (c) {
      if (!c.clientNo) return;
      used[c.clientNo] = clientKey(c);
      if (!byClient[clientKey(c)]) byClient[clientKey(c)] = c.clientNo;
    });
    list.forEach(function (d) {
      var ck = clientKey(d),
        want = d.clientNo ? String(d.clientNo).trim() : '';
      if (!want || (used[want] && used[want] !== ck)) {
        if (byClient[ck]) want = byClient[ck];
        else {
          do {
            maxN++;
            want = 'C' + String(maxN).padStart(3, '0');
          } while (used[want]);
        }
      }
      d.clientNo = want;
      used[want] = ck;
      if (!byClient[ck]) byClient[ck] = want;
    });
  }
  var total = list.length + ups.length,
    setProg = function () {
      var t = $('#imProgTxt'),
        f = $('#imProgFill');
      if (t) t.textContent = 'Saving ' + n + ' of ' + total + '…';
      if (f) f.style.width = Math.max(3, Math.round((n / total) * 100)) + '%';
    };
  /* numbers are given here, one after another, from the highest in use; the list updates itself as each record is saved */
  list.forEach(function (d, i) {
    chain = chain.then(function () {
      tagTr(d);
      var ref = col.doc();
      if (imKind() !== 'mortgage') d.clientNo = 'C' + String(base + i).padStart(3, '0');
      d.createdAt = now;
      d.updatedAt = now;
      return write(ref.id, function () {
        return ref.set(d);
      }).then(function () {
        n++;
        setProg();
      });
    });
  });
  var nu = 0;
  ups.forEach(function (u) {
    chain = chain.then(function () {
      u.m.updatedAt = Date.now();
      return write(u.c.id, function () {
        return col.doc(u.c.id).update(u.m);
      }).then(function () {
        nu++;
        n++;
        setProg();
      });
    });
  });
  var added = list.length;
  chain.then(
    function () {
      imBusy = false;
      closeOv('imOv');
      toast(
        (added ? 'Imported ' + added + ' ' + imN(added) + '. ' : '') +
          (nu
            ? 'Filled in missing details on ' + nu + ' existing client' + (nu === 1 ? '' : 's') + '. '
            : '') +
          'Open one to check it.',
        true
      );
      render();
      renderNav();
      if (n) dupAfterImport();
    },
    function () {
      imBusy = false;
      imDraw();
      var m = $('#imMsg');
      if (m)
        m.textContent =
          'Could not save everything. Check you are online and try again. Records already added are kept, and repeats are skipped.';
    }
  );
}
function imTemplate() {
  var def = imDef(),
    q = function (v) {
      v = csvCell(v);
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
  var ex =
    imKind() === 'mortgage'
      ? def.fields.map(function (f) {
          return f[3] || '';
        })
      : imKind() === 'accountant'
        ? [
            'A. Sample',
            '07700 900123',
            'a.sample@example.com',
            'Sample Plumbing',
            'Sole trader',
            'Self Assessment',
            '480',
            'Annually',
            '05/04/2026',
            '31/01/2027',
            'Plumbing and heating',
            '01/06/2019',
            'Cash basis',
            '62000',
            'No',
            ''
          ]
        : imKind() === 'landlord'
          ? [
              '1 Example Road',
              'AB1 2CD',
              'House',
              '3',
              'A. Sample',
              '07700 900123',
              'a.sample@example.com',
              '1150',
              'Monthly',
              '1',
              '01/03/2025',
              '1150',
              '01/06/2026',
              '15/02/2022',
              'C',
              '10/05/2020',
              '20/09/2026'
            ]
          : imKind() === 'gas'
            ? [
                'A. Sample',
                '07700 900123',
                'a.sample@example.com',
                '14 Example Road',
                'AB1 2CD',
                'Boiler service',
                'Worcester Greenstar 30i',
                '14/11/2025',
                '14/11/2026',
                '',
                '95'
              ]
            : [
                'A. Sample',
                '07700 900123',
                'a.sample@example.com',
                '14 Example Road',
                (T.types || [''])[0],
                '95'
              ];
  var heads =
    imKind() === 'landlord'
      ? [
          'Address',
          'Postcode',
          'Property type',
          'Bedrooms',
          'Tenant name',
          'Tenant phone',
          'Tenant email',
          'Rent',
          'Rent frequency',
          'Rent due day',
          'Tenancy start',
          'Deposit',
          'Gas safety date',
          'EICR date',
          'EPC rating',
          'EPC date',
          'Insurance renewal'
        ]
      : def.fields.map(function (f) {
          return f[1];
        });
  var blob = new Blob(['﻿' + heads.map(q).join(',') + '\r\n' + ex.map(q).join(',') + '\r\n'], {
      type: 'text/csv;charset=utf-8'
    }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = imDef().many.replace(/\s+/g, '-') + '-import-example.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('[data-act="import"]')) {
    imOpen();
    return;
  }
  if (t.closest('[data-imclose]') || t.id === 'imOv') {
    closeOv('imOv');
    return;
  }
  if (t.closest('[data-imtemplate]')) {
    imTemplate();
    return;
  }
  if (t.closest('[data-imagain]')) {
    imOpen();
    return;
  }
  if (t.closest('[data-imgo]')) {
    imRun();
    return;
  }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t) return;
  if (t.id === 'imFile') {
    var f = t.files && t.files[0];
    t.value = '';
    imLoad(f);
    return;
  }
  if (t.id === 'imFill') {
    imFill = t.checked;
    imDraw();
    return;
  }
  if (t.hasAttribute && t.hasAttribute('data-immap')) {
    var i = +t.getAttribute('data-immap');
    imMap[i] = t.value;
    if (t.value)
      imMap = imMap.map(function (x, j) {
        return j !== i && x === t.value ? '' : x;
      });
    imDraw();
  }
});
