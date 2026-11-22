'use strict';
/* MySimpleDesk app: Company let agreements.
   All the app-*.js files share one page: they are loaded in this order by index.html and use each other's functions. */
/* ---------- company let agreement (corporate tenant): a common-law tenancy, outside the Housing Act 1988 ---------- */
var CL_TERMS = [
  [
    'Break clause (either side)',
    'Either the landlord or the tenant may end this tenancy early by giving the other at least 2 months’ notice in writing. The notice must not end before the last day of the first 6 months of the term. A notice from the tenant only takes effect if the rent has been paid up to the day the notice ends. Ending the tenancy in this way does not affect any claim either side has for an earlier breach of this agreement.'
  ],
  [
    'Break clause (tenant only)',
    'The tenant may end this tenancy early by giving the landlord at least 2 months’ notice in writing. The notice must not end before the last day of the first 6 months of the term, and only takes effect if the rent has been paid up to the day the notice ends.'
  ],
  [
    'Rent review (fixed yearly increase)',
    'On each anniversary of the start date the rent will increase by 3%. The landlord will confirm the new rent to the tenant in writing at least 1 month before each anniversary.'
  ],
  [
    'Rent review (linked to inflation)',
    'On each anniversary of the start date the rent will increase by the same percentage as the rise in the Consumer Prices Index over the 12 months for which figures were last published before that anniversary. The rent will not go down. The landlord will tell the tenant the new rent in writing, with the calculation, at least 1 month before each anniversary.'
  ],
  [
    'Interest on late payment',
    'If any rent or other sum due under this agreement is more than 14 days late, the tenant will pay interest on it at 4% a year above the Bank of England base rate, from the date it was due until the date it is paid.'
  ],
  [
    'Inventory and check-out',
    'The landlord will give the tenant an inventory and schedule of condition at the start of the tenancy. The tenant has 7 days from receiving it to tell the landlord in writing about anything it disagrees with. After that it is treated as correct. A check-out inspection will be carried out when the tenancy ends, and the tenant may attend.'
  ],
  [
    'Furnished property',
    'The property is let furnished. The tenant will keep the items listed in the inventory at the property and in the same condition as at the start (fair wear and tear excepted), and will pay the reasonable cost of repairing or replacing any item that is damaged or missing at the end.'
  ],
  [
    'Professional cleaning at the end',
    'At the end of the tenancy the tenant will have the property, including the carpets, curtains, windows and oven, professionally cleaned to the standard recorded in the inventory at the start, or will pay the landlord’s reasonable cost of having this done.'
  ],
  [
    'Changing the occupiers',
    'The tenant may change the occupiers by giving the landlord at least 7 days’ notice in writing with the full name of each new adult occupier and the information needed for any right to rent check. The tenant may not change the occupiers more than once in any 3 months without the landlord’s written consent.'
  ],
  [
    'No short lets or serviced accommodation',
    'The tenant must not use or advertise the property for holiday lets, short stays or serviced accommodation (for example through Airbnb, Booking.com or similar websites), and must not allow anyone other than the occupiers to stay for payment.'
  ],
  [
    'Pets',
    'No animal may be kept at the property without the landlord’s written consent. If consent is given, the tenant will pay for any damage the animal causes and for any extra cleaning needed at the end of the tenancy.'
  ],
  [
    'No smoking',
    'No one may smoke or vape inside the property or in any shared indoor areas of the building.'
  ],
  [
    'Garden',
    'The tenant will keep the garden tidy and free of rubbish, cut the grass regularly in the growing season, and will not remove or cut down any trees or shrubs without the landlord’s written consent.'
  ],
  [
    'Parking',
    'The tenant and the occupiers may park one private car or motorcycle in the parking space that belongs to the property. No commercial vehicle, caravan, boat or trailer may be kept there, and no vehicle may be repaired there.'
  ],
  [
    'Tenant’s insurance',
    'The tenant will keep in place insurance for its own and the occupiers’ belongings at the property, and for its liability to other people for injury or damage at the property, and will show the landlord evidence of this if asked.'
  ],
  [
    'Keys and security',
    'The landlord will give the tenant 2 sets of keys. The tenant will not change or add locks without written consent, will return every key at the end, and will pay the reasonable cost of replacing lost keys and, where security is affected, the locks. The tenant will make sure the property is locked whenever it is empty, and will tell the landlord if it will be empty for more than 28 days.'
  ],
  [
    'Building rules and head lease',
    'The property is part of a larger building. The tenant and the occupiers will keep to the rules of the building and to the terms of the landlord’s own lease that affect how the property is used, copies of which the landlord has given to the tenant.'
  ],
  [
    'Renewal',
    'If the tenant asks in writing at least 2 months before the end of the term, and has paid the rent and kept to this agreement, the landlord will consider granting a new tenancy on terms to be agreed. Neither side is obliged to agree a new tenancy.'
  ],
  ['My own term', '']
];
var CL_PER = { 'Monthly': 'month', 'Weekly': 'week', 'Every 4 weeks': '4 weeks', 'Quarterly': 'quarter' };
function clEnd(start, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !(+months > 0)) return '';
  var d = pd(start);
  d.setMonth(d.getMonth() + Math.round(+months));
  d.setDate(d.getDate() - 1);
  return iso(d);
}
function clDefaults(c, tn) {
  var b = taDefaults(c, tn),
    dirs = ((tn && tn.directors) || []).filter(Boolean),
    ll = BIZ.companyNo ? (BIZ.name || b.landlords) + ' (company number ' + BIZ.companyNo + ')' : b.landlords;
  return {
    kind: 'company',
    landlords: ll,
    noticeAddr: BIZ.regOffice || b.noticeAddr,
    llPhone: b.llPhone,
    llEmail: b.llEmail,
    agent: b.agent,
    coName: (tn && tn.company) || '',
    coNo: (tn && tn.companyNo) || '',
    coAddr: '',
    coSign: dirs.length ? dirs[0] + ', Director' : '',
    guarantor: '',
    property: b.property,
    included: '',
    occupiers: '',
    maxOcc: '',
    start: b.start,
    termType: 'fixed',
    termMonths: '12',
    notice: '2',
    rent: b.rent,
    freq: b.freq,
    rentDay: b.rentDay,
    rentHow: '',
    bills: 'tenant',
    billsNote: '',
    deposit: b.deposit,
    depHold: 'landlord',
    scheme: b.scheme,
    gas: b.gas,
    epc: b.epc,
    gsr: b.gsr,
    eicr: b.eicr,
    terms: []
  };
}
function clTermRow(t) {
  return (
    '<div class="clterm" style="border:1px solid #D4DBDF;border-radius:8px;padding:8px 10px;margin:0 0 8px"><div style="display:flex;gap:8px;align-items:center;margin:0 0 6px"><input data-clt="t" maxlength="80" aria-label="Title of this term" value="' +
    esc(t.t || '') +
    '" placeholder="Title" style="flex:1;font-weight:600"><button type="button" class="btn ghost sm" data-clrm="1">Remove</button></div><textarea data-clt="x" rows="4" aria-label="Wording of this term" placeholder="Type the wording of this term" style="width:100%;box-sizing:border-box">' +
    esc(t.x || '') +
    '</textarea></div>'
  );
}
function clLetRender(d) {
  var i = function (k, l, ph, type) {
    return (
      '<label class="f">' +
      l +
      '<input id="ta-' +
      k +
      '" type="' +
      (type || 'text') +
      '" value="' +
      esc(d[k] == null ? '' : d[k]) +
      '" placeholder="' +
      esc(ph || '') +
      '"></label>'
    );
  };
  var a = function (k, l, ph, rows) {
    return (
      '<label class="f wide">' +
      l +
      '<textarea id="ta-' +
      k +
      '" rows="' +
      (rows || 2) +
      '" placeholder="' +
      esc(ph || '') +
      '">' +
      esc(d[k] || '') +
      '</textarea></label>'
    );
  };
  var s = function (k, l, opts) {
    return (
      '<label class="f">' +
      l +
      '<select id="ta-' +
      k +
      '">' +
      opts
        .map(function (o) {
          return (
            '<option value="' +
            esc(o[0]) +
            '"' +
            (String(d[k]) === o[0] ? ' selected' : '') +
            '>' +
            esc(o[1]) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>'
    );
  };
  overlay(
    'taOv',
    '<div class="dhd"><h2>Company let agreement</h2><button type="button" class="btn ghost" data-taclose="1">Close</button></div>' +
      '<p class="dnote">This is a template to help you, not legal advice. It is for letting a home in England to a company for up to 3 years. A letting to a company is not an assured tenancy, so the Renters’ Rights Act rules do not apply to it. Do not use it where the person who will live there is really the one renting: a court can treat that as an ordinary tenancy. Have a solicitor check it before you rely on it, above all the guarantee and any term you change.</p>' +
      '<input type="hidden" id="ta-kind" value="company">' +
      '<div class="dcgrid"><div class="dcform">' +
      '<h3 class="tah">1. Landlord</h3><div class="grid">' +
      a('landlords', 'Landlord name(s), one per line. For a company, add its company number') +
      a('noticeAddr', 'Address in England or Wales where the tenant can serve notices on you') +
      i('llPhone', 'Landlord phone (optional)') +
      i('llEmail', 'Landlord email (optional)', '', 'email') +
      i('agent', 'Letting agent (if any)') +
      '</div>' +
      '<h3 class="tah">2. Tenant company</h3><div class="grid">' +
      i('coName', 'Company name') +
      i('coNo', 'Company registration number') +
      a('coAddr', 'Registered office address') +
      i('coSign', 'Who signs for the company (name and position)', 'For example: MR A SMITH, Director') +
      a(
        'guarantor',
        'Guarantor name(s) and address, one per line (optional, for example a director giving a personal guarantee)'
      ) +
      '</div>' +
      '<h3 class="tah">3. Property and who lives there</h3><div class="grid">' +
      a('property', 'Property address') +
      a(
        'included',
        'What is included (furniture, parking, garden, shared areas)',
        'For example: furnished as per the inventory; parking space 3'
      ) +
      a(
        'occupiers',
        'Permitted occupiers, one per line',
        'Full names of the employees or officers who will live there'
      ) +
      i('maxOcc', 'Most people allowed to live there', '', 'number') +
      '</div>' +
      '<h3 class="tah">4. Term</h3><div class="grid">' +
      i('start', 'Start date', '', 'date') +
      s('termType', 'Type of term', [
        ['fixed', 'Fixed term'],
        ['periodic', 'No fixed term (runs until notice is given)']
      ]) +
      i('termMonths', 'Fixed term (months, 1 to 36)', '', 'number') +
      s('notice', 'Notice to end a tenancy that has no fixed term, or that carries on after it', [
        ['1', '1 month'],
        ['2', '2 months'],
        ['3', '3 months']
      ]) +
      '</div><div id="clWarn"></div>' +
      '<h3 class="tah">5. Rent and bills</h3><div class="grid">' +
      i('rent', 'Rent (£)', '', 'number') +
      s('freq', 'Rent period', [
        ['Monthly', 'Monthly'],
        ['Weekly', 'Weekly'],
        ['Every 4 weeks', 'Every 4 weeks'],
        ['Quarterly', 'Quarterly']
      ]) +
      i('rentDay', 'Rent due on (day of the month, or the day of the week)', '1') +
      a(
        'rentHow',
        'How the tenant pays rent',
        'For example: bank transfer to the account the landlord gives in writing'
      ) +
      s('bills', 'Council tax and utility bills', [
        ['tenant', 'The tenant pays them'],
        ['included', 'Included in the rent']
      ]) +
      a('billsNote', 'Anything else about bills (optional)') +
      '</div>' +
      '<h3 class="tah">6. Deposit</h3><div class="grid">' +
      i('deposit', 'Deposit (£). Leave blank if none', '', 'number') +
      s('depHold', 'How the deposit is held', [
        ['landlord', 'Held by the landlord'],
        ['scheme', 'Protected in a deposit scheme (your choice, not required)']
      ]) +
      s('scheme', 'Deposit scheme, if you use one', [
        ['', 'None'],
        ['DPS', 'Deposit Protection Service (DPS)'],
        ['mydeposits', 'mydeposits'],
        ['TDS', 'Tenancy Deposit Scheme (TDS)']
      ]) +
      '</div>' +
      '<h3 class="tah">7. Safety documents</h3><div class="grid">' +
      s('gas', 'Is there a gas supply or gas appliance?', [
        ['yes', 'Yes'],
        ['', 'No']
      ]) +
      i('epc', 'EPC rating and date given') +
      i('gsr', 'Gas safety record date given') +
      i('eicr', 'Electrical report (EICR) date given') +
      '</div>' +
      '<h3 class="tah">8. Extra terms</h3><p class="muted" style="font-size:12px;margin:0 0 6px">Choose a ready-made term and press Add. You can then change its title and wording. Each one is added to the agreement as its own numbered term.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px"><select id="clPick" aria-label="Ready-made terms" style="flex:1;min-width:200px">' +
      CL_TERMS.map(function (t, n) {
        return '<option value="' + n + '">' + esc(t[0]) + '</option>';
      }).join('') +
      '</select><button type="button" class="btn" data-cladd="1">Add term</button></div>' +
      '<div id="clTerms">' +
      (d.terms || []).map(clTermRow).join('') +
      '</div>' +
      '</div><div class="dcprev"><div class="muted" style="font-size:12px;margin-bottom:6px">Preview</div><div id="taPrev"></div></div></div>' +
      '<div class="mkact dcact"><button type="button" class="btn" data-tasave="1">Save details</button><button type="button" class="btn ghost" data-tapdf="dl">Download PDF</button><button type="button" class="btn ghost" data-tapdf="share">Share</button><button type="button" class="btn ghost" data-taprint="1">Print</button></div>',
    true
  );
  taPreview();
}
function clBlocks(d) {
  var L = lines(d.landlords),
    Gs = lines(d.guarantor),
    Oc = lines(d.occupiers),
    B = [],
    n = 0,
    m = 0,
    one = function (x) {
      return String(x || '').replace(/\s*\n\s*/g, ', ');
    };
  var h = function (t) {
      n++;
      m = 0;
      B.push({ h: n + '. ' + t });
    },
    c = function (t) {
      m++;
      B.push({ p: n + '.' + m + '  ' + t });
    },
    kv = function (r) {
      B.push({
        kv: r.filter(function (x) {
          return x[1];
        })
      });
    };
  var co = String(d.coName || '').trim() || 'The tenant company',
    per = CL_PER[d.freq] || 'month',
    fixed = d.termType !== 'periodic',
    mo = Math.round(+d.termMonths) || 0,
    end = fixed ? clEnd(d.start, mo) : '',
    nt = +d.notice || 2,
    ntx = nt + ' month' + (nt > 1 ? 's' : '') + '’';
  B.push({ title: 'Company Let Tenancy Agreement' });
  B.push({
    sub: 'A tenancy of a home let to a company. Because the tenant is a company and not an individual, this is not an assured tenancy under the Housing Act 1988. For a property in England.'
  });
  h('The landlord, the tenant and the guarantor');
  kv([
    ['Landlord' + (L.length > 1 ? 's' : ''), L.join(', ')],
    ['Address for serving notices on the landlord', one(d.noticeAddr)],
    ['Landlord phone', d.llPhone],
    ['Landlord email', d.llEmail],
    ['Letting agent', d.agent],
    ['Tenant', co],
    ['Company registration number', d.coNo],
    ['Registered office', one(d.coAddr)],
    ['Signing for the tenant', d.coSign],
    ['Guarantor' + (Gs.length > 1 ? 's' : ''), Gs.join('; ')]
  ]);
  c(
    'In this agreement “the landlord” includes whoever owns the landlord’s interest in the property in future, and “the tenant” means the company named above.'
  );
  if (L.length > 1)
    c(
      'Where there is more than one landlord, they act together, and a notice given to any one of them is given to all.'
    );
  h('The property');
  kv([
    ['Property address', one(d.property)],
    ['Included', d.included]
  ]);
  c('The landlord lets the property to the tenant for the term and at the rent set out in this agreement.');
  h('Who may live at the property');
  kv([
    [
      'Permitted occupiers',
      Oc.join(', ') ||
        'The employees or officers of the tenant whose names the tenant gives the landlord in writing'
    ],
    ['Most people allowed to live there', d.maxOcc]
  ]);
  c(
    'The property is let only as a private home for the permitted occupiers, who are employees, officers or guests of the tenant. The tenant will not use it, or let it be used, for any other purpose.'
  );
  c(
    'The permitted occupiers live at the property with the tenant’s permission only. They are not tenants, they do not pay rent to the landlord, and they have no right to stay once this tenancy has ended.'
  );
  c(
    'Before any adult moves in, the tenant will give the landlord that person’s full name in writing and whatever the landlord needs to carry out any right to rent check the law requires.'
  );
  c(
    'The tenant is responsible for everything the occupiers and their visitors do or fail to do at the property, as if the tenant had done it itself.'
  );
  c(
    'The tenant will not sublet the property or any part of it, transfer this tenancy, take in lodgers or paying guests, or charge an occupier rent in a way that would create a tenancy, without the landlord’s written consent.'
  );
  h('The term');
  if (fixed) {
    c(
      'The tenancy starts on ' +
        (d.start ? fd(d.start) : '____________') +
        ' and runs for a fixed term of ' +
        (mo || '____') +
        ' month' +
        (mo === 1 ? '' : 's') +
        ', ending on ' +
        (end ? fd(end) : '____________') +
        '.'
    );
    c(
      'If the tenant stays at the property after the fixed term with the landlord’s agreement, and no new agreement has been signed, the tenancy carries on from ' +
        per +
        ' to ' +
        per +
        ' on the same terms. Either side may then end it by giving the other at least ' +
        ntx +
        ' notice in writing, ending on the last day of a rent period.'
    );
  } else {
    c(
      'The tenancy starts on ' +
        (d.start ? fd(d.start) : '____________') +
        ' and runs from ' +
        per +
        ' to ' +
        per +
        ' until it is ended by notice.'
    );
    c(
      'Either side may end the tenancy by giving the other at least ' +
        ntx +
        ' notice in writing, ending on the last day of a rent period.'
    );
  }
  h('Rent');
  kv([
    ['Rent', (+d.rent ? gbp(+d.rent) : '£________') + ' a ' + per],
    [
      'Due',
      d.rentDay
        ? /^\d+$/.test(String(d.rentDay).trim())
          ? 'On day ' + String(d.rentDay).trim() + ' of each ' + per
          : 'Each ' + String(d.rentDay).trim()
        : 'In advance on the first day of each ' + per
    ],
    ['How to pay', d.rentHow || 'By bank transfer to the account the landlord gives the tenant in writing']
  ]);
  c(
    'The tenant will pay the rent in advance on the due date, in full and without any deduction or set-off, whether or not the landlord has asked for it. The first payment is due on the start date.'
  );
  c(
    fixed
      ? 'The rent stays the same during the fixed term unless an extra term of this agreement says otherwise. If the tenancy carries on after the fixed term, the landlord may change the rent by giving the tenant at least 2 months’ notice in writing, not more than once in any 12 months.'
      : 'The landlord may change the rent by giving the tenant at least 2 months’ notice in writing, not more than once in any 12 months. If the tenant does not accept the new rent it may end the tenancy by notice.'
  );
  h('Bills');
  if (d.bills === 'included')
    c(
      'The rent includes council tax and the charges for gas, electricity, water and sewerage used at the property in a normal way for a home. The tenant pays for telephone, broadband and the TV licence unless the landlord has agreed otherwise in writing.'
    );
  else
    c(
      'From the start date until the tenancy ends, the tenant will pay the council tax and all charges for gas, electricity, water and sewerage, telephone, broadband and the TV licence for the property, directly to the council or supplier, and will put the accounts in its own name or the name of an occupier.'
    );
  if (String(d.billsNote || '').trim()) c(String(d.billsNote).trim());
  h('Deposit');
  if (+d.deposit > 0) {
    kv([
      ['Deposit', gbp(+d.deposit)],
      [
        'Held by',
        d.depHold === 'scheme'
          ? 'The landlord, protected with ' + (d.scheme || 'a government-approved deposit scheme')
          : 'The landlord'
      ]
    ]);
    c(
      'The tenant will pay the deposit on or before the start date. The landlord holds it as security for the rent and for the tenant keeping to this agreement. No interest is paid on it.'
    );
    c(
      d.depHold === 'scheme'
        ? 'The law does not require this deposit to be protected in a government-approved scheme, because this is not an assured tenancy. The landlord has chosen to protect it in the scheme named above, and the rules of that scheme will apply to it.'
        : 'The law does not require this deposit to be protected in a government-approved scheme, because this is not an assured tenancy. The landlord will keep it safe and account for it to the tenant.'
    );
    c(
      'Within 28 days after the tenancy ends and the property and all keys have been given back, the landlord will return the deposit to the tenant, less any unpaid rent or bills, the reasonable cost of repairing damage beyond fair wear and tear, of cleaning the property to its standard at the start, of replacing missing items, and any other sum the tenant owes under this agreement. The landlord will give the tenant a written list of anything deducted.'
    );
    c(
      'The tenant may not treat the deposit as payment of rent. If the landlord properly takes money from the deposit during the tenancy, the tenant will top it up within 14 days of being asked.'
    );
  } else c('No deposit is taken for this tenancy.');
  h('What the tenant agrees to do');
  [
    'Pay the rent, and the bills it is responsible for, on time.',
    'Keep the inside of the property, and the landlord’s fixtures, fittings and contents, clean and in the condition they were in at the start, apart from fair wear and tear and damage the landlord must repair.',
    'Tell the landlord promptly in writing about any damage, disrepair, leak, damp, pest or safety problem at the property.',
    'Not make any alteration or addition to the property, redecorate it, or change the locks, without the landlord’s written consent.',
    'Not use the property, or allow it to be used, for any business (other than ordinary home working by an occupier), for anything illegal, or in a way that causes a nuisance or annoyance to neighbours.',
    'Not do anything that makes the landlord’s insurance invalid or more expensive, once the landlord has told the tenant what the policy requires.',
    'Test the smoke and carbon monoxide alarms regularly, replace their batteries when needed, and tell the landlord at once if an alarm does not work.',
    'Let the landlord, and anyone acting for the landlord, into the property at reasonable times of day to inspect it, carry out repairs or safety checks, or (in the last 2 months of the tenancy) show it to new tenants or buyers. The landlord will give at least 24 hours’ notice in writing, except in an emergency.',
    'When the tenancy ends, make sure every occupier has left, and give the property back empty of people and belongings, clean, and with all keys.',
    'Pay the reasonable costs the landlord properly incurs because the tenant has broken this agreement, including the cost of recovering rent and of any notice or court proceedings.'
  ].forEach(c);
  h('What the landlord agrees to do');
  [
    'Let the tenant and the permitted occupiers have the property without interruption from the landlord, as long as the tenant pays the rent and keeps to this agreement.',
    'Keep in repair the structure and outside of the property, and keep in repair and working order the installations for water, gas, electricity, sanitation, room heating and hot water, as section 11 of the Landlord and Tenant Act 1985 requires. The landlord need not repair damage caused by the tenant or the occupiers, other than through fair wear and tear.',
    'Keep the property fit for people to live in during the tenancy, so far as section 9A of the Landlord and Tenant Act 1985 applies.',
    'Carry out the gas safety checks, electrical safety inspections and smoke and carbon monoxide alarm duties that the law puts on a landlord of a home, and give the tenant copies of the records.',
    'Insure the building (unless a superior landlord does so). The landlord does not insure the belongings of the tenant or the occupiers.'
  ].forEach(c);
  h('Ending the tenancy');
  c(
    'The landlord may end this tenancy early, by going back into the property under a court order (forfeiture), if any of these happens: (a) any rent is unpaid 14 days after it was due, whether or not it has been formally demanded; (b) the tenant has seriously or repeatedly broken this agreement; (c) the tenant goes into liquidation or administration, has a receiver appointed, makes an arrangement with its creditors, is struck off the register of companies or stops carrying on business. This does not affect any other claim the landlord has against the tenant.'
  );
  c(
    'While anyone is living at the property the landlord will not take the property back without a court order. A notice to quit given by the landlord will be in writing, will give at least 4 weeks, and will contain the information the law requires.'
  );
  c(
    'If the tenant or any occupier stays at the property after the tenancy has ended, the tenant will pay the landlord a sum equal to the rent for each day until the property is given back, as well as any loss this causes the landlord.'
  );
  c(
    'Anything left at the property when the tenancy ends may be removed by the landlord. The landlord will tell the tenant in writing and keep the items for 14 days, after which it may dispose of them, and the tenant will pay the reasonable cost of removal and storage.'
  );
  if (Gs.length) {
    h('Guarantee');
    c(
      'In return for the landlord granting this tenancy, the guarantor guarantees that the tenant will pay the rent and keep to this agreement. If the tenant does not pay any rent or other sum when it is due, the guarantor will pay it to the landlord on written demand, and will make good any loss the landlord suffers because the tenant has broken this agreement.'
    );
    c(
      'The guarantee lasts for the whole of the tenancy, including any time it carries on after the fixed term and any time the tenant or an occupier stays after it ends. The guarantor is not released because the landlord gives the tenant extra time, does not enforce a term straight away, or agrees a change to this agreement that does not make the guarantor’s position materially worse.'
    );
    c(
      'If the tenant is wound up or dissolved, or a liquidator disclaims this agreement, the guarantor remains liable for all sums due up to the date the landlord gets the property back.'
    );
    if (Gs.length > 1)
      c(
        'Where there is more than one guarantor, each is liable for the whole amount, individually and together.'
      );
    c('The guarantor has been advised to take independent legal advice before signing.');
  }
  var X = (d.terms || []).filter(function (t) {
    return String(t.x || '').trim();
  });
  if (X.length) {
    h('Extra terms');
    X.forEach(function (t) {
      c(
        (String(t.t || '').trim() ? String(t.t).trim() + '. ' : '') +
          String(t.x)
            .trim()
            .replace(/\s*\n\s*/g, ' ')
      );
    });
    c('If an extra term conflicts with another part of this agreement, the extra term applies.');
  }
  h('Notices and general terms');
  c(
    'Notices under this agreement must be in writing. The tenant may serve notices (including notices in proceedings) on the landlord at the address given in section 1. The landlord may serve notices on the tenant at its registered office or at the property. Notices may also be sent by email where both sides have agreed to this in writing.'
  );
  c(
    'This agreement is the whole agreement between the landlord and the tenant about the property. It can only be changed in writing signed by both of them.'
  );
  c(
    'Only the landlord, the tenant and any guarantor may enforce this agreement. The occupiers and other third parties have no right to enforce it under the Contracts (Rights of Third Parties) Act 1999.'
  );
  c('The tenant is responsible for any stamp duty land tax due on this tenancy.');
  c(
    'This agreement is governed by the law of England and Wales, and the courts of England and Wales will deal with any dispute about it.'
  );
  B.push({ h: 'Documents given to the tenant' });
  kv([
    ['Energy Performance Certificate', d.epc || 'To be given'],
    ['Gas safety record', d.gas ? (d.gsr ? 'Dated ' + d.gsr : 'To be given') : 'Not applicable'],
    ['Electrical installation condition report', d.eicr ? 'Dated ' + d.eicr : 'To be given']
  ]);
  B.push({
    sig: {
      landlords: L.length ? L : ['Landlord'],
      tenants: [
        co +
          (String(d.coSign || '').trim()
            ? ' (by ' + String(d.coSign).trim() + ')'
            : ' (by a director or authorised signatory)')
      ],
      guarantors: Gs.map(function (g) {
        return g.split(',')[0];
      })
    }
  });
  return B;
}
function taDefaults(c, tn) {
  var p = profA(),
    ap = tn
      ? (tn.people || []).filter(function (a) {
          return a.name;
        })
      : (c.applicants || []).filter(function (a) {
          return a.name;
        }),
    G = function (k) {
      return tn && tfv(tn, k) !== '' ? tfv(tn, k) : fv(c, k);
    };
  return {
    landlords: BIZ.owner || p.name || bizName(),
    noticeAddr: BIZ.address || '',
    llPhone: BIZ.phone || '',
    llEmail: BIZ.email || '',
    agent: fv(c, 'agent') || '',
    tenants:
      tn && tnCorp(tn) && String(tn.company || '').trim()
        ? String(tn.company).trim() + (tn.companyNo ? ' (company number ' + tn.companyNo + ')' : '')
        : ap
            .map(function (a) {
              return a.name;
            })
            .join('\n'),
    property: paddr(c) || '',
    included: '',
    start: G('tenancyStart') || '',
    rent: G('rent') || '',
    freq: G('rentFreq') || 'Monthly',
    rentDay: G('rentDay') || '',
    rentHow: '',
    billsIn: {},
    billsOut: { councilTax: 1, gas: 1, electricity: 1, water: 1, broadband: 1, tv: 1 },
    billsNote: 'The tenant arranges and pays these bills directly to the supplier when they are due.',
    deposit: G('deposit') || '',
    scheme: G('depositScheme') || '',
    tenantNotice: '2 months',
    grounds: {},
    otherGrounds: '',
    gas: fv(c, 'gsrDate') ? 'yes' : '',
    improve: 'yes',
    supported: '',
    supportedWhy: '',
    extra: '',
    epc: [fv(c, 'epcRating'), fv(c, 'epcDate') ? fd(fv(c, 'epcDate')) : ''].filter(Boolean).join(', issued '),
    gsr: fv(c, 'gsrDate') ? fd(fv(c, 'gsrDate')) : '',
    eicr: fv(c, 'eicrDate') ? fd(fv(c, 'eicrDate')) : ''
  };
}
function taRenew(d, old) {
  var ns = iso(TODAY),
    from = d.start || '';
  if (d.kind === 'company' && from && +d.termMonths) {
    var e = new Date(from + 'T12:00:00');
    e.setMonth(e.getMonth() + +d.termMonths);
    var en = iso(e);
    if (en > ns) ns = en;
  }
  d.start = ns;
  var note =
    'This agreement renews the earlier agreement' +
    (from ? ' that started on ' + fd(from) : '') +
    '. The terms continue from the new start date above unless this agreement says otherwise.';
  if (d.kind === 'company')
    d.terms = [{ t: 'Renewal', x: note }].concat(
      (d.terms || []).filter(function (t) {
        return t.t !== 'Renewal';
      })
    );
  else d.extra = (note + '\n' + String(d.extra || '').replace(/^This agreement renews[^\n]*\n?/, '')).trim();
  return d;
}
function taOpen(caseId, tnId, renew) {
  var c = cases.filter(function (x) {
    return x.id === caseId;
  })[0];
  if (!c) return;
  taCase = caseId;
  taTn = tnId || null;
  var tn = tnId
    ? tnList(c).filter(function (x) {
        return x.id === tnId;
      })[0]
    : null;
  if (tn && tnCorp(tn)) {
    var ag = tn.agreement && tn.agreement.kind === 'company' ? tn.agreement : {};
    var dd = Object.assign(clDefaults(c, tn), ag);
    clLetRender(renew ? taRenew(dd) : dd);
    return;
  }
  var d = Object.assign(
    taDefaults(c, tn),
    tn ? (tn.agreement && tn.agreement.kind !== 'company' && tn.agreement) || {} : c.tenancyDoc || {}
  );
  taRender(renew ? taRenew(d) : d);
}
function taRender(d) {
  var i = function (k, l, ph, type) {
    return (
      '<label class="f">' +
      l +
      '<input id="ta-' +
      k +
      '" type="' +
      (type || 'text') +
      '" value="' +
      esc(d[k] == null ? '' : d[k]) +
      '" placeholder="' +
      esc(ph || '') +
      '"></label>'
    );
  };
  var a = function (k, l, ph, rows) {
    return (
      '<label class="f wide">' +
      l +
      '<textarea id="ta-' +
      k +
      '" rows="' +
      (rows || 2) +
      '" placeholder="' +
      esc(ph || '') +
      '">' +
      esc(d[k] || '') +
      '</textarea></label>'
    );
  };
  var s = function (k, l, opts) {
    return (
      '<label class="f">' +
      l +
      '<select id="ta-' +
      k +
      '">' +
      opts
        .map(function (o) {
          return (
            '<option value="' +
            esc(o[0]) +
            '"' +
            (String(d[k]) === o[0] ? ' selected' : '') +
            '>' +
            esc(o[1]) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>'
    );
  };
  var cb = function (grp, k, l) {
    return (
      '<label class="tacb"><input type="checkbox" data-tagrp="' +
      grp +
      '" data-tak="' +
      k +
      '"' +
      (d[grp] && d[grp][k] ? ' checked' : '') +
      '> ' +
      esc(l) +
      '</label>'
    );
  };
  overlay(
    'taOv',
    '<div class="dhd"><h2>Tenancy agreement</h2><button type="button" class="btn ghost" data-taclose="1">Close</button></div>' +
      '<p class="dnote">This is a template to help you, not legal advice. It follows the GOV.UK guidance on the written information landlords in England must give tenants from 1 May 2026. Check it against the latest guidance, or ask a solicitor or landlord association, before you use it. It is for England only.</p>' +
      '<div class="dcgrid"><div class="dcform">' +
      '<h3 class="tah">1. Landlord and tenants</h3><div class="grid">' +
      a('landlords', 'Landlord name(s), one per line') +
      a('noticeAddr', 'Address in England or Wales where tenants can serve notices on you') +
      i('llPhone', 'Landlord phone (optional)') +
      i('llEmail', 'Landlord email (optional)', '', 'email') +
      i('agent', 'Letting agent (if any)') +
      a('tenants', 'Tenant name(s), one per line. Include every joint tenant') +
      '</div>' +
      '<h3 class="tah">2. Property and start</h3><div class="grid">' +
      a('property', 'Property address') +
      a(
        'included',
        'What is included (furniture, parking, garden, shared areas)',
        'For example: furnished as per the inventory; parking space 3'
      ) +
      i('start', 'Tenancy start date', '', 'date') +
      '</div>' +
      '<h3 class="tah">3. Rent</h3><div class="grid">' +
      i('rent', 'Rent (£)', '', 'number') +
      s('freq', 'Rent period', [
        ['Monthly', 'Monthly'],
        ['Weekly', 'Weekly'],
        ['Every 4 weeks', 'Every 4 weeks'],
        ['Quarterly', 'Quarterly']
      ]) +
      i('rentDay', 'Rent due on (day of the month, or the day of the week)', '1') +
      a(
        'rentHow',
        'How the tenant pays rent',
        'For example: bank transfer to the account the landlord gives in writing'
      ) +
      '</div><div id="taDepWarn"></div>' +
      '<h3 class="tah">4. Bills</h3><p class="muted" style="font-size:12px;margin:0 0 4px">You can only ask tenants to pay council tax, utilities, TV licence, communications services and Green Deal charges.</p><div class="tacbs"><b>Included in the rent:</b>' +
      TA_BILLS.map(function (b) {
        return cb('billsIn', b[0], b[1]);
      }).join('') +
      '</div><div class="tacbs"><b>Tenant pays separately:</b>' +
      TA_BILLS.map(function (b) {
        return cb('billsOut', b[0], b[1]);
      }).join('') +
      '</div><div class="grid">' +
      a(
        'billsNote',
        'For bills the tenant pays separately: how much and when (or how and when you will tell them)'
      ) +
      '</div>' +
      '<h3 class="tah">5. Deposit</h3><div class="grid">' +
      i('deposit', 'Deposit (£). Leave blank if none', '', 'number') +
      s('scheme', 'Deposit scheme', [
        ['', 'Not chosen yet'],
        ['DPS', 'Deposit Protection Service (DPS)'],
        ['mydeposits', 'mydeposits'],
        ['TDS', 'Tenancy Deposit Scheme (TDS)']
      ]) +
      '</div>' +
      '<h3 class="tah">6. Ending the tenancy</h3><div class="grid">' +
      s('tenantNotice', 'Notice the tenant must give', [
        ['2 months', '2 months (the maximum)'],
        ['1 month', '1 month'],
        ['4 weeks', '4 weeks']
      ]) +
      '</div><div class="tacbs"><b>Grounds you may rely on that need telling the tenant now (leave unticked if unsure):</b>' +
      cb('grounds', '4A', 'Ground 4A (student house shares)') +
      cb('grounds', '18', 'Ground 18 (supported accommodation)') +
      '</div><div class="grid">' +
      i('otherGrounds', 'Any other prior-notice grounds (2ZA to 2ZD, 4, 5 to 5H)', 'Leave blank if none') +
      '</div>' +
      '<h3 class="tah">7. Safety and the home</h3><div class="grid">' +
      s('gas', 'Is there a gas supply or gas appliance?', [
        ['yes', 'Yes'],
        ['', 'No']
      ]) +
      s('improve', 'May the tenant make improvements with your permission?', [
        ['yes', 'Yes'],
        ['', 'No']
      ]) +
      s('supported', 'Is this supported accommodation?', [
        ['', 'No'],
        ['yes', 'Yes']
      ]) +
      a('supportedWhy', 'If supported accommodation: why it meets that definition') +
      i('epc', 'EPC rating and date given') +
      i('gsr', 'Gas safety record date given') +
      i('eicr', 'Electrical report (EICR) date given') +
      '</div>' +
      '<h3 class="tah">8. Other terms (optional)</h3><div class="grid">' +
      a(
        'extra',
        'Extra terms, one per line. Do not add a fixed term, a rent review clause or fees the Tenant Fees Act bans.',
        '',
        3
      ) +
      '</div>' +
      '</div><div class="dcprev"><div class="muted" style="font-size:12px;margin-bottom:6px">Preview</div><div id="taPrev"></div></div></div>' +
      '<div class="mkact dcact"><button type="button" class="btn" data-tasave="1">Save details</button><button type="button" class="btn ghost" data-tapdf="dl">Download PDF</button><button type="button" class="btn ghost" data-tapdf="share">Share</button><button type="button" class="btn ghost" data-taprint="1">Print</button></div>',
    true
  );
  taPreview();
}
function taRead() {
  var d = {};
  document.querySelectorAll('#taOv [id^="ta-"]').forEach(function (e) {
    d[e.id.slice(3)] = e.value;
  });
  if ($('#clTerms')) {
    d.terms = [];
    document.querySelectorAll('#clTerms .clterm').forEach(function (r) {
      d.terms.push({
        t: r.querySelector('[data-clt="t"]').value.trim(),
        x: r.querySelector('[data-clt="x"]').value
      });
    });
  }
  ['billsIn', 'billsOut', 'grounds'].forEach(function (g) {
    d[g] = {};
  });
  document.querySelectorAll('#taOv [data-tagrp]').forEach(function (e) {
    if (e.checked) d[e.getAttribute('data-tagrp')][e.getAttribute('data-tak')] = 1;
  });
  return d;
}
function lines(s) {
  return String(s || '')
    .split('\n')
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);
}
function taBlocks(d) {
  if (d.kind === 'company') return clBlocks(d);
  var L = lines(d.landlords),
    Tn = lines(d.tenants),
    B = [],
    h = function (t) {
      B.push({ h: t });
    },
    p = function (t) {
      B.push({ p: t });
    },
    kv = function (r) {
      B.push({
        kv: r.filter(function (x) {
          return x[1];
        })
      });
    },
    li = function (arr) {
      B.push({ li: arr });
    };
  var billName = function (k) {
    return (TA_BILLS.filter(function (b) {
      return b[0] === k;
    })[0] || ['', k])[1];
  };
  B.push({ title: 'Assured Periodic Tenancy Agreement' });
  B.push({
    sub: 'including the written statement of terms (Housing Act 1988, section 16D). For a property in England.'
  });
  h('1. The landlord and the tenant');
  kv([
    ['Landlord' + (L.length > 1 ? 's' : ''), L.join(', ')],
    ['Address for serving notices on the landlord', String(d.noticeAddr || '').replace(/\s*\n\s*/g, ', ')],
    ['Landlord phone', d.llPhone],
    ['Landlord email', d.llEmail],
    ['Letting agent', d.agent],
    ['Tenant' + (Tn.length > 1 ? 's' : ''), Tn.join(', ')]
  ]);
  if (Tn.length > 1)
    p(
      'Where there is more than one tenant, each tenant is responsible both individually and together for keeping to this agreement, including paying the whole rent.'
    );
  h('2. The property');
  kv([
    ['Property address', String(d.property || '').replace(/\s*\n\s*/g, ', ')],
    ['Included', d.included]
  ]);
  h('3. Type of tenancy and start date');
  p(
    'This is an assured periodic tenancy under the Housing Act 1988, as amended by the Renters’ Rights Act 2025. It has no fixed end date. It continues from one rent period to the next until it is ended in a way the law allows.'
  );
  kv([
    ['Start date (when the tenant is first entitled to possession)', d.start ? fd(d.start) : ''],
    ['Rent period', d.freq]
  ]);
  h('4. Rent');
  kv([
    [
      'Rent',
      d.rent
        ? gbp(d.rent) +
          ' ' +
          ({
            'Monthly': 'per month',
            'Weekly': 'per week',
            'Every 4 weeks': 'every 4 weeks',
            'Quarterly': 'per quarter'
          }[d.freq] || '')
        : ''
    ],
    [
      'Rent is due',
      d.rentDay
        ? /^\d+$/.test(String(d.rentDay))
          ? 'on day ' + d.rentDay + ' of each ' + (d.freq === 'Weekly' ? 'week' : 'month')
          : String(d.rentDay)
        : ''
    ],
    ['How to pay', d.rentHow]
  ]);
  p(
    'Rent increases: if the landlord proposes a rent increase, the landlord will serve a notice on the tenant in accordance with section 13 of the Housing Act 1988.'
  );
  h('5. Bills');
  var bin = Object.keys(d.billsIn || {}),
    bout = Object.keys(d.billsOut || {}).filter(function (k) {
      return !(d.billsIn || {})[k];
    });
  p(
    bin.length
      ? 'The rent includes: ' + bin.map(billName).join(', ') + '.'
      : 'The rent does not include any bills.'
  );
  if (bout.length) {
    p('The tenant pays these bills separately: ' + bout.map(billName).join(', ') + '.');
    if (d.billsNote) p(d.billsNote);
  }
  p(
    'The landlord will not require the tenant to pay any bill other than council tax, utilities, a TV licence, communications services or Green Deal charges.'
  );
  h('6. Deposit');
  if (+d.deposit > 0)
    p(
      'The tenant will pay a deposit of ' +
        gbp(d.deposit) +
        '. The landlord will protect it in a government-approved tenancy deposit scheme' +
        (d.scheme ? ' (' + d.scheme + ')' : '') +
        ' within 30 days of receiving it, and give the tenant the required information about the scheme within the same 30 days.'
    );
  else p('No deposit is taken.');
  h('7. The tenant ending the tenancy');
  p(
    'The tenant may end this tenancy by giving the landlord at least ' +
      (d.tenantNotice || '2 months') +
      '’ notice in writing. Any change to this notice period must be agreed in writing by all joint tenants, and it cannot be more than two months.'
  );
  h('8. The landlord ending the tenancy');
  p(
    'In most circumstances, the landlord can only end this tenancy by obtaining a court order for possession and having it enforced. Before going to court, the landlord (or one of the joint landlords) will usually need to serve a possession notice on the tenant. The notice must be in the correct form and must say which ground or grounds for possession the landlord is relying on. The minimum notice period depends on the ground or grounds used.'
  );
  p(
    'The only exception is where the Secretary of State has given the landlord written notice that the tenant is disqualified from renting because of their immigration status. In that case the landlord may give notice under the relevant immigration legislation instead.'
  );
  var gr = Object.keys(d.grounds || {})
    .map(function (g) {
      return 'Ground ' + g;
    })
    .concat(d.otherGrounds ? [d.otherGrounds] : []);
  if (gr.length)
    p(
      'Prior notice: the landlord tells the tenant now that possession may be sought on the following ground(s) in Schedule 2 to the Housing Act 1988: ' +
        gr.join('; ') +
        '.'
    );
  h('9. The landlord’s legal duties');
  p(
    'Fitness for human habitation: section 9A of the Landlord and Tenant Act 1985 requires the landlord to make sure the property is fit for human habitation, to the extent that section requires.'
  );
  p(
    'Repairs: section 11 of the Landlord and Tenant Act 1985 requires the landlord, to the extent that section applies:'
  );
  li([
    'to keep in repair the structure and exterior of the property;',
    'to keep in repair and proper working order the installations for the supply of water, gas and electricity and for sanitation;',
    'to keep in repair and proper working order the installations for space heating and heating water.'
  ]);
  p(
    'Any term that tries to take away these repair duties has no effect unless a county court has authorised it.'
  );
  p(
    'Electrical safety: regulation 3 of the Electrical Safety Standards in the Private Rented Sector and Social Rented Sector (England) Regulations 2020 requires the landlord to make sure the electrical safety standards are met while the property is occupied under this tenancy; to have the electrical installations inspected and tested by a qualified person at least every five years (or sooner if the last report says so); and to obtain a report of the results, including the date of the next inspection, and give a copy to the tenant.'
  );
  if (d.gas)
    p(
      'Gas safety: regulation 36 of the Gas Safety (Installations and Use) Regulations 1998 requires the landlord to keep every relevant gas fitting and flue in a safe condition; to have each appliance and flue checked for safety by a Gas Safe registered engineer at the intervals set under those Regulations (currently every 12 months); and to obtain a record of each check, including the date of the next check, and give a copy to each tenant.'
    );
  if (d.improve)
    p(
      'Adaptations for disability: under section 190 of the Equality Act 2010, where a disabled person lives in the property as their only or main home, the landlord must not unreasonably refuse consent to an improvement that would help them use and enjoy it. "Disabled person" is defined in section 6 and "improvement" in section 190(9) of that Act.'
    );
  h('10. Pets');
  p(
    'The tenant may keep a pet at the property if they ask for the landlord’s consent under section 16A of the Housing Act 1988 and the landlord consents. The landlord must not unreasonably refuse consent.'
  );
  if (d.supported) {
    h('11. Supported accommodation');
    p(
      'This tenancy is granted for supported accommodation.' +
        (d.supportedWhy ? ' The tenant’s occupation meets that definition because: ' + d.supportedWhy : '')
    );
  }
  h((d.supported ? '12' : '11') + '. Other terms of this agreement');
  li(
    [
      'The tenant will pay the rent, and any bills they are responsible for, on time.',
      'The tenant will take reasonable care of the property and its contents, and report repairs or problems to the landlord promptly.',
      'The tenant will not cause a nuisance or annoyance to neighbours.',
      'The landlord or someone acting for them may enter at reasonable times to inspect, carry out repairs or safety checks, after giving at least 24 hours’ notice in writing, except in an emergency.',
      'The tenant will not sublet or take in lodgers without the landlord’s written consent, which will not be unreasonably refused.',
      'The tenant will not make alterations without the landlord’s written consent.',
      'At the end of the tenancy the tenant will leave the property in the same condition as at the start, apart from fair wear and tear.',
      'The landlord will fit a working smoke alarm on each storey used as living accommodation and a carbon monoxide alarm in any room with a fixed combustion appliance (other than a gas cooker), check they work on the first day of the tenancy, and repair or replace them when told they are faulty.',
      'The landlord will not interfere with the tenant’s right to live in the property in peace.'
    ].concat(lines(d.extra))
  );
  h('Documents given to the tenant');
  kv([
    ['Energy Performance Certificate', d.epc || 'To be given'],
    ['Gas safety record', d.gas ? (d.gsr ? 'Dated ' + d.gsr : 'To be given') : 'Not applicable'],
    ['Electrical installation condition report', d.eicr ? 'Dated ' + d.eicr : 'To be given'],
    [
      'Deposit scheme information',
      +d.deposit > 0 ? 'Within 30 days of receiving the deposit' : 'Not applicable'
    ]
  ]);
  h('Notices');
  p(
    'The tenant may serve notices on the landlord at the address in section 1. The landlord may serve notices on the tenant at the property. Notices may also be sent by email where both sides have agreed to this in writing.'
  );
  B.push({ sig: { landlords: L.length ? L : ['Landlord'], tenants: Tn.length ? Tn : ['Tenant'] } });
  return B;
}
function taHtml(d) {
  return (
    '<div class="dpage ta">' +
    (okLogo(BIZ.logo) ? '<img class="dlogo" src="' + BIZ.logo + '" alt="" style="max-height:50px">' : '') +
    taBlocks(d)
      .map(function (b) {
        if (b.title) return '<div class="dbig" style="margin-top:6px">' + esc(b.title) + '</div>';
        if (b.sub) return '<div class="muted" style="margin-bottom:8px">' + esc(b.sub) + '</div>';
        if (b.h) return '<h4>' + esc(b.h) + '</h4>';
        if (b.p) return '<p>' + esc(b.p) + '</p>';
        if (b.li)
          return (
            '<ul>' +
            b.li
              .map(function (x) {
                return '<li>' + esc(x) + '</li>';
              })
              .join('') +
            '</ul>'
          );
        if (b.kv)
          return (
            '<table class="dkv">' +
            b.kv
              .map(function (r) {
                return '<tr><td>' + esc(r[0]) + '</td><td>' + nl2br(r[1]) + '</td></tr>';
              })
              .join('') +
            '</table>'
          );
        if (b.sig)
          return (
            '<h4>Signatures</h4>' +
            b.sig.landlords
              .map(function (n) {
                return (
                  '<div class="dsig"><span>Landlord: ' +
                  esc(n) +
                  '</span><span>Signed ____________________</span><span>Date __________</span></div>'
                );
              })
              .join('') +
            b.sig.tenants
              .map(function (n) {
                return (
                  '<div class="dsig"><span>Tenant: ' +
                  esc(n) +
                  '</span><span>Signed ____________________</span><span>Date __________</span></div>'
                );
              })
              .join('') +
            (b.sig.guarantors || [])
              .map(function (n) {
                return (
                  '<div class="dsig"><span>Guarantor: ' +
                  esc(n) +
                  '</span><span>Signed ____________________</span><span>Date __________</span></div>'
                );
              })
              .join('')
          );
        return '';
      })
      .join('') +
    '<div class="dfoot">Created with ' +
    esc((window.MD_CONFIG || {}).appName || 'MySimpleDesk') +
    ' on ' +
    fd(iso(TODAY)) +
    '. A template, not legal advice.</div></div>'
  );
}
function taPdf(d) {
  var P = new Pdf(),
    G = [0.35, 0.41, 0.47],
    A = [0.18, 0.29, 0.25];
  if (okLogo(BIZ.logo) && BIZ.logoW) {
    var s = Math.min(140 / BIZ.logoW, 45 / BIZ.logoH);
    P.image(BIZ.logo, BIZ.logoW, BIZ.logoH, 40, 36, BIZ.logoW * s, BIZ.logoH * s);
    P.y = 36 + BIZ.logoH * s + 12;
  }
  var para = function (t, size, bold, ind, rgb) {
    wrapT(t, 515 - (ind || 0), size, bold).forEach(function (x) {
      P.need(size + 4);
      P.t(40 + (ind || 0), P.y, x, size, bold, 'l', rgb);
      P.y += size + 3.5;
    });
  };
  taBlocks(d).forEach(function (b) {
    if (b.title) {
      P.t(40, P.y, b.title, 18, true, 'l', A);
      P.y += 24;
    } else if (b.sub) {
      para(b.sub, 9, false, 0, G);
      P.y += 6;
    } else if (b.h) {
      P.need(40);
      P.y += 6;
      P.t(40, P.y, b.h, 11, true, 'l', A);
      P.y += 16;
    } else if (b.p) {
      para(b.p, 9.5);
      P.y += 5;
    } else if (b.li) {
      b.li.forEach(function (x) {
        var ls = wrapT(x, 500, 9.5);
        P.need(ls.length * 13);
        P.t(44, P.y, '•', 9.5);
        ls.forEach(function (l) {
          P.t(55, P.y, l, 9.5);
          P.y += 13;
        });
      });
      P.y += 4;
    } else if (b.kv) {
      b.kv.forEach(function (r) {
        var lw = wrapT(r[0], 170, 9, true),
          vw = wrapT(r[1], 330, 9.5),
          n = Math.max(lw.length, vw.length);
        P.need(n * 13 + 4);
        lw.forEach(function (l, i) {
          P.t(40, P.y + i * 13, l, 9, true, 'l', G);
        });
        vw.forEach(function (l, i) {
          P.t(220, P.y + i * 13, l, 9.5);
        });
        P.y += n * 13 + 4;
      });
      P.y += 4;
    } else if (b.sig) {
      P.need(60);
      P.y += 8;
      P.t(40, P.y, 'Signatures', 11, true, 'l', A);
      P.y += 20;
      b.sig.landlords
        .map(function (n) {
          return 'Landlord: ' + n;
        })
        .concat(
          b.sig.tenants.map(function (n) {
            return 'Tenant: ' + n;
          })
        )
        .concat(
          (b.sig.guarantors || []).map(function (n) {
            return 'Guarantor: ' + n;
          })
        )
        .forEach(function (n) {
          P.need(40);
          P.t(40, P.y, n, 9.5, true);
          P.y += 22;
          P.line(40, P.y, 300, [0.3, 0.3, 0.3]);
          P.line(340, P.y, 555, [0.3, 0.3, 0.3]);
          P.y += 4;
          P.t(40, P.y, 'Signed', 7.5, false, 'l', G);
          P.t(340, P.y, 'Date', 7.5, false, 'l', G);
          P.y += 20;
        });
    }
  });
  return P.bytes(
    (d.kind === 'company' ? 'Company let tenancy agreement' : 'Assured periodic tenancy agreement') +
      ' · ' +
      String(d.property || '')
        .replace(/\s*\n\s*/g, ', ')
        .slice(0, 80) +
      ' · A template, not legal advice'
  );
}
function taPreview() {
  var d = taRead(),
    p = $('#taPrev');
  if (p) p.innerHTML = taHtml(d);
  var cw = $('#clWarn');
  if (cw) {
    var tm = +d.termMonths || 0;
    cw.innerHTML =
      d.termType !== 'periodic' && tm > 36
        ? '<p class="dnote">A term of more than 3 years must be made as a deed, and one of more than 7 years must be registered at the Land Registry. This template is for terms of up to 3 years. Ask a solicitor for a longer lease.</p>'
        : d.termType !== 'periodic' && d.start && tm > 0
          ? '<p class="muted" style="font-size:12px;margin:4px 0 0">The fixed term ends on ' +
            fd(clEnd(d.start, tm)) +
            '.</p>'
          : '';
  }
  var w = $('#taDepWarn');
  if (w) {
    var rent = +d.rent || 0,
      dep = +d.deposit || 0,
      yr = rent * ({ 'Monthly': 12, 'Weekly': 52, 'Every 4 weeks': 13, 'Quarterly': 4 }[d.freq] || 12),
      cap = r2((yr / 52) * (yr >= 50000 ? 6 : 5));
    w.innerHTML =
      dep && rent && dep > cap
        ? '<p class="dnote">The deposit is more than the legal maximum of ' +
          (yr >= 50000 ? 6 : 5) +
          ' weeks’ rent (' +
          gbp(cap) +
          ') under the Tenant Fees Act 2019.</p>'
        : '';
  }
}
function taSave(quiet) {
  var d = taRead();
  d.savedAt = Date.now();
  var c = cases.filter(function (x) {
    return x.id === taCase;
  })[0];
  if (!c) return d;
  if (taTn) {
    var nl = tnList(c).map(function (t) {
      return t.id === taTn ? Object.assign({}, t, { agreement: d }) : t;
    });
    patch(c.id, { tenancies: nl });
    if (openId === c.id && $('#caseForm'))
      setTimeout(function () {
        lastAuto = JSON.stringify(collectForm());
      }, 80);
    var bt = document.querySelector('[data-tnag="' + taTn + '"]');
    if (bt) bt.textContent = d.kind === 'company' ? 'Open company let agreement' : 'Open tenancy agreement';
  } else patch(c.id, { tenancyDoc: d });
  if (!quiet)
    toast(d.kind === 'company' ? 'Company let agreement details saved' : 'Tenancy agreement details saved');
  setTimeout(function () {
    if (openId) renderLive();
  }, 60);
  return d;
}

/* --- events --- */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var b, v;
  if (t.closest('[data-bizopen]')) {
    openBiz();
    return;
  }
  if (t.closest('[data-bzclose]') || t.id === 'bzOv') {
    closeOv('bzOv');
    return;
  }
  if (t.closest('[data-bzunlock]')) {
    if (window.CD_reGate && window.CD_reGate('biz')) openBiz();
    return;
  }
  if (t.closest('[data-bzsave]')) {
    bizSave();
    return;
  }
  if (t.closest('[data-bzlogodel]')) {
    bizDraftLogo = 'del';
    var lb = $('#bzLogoBox');
    if (lb) lb.innerHTML = '<span class="muted">Logo will be removed when you save</span>';
    return;
  }
  if ((b = t.closest('[data-dcnew]'))) {
    if (openId) dcOpen(openId, null, b.getAttribute('data-dcnew'));
    return;
  }
  if ((b = t.closest('[data-dcopen]'))) {
    v = b.getAttribute('data-dcopen').split('|');
    dcOpen(v[0], v[1]);
    return;
  }
  if (t.closest('[data-dcclose]') || t.id === 'dcOv') {
    closeOv('dcOv');
    return;
  }
  if (t.closest('[data-dladd]')) {
    dcRead();
    dcDoc.lines.push({ d: '', q: 1, p: '', v: vatOn() ? (BIZ.vatRate != null ? BIZ.vatRate : 20) : 0 });
    var tb = $('#dcLines');
    if (tb) tb.innerHTML = dcDoc.lines.map(dcLineRow).join('');
    dcPreview();
    return;
  }
  if ((b = t.closest('[data-dldel]'))) {
    dcRead();
    dcDoc.lines.splice(+b.getAttribute('data-dldel'), 1);
    if (!dcDoc.lines.length) dcDoc.lines.push({ d: '', q: 1, p: '', v: 0 });
    var tb2 = $('#dcLines');
    if (tb2) tb2.innerHTML = dcDoc.lines.map(dcLineRow).join('');
    dcPreview();
    return;
  }
  if (t.closest('[data-dcsave]')) {
    dcSave();
    return;
  }
  if ((b = t.closest('[data-dcpdf]'))) {
    var d1 = dcSave(true);
    if (!d1) return;
    fileOut(
      dcPdf(d1),
      (d1.kind === 'quote' ? 'Quote-' : 'Invoice-') +
        String(d1.number).replace(/[^A-Za-z0-9-]+/g, '') +
        '.pdf',
      b.getAttribute('data-dcpdf')
    );
    dcRender();
    return;
  }
  if (t.closest('[data-dcprint]')) {
    var d2 = dcSave(true);
    if (d2) {
      dcRender();
      printHtml(dcHtml(d2));
    }
    return;
  }
  if (t.closest('[data-dcconv]')) {
    var q = dcSave(true);
    if (!q) return;
    q.status = 'accepted';
    var cq = cases.filter(function (x) {
      return x.id === dcCase;
    })[0];
    if (cq)
      patch(cq.id, {
        docs: docsOf(cq).map(function (x) {
          return x.id === q.id ? Object.assign({}, x, { status: 'accepted' }) : x;
        })
      });
    dcOpen(dcCase, null, 'invoice', q);
    toast('Invoice started from quote ' + q.number + '. Check it, then Save.');
    return;
  }
  if ((b = t.closest('[data-dcdel]'))) {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Confirm delete';
      return;
    }
    var cd = cases.filter(function (x) {
      return x.id === dcCase;
    })[0];
    if (cd)
      patch(cd.id, {
        docs: docsOf(cd).filter(function (x) {
          return x.id !== dcDoc.id;
        })
      });
    closeOv('dcOv');
    toast('Deleted');
    setTimeout(function () {
      if (openId) renderLive();
      if (view === 'invoices') render();
    }, 60);
    return;
  }
  if ((b = t.closest('[data-ivf]'))) {
    ivFilter = b.getAttribute('data-ivf');
    render();
    return;
  }
  if ((b = t.closest('[data-taopen]'))) {
    taOpen(b.getAttribute('data-taopen'));
    return;
  }
  if (t.closest('[data-taclose]') || t.id === 'taOv') {
    closeOv('taOv');
    if ($('#gnOv')) setTimeout(gnAgSync, 150);
    return;
  }
  if (t.closest('[data-cladd]')) {
    var pk = $('#clPick'),
      ct = CL_TERMS[+pk.value] || CL_TERMS[0],
      bx = $('#clTerms');
    bx.insertAdjacentHTML('beforeend', clTermRow({ t: ct[1] ? ct[0] : '', x: ct[1] }));
    var nr = bx.lastElementChild;
    nr.scrollIntoView({ block: 'nearest' });
    nr.querySelector(ct[1] ? 'textarea' : 'input').focus();
    taPreview();
    return;
  }
  if ((b = t.closest('[data-clrm]'))) {
    b.closest('.clterm').remove();
    taPreview();
    return;
  }
  if (t.closest('[data-tasave]')) {
    taSave();
    return;
  }
  if ((b = t.closest('[data-tapdf]'))) {
    var td = taSave(true);
    fileOut(
      taPdf(td),
      (td.kind === 'company' ? 'Company-let-agreement-' : 'Tenancy-agreement-') +
        String(td.property || 'property')
          .split(/[\n,]/)[0]
          .replace(/[^A-Za-z0-9]+/g, '-')
          .slice(0, 40) +
        '.pdf',
      b.getAttribute('data-tapdf')
    );
    return;
  }
  if (t.closest('[data-taprint]')) {
    var td2 = taSave(true);
    printHtml(taHtml(td2));
    return;
  }
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('#dcOv')) dcPreview();
  else if (t.closest('#taOv')) taPreview();
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('#dcOv')) dcPreview();
  else if (t.closest('#taOv')) taPreview();
});
