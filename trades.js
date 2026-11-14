/* MySimpleDesk trade profiles.
   Each profile decides what a record is called, its stages, its fields, which dates
   are worked out automatically and which dates become reminders.

   Field: { k: key, l: label, t: type, o: options, w: 1 (full width), h: hint,
            auto: { from: key, m: months, d: days, eom: 1 } }
     types: text, money, num, pct, date, sel, area
     auto:  the date is worked out from another date until the user types their own.
            eom: if the source date is the last day of a month, use the last day of the target month.
   Reminder: { k: date key, l: label, only: [stage ids], unless: [keys that cancel it], ref: key, refL: label }
   Records are always kept separate per client. Never add fields for the data listed in dontRecord. */
(function () {
  'use strict';

  /* ---------- shared pieces ---------- */
  var JOB_STAGES = [
    { id: 'enquiry', label: 'Enquiry' }, { id: 'quote', label: 'Quote sent' }, { id: 'booked', label: 'Booked in' },
    { id: 'progress', label: 'In progress' }, { id: 'invoiced', label: 'Invoiced' }, { id: 'paid', label: 'Paid' }];
  var TRADE_APPTS = ['Site visit / quote', 'Job', 'Service', 'Inspection', 'Follow-up', 'Call', 'Other'];
  var TRADE_DONT = 'Do not type bank or card details, key safe or alarm codes, or anyone’s health details here.';
  function billing() {
    return { id: 'billing', title: 'Quote, invoice and payment', fields: [
      { k: 'quote', l: 'Quote (total)', t: 'money' },
      { k: 'deposit', l: 'Deposit', t: 'money' },
      { k: 'depositPaid', l: 'Deposit paid on', t: 'date' },
      { k: 'invoiceNo', l: 'Invoice number', t: 'text' },
      { k: 'invoiceAmount', l: 'Invoice amount', t: 'money' },
      { k: 'invoiceDate', l: 'Invoice date', t: 'date' },
      { k: 'payDue', l: 'Payment due (30 days after the invoice. You can change it)', t: 'date', auto: { from: 'invoiceDate', d: 30 } },
      { k: 'paidDate', l: 'Paid on', t: 'date' }] };
  }
  function siteSection(extra) {
    return { id: 'site', title: 'Job address and property', fields: [
      { k: 'jobAddress', l: 'Job address (if different from the customer address)', t: 'text', w: 1 },
      { k: 'propertyKind', l: 'Property', t: 'sel', o: ['', 'Owner occupied', 'Rented (landlord)', 'Commercial', 'New build'] },
      { k: 'landlord', l: 'Landlord or letting agent (name and phone)', t: 'text' },
      { k: 'access', l: 'Access notes (parking, pets, best times. No key safe codes)', t: 'text', w: 1 }].concat(extra || []) };
  }
  var PAY_REM = { k: 'payDue', l: 'Payment due', unless: ['paidDate'] };
  var JOB_COLS = [['type', 'Type'], ['stage', 'Stage'], ['quote', 'Quote'], ['task', 'Next task due'], ['review', 'Next key date'], ['note', 'Latest note']];

  function tradeMsgs(what) {
    return [
      { id: 'd1', title: 'Service reminder', subject: 'Your ' + what + ' is due', text: 'Hello{name},\n\nA quick reminder that your ' + what + ' is coming up. Reply to this message with a day and time that suits you and I will book you in.\n\nThank you.\n\n{sig}\n\n{foot}' },
      { id: 'd2', title: 'Quote follow-up', subject: 'Your quote', text: 'Hello{name},\n\nI am just following up on the quote I sent you. If you have any questions, or would like to go ahead, reply here or give me a call.\n\nThank you.\n\n{sig}\n\n{foot}' },
      { id: 'd3', title: 'Ask for a review', subject: 'How did we do?', text: 'Hello{name},\n\nThank you for choosing me for your recent job. If you were happy with the work, a short review would help my small business a great deal.\n\nThank you.\n\n{sig}\n\n{foot}' },
      { id: 'd4', title: 'Ask for a referral', subject: 'Could you help someone you know?', text: 'Hello{name},\n\nI hope all is well. If you know a friend, neighbour or family member who needs a reliable tradesperson, I would be grateful if you could pass on my details.\n\nThank you for your support.\n\n{sig}\n\n{foot}' }];
  }
  var FOOT = 'If you would rather not hear from me, just reply STOP.';

  /* ---------- the trades ---------- */
  var T = {};

  T.mortgage = {
    label: 'Mortgage adviser', noun: ['Case', 'Cases'], person: ['Applicant', 'Applicants'], peopleTitle: 'Applicants and residential address',
    dob: true, stages: [{ id: 'enquiry', label: 'Enquiry' }, { id: 'factfind', label: 'Fact find' }, { id: 'dip', label: 'AIP' }, { id: 'application', label: 'FMA' }, { id: 'offer', label: 'Offered' }, { id: 'completed', label: 'Completed' }],
    defaultStage: 'dip', doneStage: 'completed',
    types: ['Purchase', 'First-time buyer', 'Remortgage', 'Product transfer', 'Further advance', 'Buy to let', 'Other'],
    sections: [{ id: 'lender', title: 'Lender', fields: [
      { k: 'lender', l: 'Lender name', t: 'text' },
      { k: 'repayment', l: 'Repayment method', t: 'sel', o: [['repayment', 'Repayment'], ['interest-only', 'Interest only'], ['part-and-part', 'Part and part']] },
      { k: 'propertyAddress', l: 'Property address', t: 'text', w: 1 },
      { k: 'purchasePrice', l: 'Purchase price', t: 'money' }, { k: 'propertyValue', l: 'Valuation', t: 'money' },
      { k: 'loanAmount', l: 'Loan amount', t: 'money' }, { k: 'monthlyPayment', l: 'Monthly payment', t: 'money' },
      { k: 'termYears', l: 'Initial term (years)', t: 'num' }, { k: 'termLeft', l: 'Term left (years)', t: 'num' },
      { k: 'product', l: 'Product code', t: 'text' }, { k: 'rate', l: 'Initial rate (%)', t: 'num' },
      { k: 'followOnRate', l: 'Rate after (%)', t: 'num' }, { k: 'erc', l: 'Early repayment charge', t: 'text' },
      { k: 'fixedUntil', l: 'Initial deal ends', t: 'date' },
      { k: 'reviewDate', l: 'Mortgage review date (4 months before the initial deal ends. You can change it)', t: 'date', auto: { from: 'fixedUntil', m: -4 } },
      { k: 'lenderRef', l: 'Lender reference / roll number', t: 'text' }] }],
    reminders: [{ k: 'reviewDate', l: 'Start rate review', only: ['completed'], ref: 'fixedUntil', refL: 'Product ends' }],
    value: { k: 'loanAmount', l: 'Lending in progress' }, addr: 'propertyAddress', sub: 'lender', subRef: 'lenderRef', filter: { k: 'lender', l: 'lenders' },
    cols: [['type', 'Type'], ['stage', 'Stage'], ['lender', 'Lender'], ['task', 'Next task due'], ['review', 'Review date'], ['note', 'Latest note'], ['prot', 'Protection']],
    strip: [['ltv', 'LTV'], ['fixedUntil', 'Rate ends'], ['next', 'Review date']],
    apptTypes: ['Initial consultation', 'Fact-find', 'Document check', 'Mortgage review', 'Remortgage review', 'Offer or completion call', 'Follow-up', 'Other'],
    apptSubject: 'Mortgage appointment', taskHint: 'chase conveyancer',
    extraLog: { title: 'Protection notes', ph: 'Life cover, critical illness, income protection, buildings and contents: provider, cover, premium, review date' },
    securities: true, calculator: true, reviewWord: 'Review',
    dontRecord: 'Do not type NI numbers, bank details, passport numbers, income and expenditure, or health answers here.',
    msgFoot: 'Your home may be repossessed if you do not keep up repayments on your mortgage.\n' + FOOT,
    msgs: [
      { id: 'd1', title: 'Home purchase', subject: 'Helping with your home purchase', text: 'Hello{name},\n\nIf you are thinking about buying a home, whether it is your first or your next, I would be glad to help with your options, what you may be able to borrow, and each step from start to finish.\n\nThere is no obligation. Just reply or call me for a friendly chat.\n\n{sig}\n\n{foot}' },
      { id: 'd2', title: 'Remortgage', subject: 'Is your mortgage deal ending soon?', text: 'Hello{name},\n\nIf your fixed rate or mortgage deal ends in the next 6 to 12 months, now is a good time to look at your options. If you do nothing, you may move onto your lender’s standard variable rate, which is often higher.\n\nI would be happy to review your mortgage with you. There is no obligation.\n\n{sig}\n\n{foot}' },
      { id: 'd3', title: 'Ask for a referral', subject: 'Could you help someone you know?', text: 'Hello{name},\n\nDo you know a family member, friend or colleague who is looking to buy a home or remortgage? If so, I would be grateful if you could pass on my details.\n\nThank you for your support.\n\n{sig}\n\n{foot}' },
      { id: 'd4', title: 'Gentle follow-up', subject: 'Just following up', text: 'Hello{name},\n\nJust a quick note after my last message, in case it got lost. If a home purchase or remortgage is on your mind, I am happy to chat whenever suits you.\n\n{sig}\n\n{foot}' }]
  };

  T.accountant = {
    label: 'Accountant or bookkeeper', noun: ['Client', 'Clients'], person: ['Contact', 'Contacts'], peopleTitle: 'Client contacts',
    dob: true, stages: [{ id: 'enquiry', label: 'Enquiry' }, { id: 'proposal', label: 'Proposal sent' }, { id: 'onboarding', label: 'Onboarding (ID and engagement letter)' }, { id: 'active', label: 'Active client' }],
    defaultStage: 'enquiry', doneStage: 'active',
    types: ['Self Assessment', 'Sole trader accounts', 'Partnership accounts', 'Limited company accounts', 'Landlord / property income', 'VAT returns', 'Payroll', 'Bookkeeping', 'CIS', 'Other'],
    sections: [
      { id: 'business', title: 'Business', fields: [
        { k: 'bizName', l: 'Business or trading name', t: 'text', w: 1 },
        { k: 'bizType', l: 'Business type', t: 'sel', o: ['', 'Individual', 'Sole trader', 'Partnership', 'Limited company', 'LLP', 'Landlord', 'Charity or club', 'Other'] },
        { k: 'companyNo', l: 'Companies House number', t: 'text' },
        { k: 'services', l: 'Other services you provide', t: 'text', w: 1 },
        { k: 'fee', l: 'Annual fee', t: 'money' },
        { k: 'feeBasis', l: 'Billed', t: 'sel', o: ['', 'Monthly', 'Quarterly', 'Annually', 'Per job'] }] },
      { id: 'deadlines', title: 'Year end and deadlines', fields: [
        { k: 'yearEnd', l: 'Accounting year end (latest)', t: 'date' },
        { k: 'accountsDue', l: 'Companies House accounts due (9 months after year end for a private company. Check first-year accounts)', t: 'date', auto: { from: 'yearEnd', m: 9, eom: 1 } },
        { k: 'ctPayDue', l: 'Corporation Tax payment due (9 months and 1 day after year end)', t: 'date', auto: { from: 'yearEnd', m: 9, d: 1 } },
        { k: 'ct600Due', l: 'Company Tax Return (CT600) due (12 months after year end)', t: 'date', auto: { from: 'yearEnd', m: 12 } },
        { k: 'confirmationDue', l: 'Confirmation statement due', t: 'date' },
        { k: 'saDue', l: 'Self Assessment return due (online: 31 January)', t: 'date' },
        { k: 'vatQuarterEnd', l: 'VAT period end (latest)', t: 'date' },
        { k: 'vatDue', l: 'VAT return and payment due (1 month and 7 days after period end)', t: 'date', auto: { from: 'vatQuarterEnd', m: 1, d: 7 } },
        { k: 'recordsChased', l: 'Records requested on', t: 'date' }] },
      { id: 'compliance', title: 'Engagement and anti-money laundering', fields: [
        { k: 'engagementSigned', l: 'Engagement letter signed', t: 'date' },
        { k: 'amlCheck', l: 'ID and AML check done', t: 'date' },
        { k: 'amlReview', l: 'AML review due (12 months later. You can change it)', t: 'date', auto: { from: 'amlCheck', m: 12 } },
        { k: 'agentAuth', l: 'HMRC agent authorisation', t: 'sel', o: ['', 'Not needed', 'Requested', 'In place'] }] }],
    reminders: [
      { k: 'accountsDue', l: 'Accounts due at Companies House' }, { k: 'ctPayDue', l: 'Corporation Tax payment due' },
      { k: 'ct600Due', l: 'CT600 due' }, { k: 'confirmationDue', l: 'Confirmation statement due' },
      { k: 'saDue', l: 'Self Assessment return due' }, { k: 'vatDue', l: 'VAT return due' }, { k: 'amlReview', l: 'AML review due' }],
    value: { k: 'fee', l: 'Annual fees' }, addr: 'bizName', sub: 'bizType', subRef: 'companyNo',
    cols: [['type', 'Main service'], ['stage', 'Stage'], ['bizType', 'Business type'], ['fee', 'Annual fee'], ['task', 'Next task due'], ['review', 'Next deadline'], ['note', 'Latest note']],
    strip: [['fee', 'Annual fee'], ['yearEnd', 'Year end'], ['next', 'Next deadline']],
    apptTypes: ['Initial meeting', 'Year-end meeting', 'Tax return review', 'Records drop-off', 'Planning meeting', 'Call', 'Other'],
    apptSubject: 'Client meeting', taskHint: 'chase bank statements', reviewWord: 'Deadline',
    dontRecord: 'Do not type UTR or NI numbers, bank details, passport numbers or HMRC log-ins here. Keep them in your practice software.',
    msgFoot: FOOT,
    msgs: [
      { id: 'd1', title: 'Tax return reminder', subject: 'Your tax return', text: 'Hello{name},\n\nA friendly reminder that the online Self Assessment deadline is 31 January. Please send me your paperwork as soon as you can so I can prepare your return in good time.\n\n{sig}\n\n{foot}' },
      { id: 'd2', title: 'Year-end records', subject: 'Your year-end records', text: 'Hello{name},\n\nYour accounting year has ended, so it is a good time to send me your records for the year. Reply if you have any questions about what I need.\n\n{sig}\n\n{foot}' },
      { id: 'd3', title: 'Ask for a referral', subject: 'Could you help someone you know?', text: 'Hello{name},\n\nIf you know a business owner or landlord who needs help with accounts or tax, I would be grateful if you could pass on my details.\n\nThank you for your support.\n\n{sig}\n\n{foot}' },
      { id: 'd4', title: 'Gentle follow-up', subject: 'Just following up', text: 'Hello{name},\n\nJust following up on my last message. Let me know if there is anything I can help with.\n\n{sig}\n\n{foot}' }]
  };

  T.solicitor = {
    label: 'Solicitor or legal services', noun: ['Matter', 'Matters'], person: ['Client', 'Clients'], peopleTitle: 'Clients',
    dob: true, stages: [{ id: 'enquiry', label: 'Enquiry' }, { id: 'checks', label: 'Conflict and ID checks' }, { id: 'engaged', label: 'Client care letter sent' }, { id: 'progress', label: 'In progress' }, { id: 'completion', label: 'Exchange, completion or hearing' }, { id: 'closed', label: 'Closed' }],
    defaultStage: 'enquiry', doneStage: 'closed',
    types: ['Conveyancing: purchase', 'Conveyancing: sale', 'Remortgage', 'Wills', 'Probate and estates', 'Lasting power of attorney', 'Family', 'Employment', 'Dispute / litigation', 'Commercial', 'Landlord and tenant', 'Other'],
    sections: [
      { id: 'matter', title: 'Matter', fields: [
        { k: 'matterRef', l: 'Matter reference', t: 'text' }, { k: 'feeEarner', l: 'Fee earner', t: 'text' },
        { k: 'otherSide', l: 'Other side', t: 'text' }, { k: 'otherSolicitor', l: 'Other side’s solicitor', t: 'text' },
        { k: 'propertyAddress', l: 'Property address (if any)', t: 'text', w: 1 },
        { k: 'feeEstimate', l: 'Fee estimate', t: 'money' },
        { k: 'fundingNote', l: 'How it is funded (private, fixed fee, legal aid)', t: 'text' }] },
      { id: 'checks', title: 'Checks and client care', fields: [
        { k: 'conflict', l: 'Conflict check', t: 'sel', o: ['', 'Not done', 'Clear', 'Conflict: declined'] },
        { k: 'idCheck', l: 'ID and AML check done', t: 'date' }, { k: 'clientCare', l: 'Client care letter sent', t: 'date' }] },
      { id: 'dates', title: 'Key dates', fields: [
        { k: 'keyWhat', l: 'Next key date is for', t: 'text' }, { k: 'keyDate', l: 'Next key date', t: 'date' },
        { k: 'limitation', l: 'Limitation date', t: 'date' }, { k: 'exchange', l: 'Exchange date', t: 'date' },
        { k: 'completion', l: 'Completion date', t: 'date' }, { k: 'hearing', l: 'Hearing date', t: 'date' },
        { k: 'closedDate', l: 'File closed', t: 'date' },
        { k: 'destroyDate', l: 'File may be destroyed after (6 years. Check your retention policy)', t: 'date', auto: { from: 'closedDate', m: 72 } }] }],
    reminders: [
      { k: 'keyDate', l: 'Key date', ref: 'keyWhat', refL: '' }, { k: 'limitation', l: 'Limitation date' },
      { k: 'exchange', l: 'Exchange' }, { k: 'completion', l: 'Completion' }, { k: 'hearing', l: 'Hearing' },
      { k: 'destroyDate', l: 'File can be destroyed', only: ['closed'] }],
    value: { k: 'feeEstimate', l: 'Fees in progress' }, addr: 'propertyAddress', sub: 'matterRef', subRef: 'feeEarner',
    cols: [['type', 'Type'], ['stage', 'Stage'], ['matterRef', 'Reference'], ['task', 'Next task due'], ['review', 'Next key date'], ['note', 'Latest note']],
    strip: [['feeEstimate', 'Fee estimate'], ['matterRef', 'Reference'], ['next', 'Next key date']],
    apptTypes: ['Initial consultation', 'Signing', 'Will meeting', 'Update call', 'Hearing', 'Follow-up', 'Other'],
    apptSubject: 'Client appointment', taskHint: 'chase searches', reviewWord: 'Key date',
    dontRecord: 'Do not type NI numbers, bank details, passport numbers, immigration share codes or health details here. Keep them in your case management system.',
    msgFoot: FOOT,
    msgs: [
      { id: 'd1', title: 'Will review', subject: 'Is your will up to date?', text: 'Hello{name},\n\nLife changes such as marriage, children or moving home can affect your will. If it has been a few years, I would be happy to help you review it.\n\n{sig}\n\n{foot}' },
      { id: 'd2', title: 'Lasting power of attorney', subject: 'Planning ahead', text: 'Hello{name},\n\nA lasting power of attorney lets someone you trust make decisions for you if you ever cannot. If you would like to talk it through, just reply.\n\n{sig}\n\n{foot}' },
      { id: 'd3', title: 'Ask for a referral', subject: 'Could you help someone you know?', text: 'Hello{name},\n\nIf you know someone who needs legal help, I would be grateful if you could pass on my details.\n\nThank you for your support.\n\n{sig}\n\n{foot}' }]
  };

  T.architect = {
    label: 'Architect or designer', noun: ['Project', 'Projects'], person: ['Client', 'Clients'], peopleTitle: 'Clients',
    dob: false, stages: [{ id: 'enquiry', label: 'Enquiry' }, { id: 's0', label: '0 Strategic definition' }, { id: 's1', label: '1 Preparation and briefing' }, { id: 's2', label: '2 Concept design' }, { id: 's3', label: '3 Spatial coordination' }, { id: 's4', label: '4 Technical design' }, { id: 's5', label: '5 Manufacturing and construction' }, { id: 's6', label: '6 Handover' }, { id: 's7', label: '7 Use' }],
    defaultStage: 'enquiry', doneStage: 's7',
    types: ['Extension', 'Loft conversion', 'New build house', 'Refurbishment', 'Change of use', 'Listed building', 'Commercial', 'Other'],
    sections: [
      { id: 'project', title: 'Project and fees', fields: [
        { k: 'siteAddress', l: 'Site address', t: 'text', w: 1 },
        { k: 'fee', l: 'Fee', t: 'money' }, { k: 'feeBasis', l: 'Fee basis', t: 'sel', o: ['', 'Fixed fee', 'Percentage of build cost', 'Hourly', 'Stage payments'] },
        { k: 'buildCost', l: 'Estimated build cost', t: 'money' }, { k: 'appointment', l: 'Appointment letter signed', t: 'date' }] },
      { id: 'planning', title: 'Planning and building control', fields: [
        { k: 'planningRef', l: 'Planning application reference', t: 'text' },
        { k: 'planningStatus', l: 'Planning status', t: 'sel', o: ['', 'Not needed', 'Pre-application', 'Submitted', 'Approved', 'Refused', 'Withdrawn', 'Appeal'] },
        { k: 'planningSubmitted', l: 'Planning submitted (validated)', t: 'date' },
        { k: 'planningDecisionDue', l: 'Decision due (8 weeks. Major applications 13 weeks)', t: 'date', auto: { from: 'planningSubmitted', d: 56 } },
        { k: 'planningApproved', l: 'Planning approved on', t: 'date' },
        { k: 'planningExpiry', l: 'Start work by (usually 3 years. Check the decision notice)', t: 'date', auto: { from: 'planningApproved', m: 36 } },
        { k: 'bcRoute', l: 'Building control route', t: 'sel', o: ['', 'Full plans', 'Building notice', 'Registered building control approver'] },
        { k: 'bcRef', l: 'Building control reference', t: 'text' },
        { k: 'partyWall', l: 'Party wall', t: 'sel', o: ['', 'Not needed', 'Needed', 'Notices served', 'Agreed'] }] },
      { id: 'build', title: 'Construction', fields: [
        { k: 'contractor', l: 'Contractor', t: 'text' }, { k: 'startOnSite', l: 'Start on site', t: 'date' },
        { k: 'practicalCompletion', l: 'Practical completion', t: 'date' },
        { k: 'defectsEnd', l: 'End of defects period (12 months. Check the contract)', t: 'date', auto: { from: 'practicalCompletion', m: 12 } }] }],
    reminders: [
      { k: 'planningDecisionDue', l: 'Planning decision due', unless: ['planningApproved'], ref: 'planningRef', refL: 'Ref' },
      { k: 'planningExpiry', l: 'Planning permission runs out', unless: ['startOnSite'] },
      { k: 'startOnSite', l: 'Start on site' }, { k: 'defectsEnd', l: 'Defects period ends' }],
    value: { k: 'fee', l: 'Fees in progress' }, addr: 'siteAddress', sub: 'planningStatus', subRef: 'planningRef',
    cols: [['type', 'Type'], ['stage', 'Stage'], ['planningStatus', 'Planning'], ['fee', 'Fee'], ['task', 'Next task due'], ['review', 'Next key date'], ['note', 'Latest note']],
    strip: [['fee', 'Fee'], ['planningStatus', 'Planning'], ['next', 'Next key date']],
    apptTypes: ['Initial meeting', 'Site visit', 'Measured survey', 'Design review', 'Planning meeting', 'Site inspection', 'Other'],
    apptSubject: 'Project meeting', taskHint: 'send drawings to engineer', reviewWord: 'Key date',
    dontRecord: 'Do not type bank details, passport numbers or health details here.',
    msgFoot: FOOT,
    msgs: [
      { id: 'd1', title: 'Thinking of extending?', subject: 'Planning a home project?', text: 'Hello{name},\n\nIf you are thinking about an extension, loft conversion or renovation, I would be happy to talk through what is possible, including planning and building regulations.\n\n{sig}\n\n{foot}' },
      { id: 'd2', title: 'Ask for a referral', subject: 'Could you help someone you know?', text: 'Hello{name},\n\nIf you know someone planning building work, I would be grateful if you could pass on my details.\n\nThank you for your support.\n\n{sig}\n\n{foot}' },
      { id: 'd3', title: 'Gentle follow-up', subject: 'Just following up', text: 'Hello{name},\n\nJust following up on my last message. Let me know if you would like to arrange a meeting.\n\n{sig}\n\n{foot}' }]
  };

  T.gas = {
    label: 'Gas engineer or heating engineer', noun: ['Job', 'Jobs'], person: ['Customer', 'Customers'], peopleTitle: 'Customer',
    /* no Tasks or Pipeline tabs: an Appointments tab and a Reminders tab instead (to-dos with a date show as reminders) */
    landing: 'appointments', hideTabs: ['pipeline', 'tasks'], noTasks: true, apptTab: true, remTab: true,
    /* each job gets its own folder (Jobs › customer - address) for photos and documents saved as PDF, and its own receipts and expenses */
    jobDocs: true, expCats: ['Parts and materials', 'Tools and equipment', 'Fuel and travel', 'Parking', 'Subcontractor', 'Waste disposal', 'Other'],
    dob: false, stages: JOB_STAGES, defaultStage: 'enquiry', doneStage: 'paid',
    types: ['Boiler service', 'Boiler repair / breakdown', 'Boiler installation', 'Landlord gas safety record (CP12)', 'Gas safety check', 'Cooker or hob', 'Gas fire', 'Central heating', 'Other'],
    sections: [siteSection(), { id: 'appliance', title: 'Appliance, service and safety', fields: [
      { k: 'appliance', l: 'Boiler or appliance (make and model)', t: 'text' }, { k: 'applianceLoc', l: 'Where it is', t: 'text' },
      { k: 'installDate', l: 'Installed on', t: 'date' },
      { k: 'notifyBy', l: 'Notify Gas Safe by (30 days after install)', t: 'date', auto: { from: 'installDate', d: 30 } },
      { k: 'warrantyEnd', l: 'Manufacturer warranty ends', t: 'date' },
      { k: 'lastService', l: 'Last service', t: 'date' },
      { k: 'nextService', l: 'Next service due (12 months. You can change it)', t: 'date', auto: { from: 'lastService', m: 12 } },
      { k: 'gsrDate', l: 'Gas safety record (CP12) issued', t: 'date' },
      { k: 'gsrDue', l: 'Next gas safety record due (12 months)', t: 'date', auto: { from: 'gsrDate', m: 12 } },
      { k: 'certNo', l: 'Certificate or record number', t: 'text' }] }, billing()],
    reminders: [{ k: 'nextService', l: 'Annual service due' }, { k: 'gsrDue', l: 'Gas safety record due' }, { k: 'notifyBy', l: 'Notify Gas Safe' }, { k: 'warrantyEnd', l: 'Warranty ends' }, PAY_REM],
    value: { k: 'quote', l: 'Quoted work' }, addr: 'jobAddress', sub: 'appliance', subRef: 'invoiceNo', cols: JOB_COLS,
    strip: [['quote', 'Quote'], ['nextService', 'Next service'], ['next', 'Next key date']],
    apptTypes: TRADE_APPTS, apptSubject: 'Job', taskHint: 'order part', reviewWord: 'Due',
    dontRecord: TRADE_DONT, msgFoot: FOOT, msgs: tradeMsgs('boiler service or gas safety check')
  };

  T.plumber = {
    label: 'Plumber', noun: ['Job', 'Jobs'], person: ['Customer', 'Customers'], peopleTitle: 'Customer',
    dob: false, stages: JOB_STAGES, defaultStage: 'enquiry', doneStage: 'paid',
    types: ['Leak or repair', 'Bathroom', 'Kitchen plumbing', 'Blocked drain', 'Radiators', 'Hot water cylinder', 'Emergency call-out', 'Other'],
    sections: [siteSection(), { id: 'work', title: 'Work and guarantee', fields: [
      { k: 'startDate', l: 'Start date', t: 'date' }, { k: 'completedDate', l: 'Completed on', t: 'date' },
      { k: 'guaranteeEnd', l: 'Guarantee ends (12 months. You can change it)', t: 'date', auto: { from: 'completedDate', m: 12 } },
      { k: 'materials', l: 'Materials or parts to order', t: 'text', w: 1 },
      { k: 'nextService', l: 'Next service due (for example an unvented cylinder)', t: 'date' }] }, billing()],
    reminders: [{ k: 'startDate', l: 'Job starts', unless: ['completedDate'] }, { k: 'nextService', l: 'Service due' }, { k: 'guaranteeEnd', l: 'Guarantee ends' }, PAY_REM],
    value: { k: 'quote', l: 'Quoted work' }, addr: 'jobAddress', sub: 'propertyKind', subRef: 'invoiceNo', cols: JOB_COLS,
    strip: [['quote', 'Quote'], ['startDate', 'Start date'], ['next', 'Next key date']],
    apptTypes: TRADE_APPTS, apptSubject: 'Job', taskHint: 'order parts', reviewWord: 'Due',
    dontRecord: TRADE_DONT, msgFoot: FOOT, msgs: tradeMsgs('service')
  };

  T.electrician = {
    label: 'Electrician', noun: ['Job', 'Jobs'], person: ['Customer', 'Customers'], peopleTitle: 'Customer',
    dob: false, stages: JOB_STAGES, defaultStage: 'enquiry', doneStage: 'paid',
    types: ['EICR (inspection)', 'Consumer unit', 'Rewire', 'EV charger', 'New circuits', 'Fault finding', 'Lighting', 'PAT testing', 'Other'],
    sections: [siteSection(), { id: 'cert', title: 'Work and certificates', fields: [
      { k: 'startDate', l: 'Start date', t: 'date' }, { k: 'completedDate', l: 'Completed on', t: 'date' },
      { k: 'certType', l: 'Certificate', t: 'sel', o: ['', 'EIC', 'Minor works', 'EICR', 'PAT', 'Other'] },
      { k: 'certNo', l: 'Certificate number', t: 'text' },
      { k: 'notifyBy', l: 'Notify building control by (30 days after completion)', t: 'date', auto: { from: 'completedDate', d: 30 } },
      { k: 'eicrDate', l: 'EICR done on', t: 'date' },
      { k: 'nextEicr', l: 'Next inspection due (5 years for rented homes. You can change it)', t: 'date', auto: { from: 'eicrDate', m: 60 } }] }, billing()],
    reminders: [{ k: 'startDate', l: 'Job starts', unless: ['completedDate'] }, { k: 'notifyBy', l: 'Notify building control' }, { k: 'nextEicr', l: 'Electrical inspection due' }, PAY_REM],
    value: { k: 'quote', l: 'Quoted work' }, addr: 'jobAddress', sub: 'certType', subRef: 'invoiceNo', cols: JOB_COLS,
    strip: [['quote', 'Quote'], ['nextEicr', 'Next inspection'], ['next', 'Next key date']],
    apptTypes: TRADE_APPTS, apptSubject: 'Job', taskHint: 'send certificate', reviewWord: 'Due',
    dontRecord: TRADE_DONT, msgFoot: FOOT, msgs: tradeMsgs('electrical inspection')
  };

  T.builder = {
    label: 'Builder or general trades', noun: ['Job', 'Jobs'], person: ['Customer', 'Customers'], peopleTitle: 'Customer',
    dob: false, stages: JOB_STAGES, defaultStage: 'enquiry', doneStage: 'paid',
    types: ['Extension', 'Kitchen', 'Bathroom', 'Loft', 'Roofing', 'Decorating', 'Carpentry', 'Landscaping', 'Repairs', 'Other'],
    sections: [siteSection(), { id: 'work', title: 'Work and guarantee', fields: [
      { k: 'startDate', l: 'Start date', t: 'date' }, { k: 'finishDate', l: 'Expected finish', t: 'date' },
      { k: 'completedDate', l: 'Completed on', t: 'date' },
      { k: 'guaranteeEnd', l: 'Guarantee ends (12 months. You can change it)', t: 'date', auto: { from: 'completedDate', m: 12 } },
      { k: 'buildingControl', l: 'Building control', t: 'sel', o: ['', 'Not needed', 'Applied', 'Inspections booked', 'Completion certificate received'] },
      { k: 'materials', l: 'Materials or skips to order', t: 'text', w: 1 }] }, billing()],
    reminders: [{ k: 'startDate', l: 'Job starts', unless: ['completedDate'] }, { k: 'finishDate', l: 'Expected finish', unless: ['completedDate'] }, { k: 'guaranteeEnd', l: 'Guarantee ends' }, PAY_REM],
    value: { k: 'quote', l: 'Quoted work' }, addr: 'jobAddress', sub: 'propertyKind', subRef: 'invoiceNo', cols: JOB_COLS,
    strip: [['quote', 'Quote'], ['startDate', 'Start date'], ['next', 'Next key date']],
    apptTypes: TRADE_APPTS, apptSubject: 'Job', taskHint: 'order materials', reviewWord: 'Due',
    dontRecord: TRADE_DONT, msgFoot: FOOT, msgs: tradeMsgs('next job')
  };

  T.beauty = {
    label: 'Barber, hairdresser or beautician', noun: ['Client card', 'Client cards'], person: ['Client', 'Clients'], peopleTitle: 'Client',
    dob: true, stages: [{ id: 'enquiry', label: 'New enquiry' }, { id: 'booked', label: 'First visit booked' }, { id: 'regular', label: 'Regular client' }, { id: 'lapsed', label: 'Lapsed' }],
    defaultStage: 'enquiry', doneStage: 'regular',
    types: ['Haircut', 'Beard trim or shave', 'Colour', 'Highlights', 'Blow-dry or styling', 'Nails', 'Lashes or brows', 'Facial', 'Waxing', 'Massage', 'Make-up', 'Other'],
    sections: [
      { id: 'visits', title: 'Visits and rebooking', fields: [
        { k: 'usualService', l: 'Usual service', t: 'text', w: 1 },
        { k: 'usualPrice', l: 'Usual spend per visit', t: 'money' },
        { k: 'lastVisit', l: 'Last visit', t: 'date' },
        { k: 'nextVisit', l: 'Due to rebook (5 weeks after last visit. You can change it)', t: 'date', auto: { from: 'lastVisit', d: 35 } },
        { k: 'contactPref', l: 'Best way to contact', t: 'sel', o: ['', 'WhatsApp', 'Text', 'Phone call', 'Email'] },
        { k: 'noShows', l: 'Missed appointments', t: 'num' },
        { k: 'depositRule', l: 'Deposit needed to book', t: 'sel', o: ['', 'No', 'Yes'] }] },
      { id: 'treatment', title: 'Treatment notes', fields: [
        { k: 'formula', l: 'Colour formula, products or style notes', t: 'area' },
        { k: 'patchTest', l: 'Patch test done', t: 'date' },
        { k: 'patchDue', l: 'Next patch test due (6 months. Check your product instructions)', t: 'date', auto: { from: 'patchTest', m: 6 } },
        { k: 'consent', l: 'Consultation form signed', t: 'date' }] }],
    reminders: [{ k: 'nextVisit', l: 'Due to rebook', unless: [] }, { k: 'patchDue', l: 'Patch test due' }],
    value: { k: 'usualPrice', l: 'Usual spend' }, addr: 'usualService', sub: 'lastVisit', subRef: 'contactPref',
    cols: [['type', 'Main service'], ['stage', 'Stage'], ['usualPrice', 'Usual spend'], ['lastVisit', 'Last visit'], ['task', 'Next task due'], ['review', 'Next key date'], ['note', 'Latest note']],
    strip: [['usualPrice', 'Usual spend'], ['lastVisit', 'Last visit'], ['next', 'Next key date']],
    apptTypes: ['Haircut', 'Colour', 'Beard', 'Treatment', 'Consultation', 'Patch test', 'Other'],
    apptSubject: 'Appointment', taskHint: 'order stock', reviewWord: 'Due',
    dontRecord: 'Do not type card details, or medical conditions and allergies unless the client has agreed you can record them. Keep it to what you need for the treatment.',
    msgFoot: FOOT,
    msgs: [
      { id: 'd1', title: 'Time to rebook', subject: 'Time for your next appointment?', text: 'Hello{name},\n\nIt has been a few weeks since your last visit, so I wanted to let you know I have spaces coming up. Reply with a day and time that suits you and I will book you in.\n\n{sig}\n\n{foot}' },
      { id: 'd2', title: 'Quiet day offer', subject: 'Spaces available this week', text: 'Hello{name},\n\nI have a few spaces free this week. Reply if you would like one and I will book you in.\n\n{sig}\n\n{foot}' },
      { id: 'd3', title: 'Ask for a review', subject: 'How was your visit?', text: 'Hello{name},\n\nThank you for coming in. If you were happy, a short review would really help my business.\n\n{sig}\n\n{foot}' },
      { id: 'd4', title: 'Ask for a referral', subject: 'Know someone who needs a booking?', text: 'Hello{name},\n\nIf a friend or family member is looking for someone new, I would be grateful if you could pass on my details.\n\nThank you for your support.\n\n{sig}\n\n{foot}' }]
  };

  T.landlord = {
    label: 'Home owner / Landlord', noun: ['Property', 'Properties'], person: ['Tenant', 'Tenants'], peopleTitle: 'Tenants',
    dob: false, stages: [{ id: 'vacant', label: 'Vacant' }, { id: 'let', label: 'Let' }, { id: 'notice', label: 'Notice given' }],
    defaultStage: 'vacant', doneStage: 'let',
    tenancyMode: true, landing: 'cases', hideTabs: ['pipeline', 'clients'],
    types: ['House', 'Flat', 'HMO', 'Room', 'Holiday let', 'Commercial', 'Other'],
    sections: [
      { id: 'property', title: 'Property', fields: [
        { k: 'propertyAddress', l: 'Address line one (required)', t: 'text', w: 1 },
        { k: 'postcode', l: 'Postcode', t: 'text' },
        { k: 'bedrooms', l: 'Bedrooms', t: 'num' },
        { k: 'agent', l: 'Letting agent (if any)', t: 'text' },
        { k: 'insuranceRenewal', l: 'Landlord insurance renewal', t: 'date', doc: 'insurance certificate' },
        /* the mortgage fields (mort: 1) only show when the answer is Yes */
        { k: 'hasMortgage', l: 'Does the property have a mortgage?', t: 'sel', w: 1, o: [['', 'Choose…'], ['Yes', 'Yes'], ['No', 'No']] },
        { k: 'btlLender', l: 'Buy-to-let mortgage lender', t: 'text', mort: 1 },
        { k: 'btlFixedUntil', l: 'Mortgage deal ends', t: 'date', mort: 1 },
        { k: 'mortRate', l: 'Mortgage interest rate (% a year)', t: 'num', mort: 1 },
        { k: 'mortBalance', l: 'Mortgage balance', t: 'money', mort: 1 },
        { k: 'mortPayment', l: 'Monthly mortgage payment', t: 'money', mort: 1 },
        { k: 'mortMethod', l: 'Payment method', t: 'sel', mort: 1, o: [['', 'Choose…'], ['repayment', 'Repayment'], ['interest-only', 'Interest only']] },
        { k: 'mortDay', l: 'Mortgage payment day (1 to 31)', t: 'num', mort: 1 }] },
      { id: 'safety', title: 'Certificates and safety', side: 1, fields: [
        { k: 'gsrDate', l: 'Gas safety record done', t: 'date', doc: 'gas safety certificate' },
        { k: 'gsrDue', l: 'Next gas safety due (12 months)', t: 'date', auto: { from: 'gsrDate', m: 12 } },
        { k: 'eicrDate', l: 'Electrical report (EICR) done', t: 'date', doc: 'EICR report' },
        { k: 'eicrDue', l: 'Next EICR due (5 years, or sooner if the report says so)', t: 'date', auto: { from: 'eicrDate', m: 60 } },
        { k: 'epcRating', l: 'EPC rating', t: 'sel', o: ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] },
        { k: 'epcDate', l: 'EPC issued', t: 'date', doc: 'EPC certificate' },
        { k: 'epcExpiry', l: 'EPC expires (10 years)', t: 'date', auto: { from: 'epcDate', m: 120 } },
        { k: 'alarmsChecked', l: 'Smoke and CO alarms tested', t: 'date' },
        { k: 'licence', l: 'Council licence', t: 'sel', o: ['', 'Not needed', 'HMO licence', 'Selective licence', 'Applied'] },
        { k: 'licenceExpiry', l: 'Licence expires', t: 'date', doc: 'licence' },
        { k: 'lastInspection', l: 'Last property inspection', t: 'date' }] }],
    tenancyFields: [
      { k: 'status', l: 'Tenancy status', t: 'sel', o: [['current', 'Current'], ['ended', 'Ended']] },
      { k: 'tenancyType', l: 'Tenancy type', t: 'sel', o: ['', 'Assured periodic tenancy', 'Lodger (you live there)', 'Company let', 'Holiday let', 'Other'] },
      { k: 'tenancyStart', l: 'Tenancy started', t: 'date' },
      { k: 'rent', l: 'Rent', t: 'money' },
      { k: 'rentFreq', l: 'Rent paid', t: 'sel', o: ['', 'Monthly', 'Weekly', 'Every 4 weeks', 'Quarterly'] },
      { k: 'rentDay', l: 'Rent due on (day of month)', t: 'num' },
      { k: 'deposit', l: 'Deposit', t: 'money' },
      { k: 'depositReceived', l: 'Deposit received', t: 'date' },
      { k: 'depositDue', l: 'Protect deposit by (30 days)', t: 'date', auto: { from: 'depositReceived', d: 30 } },
      { k: 'depositScheme', l: 'Deposit scheme', t: 'sel', o: ['', 'DPS', 'mydeposits', 'TDS', 'Not taken'] },
      { k: 'depositProtected', l: 'Deposit protected on', t: 'date' },
      { k: 'rightToRent', l: 'Right to rent check done (England)', t: 'date' },
      { k: 'infoSheet', l: 'Written tenancy information given', t: 'date' },
      { k: 'lastRentIncrease', l: 'Last rent increase', t: 'date' },
      { k: 'nextRentIncrease', l: 'Earliest next increase (once a year, section 13 notice)', t: 'date', auto: { from: 'lastRentIncrease', m: 12 } },
      { k: 'noticeDate', l: 'Notice served or received', t: 'date' },
      { k: 'moveOut', l: 'Move-out date', t: 'date' }],
    tenancyReminders: [
      { k: 'depositDue', l: 'Protect deposit', unless: ['depositProtected'] },
      { k: 'nextRentIncrease', l: 'Rent review possible' },
      { k: 'moveOut', l: 'Tenant moving out' }],
    reminders: [
      /* lead: remind this many months before the date, then again every 30 days until the date is updated */
      { k: 'gsrDue', l: 'Gas safety record due', lead: 2 }, { k: 'eicrDue', l: 'EICR due', lead: 2 }, { k: 'epcExpiry', l: 'EPC expires', lead: 2 },
      { k: 'licenceExpiry', l: 'Licence expires', lead: 2 }, { k: 'insuranceRenewal', l: 'Insurance renewal', lead: 2 },
      { k: 'btlFixedUntil', l: 'Mortgage deal ends', ref: 'btlLender', refL: '', lead: 4 }],
    value: { k: 'rent', l: 'Rent roll' }, addr: 'propertyAddress', sub: 'type', subRef: 'agent',
    cols: [['tenants', 'Tenants'], ['rentSum', 'Rent a month'], ['rentSt', 'Rent status'], ['occ', 'Status'], ['legal', 'Legal to let'], ['type', 'Type'], ['epcRating', 'EPC'], ['review', 'Next key date'], ['task', 'Next task due']],
    strip: [['rentSum', 'Rent a month'], ['occ', 'Status'], ['next', 'Next key date']],
    apptTypes: ['Viewing', 'Check-in', 'Inspection', 'Gas safety check', 'Repair visit', 'Check-out', 'Other'],
    apptSubject: 'Property appointment', taskHint: 'book gas safety check', reviewWord: 'Due',
    dontRecord: 'Do not type bank details, passport numbers, right to rent share codes, references’ financial details or health details here. Record only the date a check was done.',
    msgFoot: 'If you are not a current tenant and would rather not hear from me, just reply STOP.',
    msgs: [
      { id: 'd1', title: 'Access for safety check', subject: 'Safety check at your home', text: 'Hello{name},\n\nThe annual safety check for your home is due. Please reply with a day and time that suits you so I can arrange access. I will give you at least 24 hours’ notice of the visit.\n\nThank you.\n\n{sig}' },
      { id: 'd2', title: 'Property inspection', subject: 'Routine property inspection', text: 'Hello{name},\n\nI would like to arrange a routine inspection of the property. Please let me know a convenient day and time. I will confirm with at least 24 hours’ notice.\n\n{sig}' },
      { id: 'd3', title: 'Rent reminder', subject: 'Rent reminder', text: 'Hello{name},\n\nA friendly reminder that your rent is due soon. If there is any problem, please get in touch so we can talk about it.\n\n{sig}' },
      { id: 'd4', title: 'Property available', subject: 'Property available to rent', text: 'Hello{name},\n\nI have a property becoming available to rent. If you, or someone you know, might be interested, reply and I will send the details.\n\n{sig}\n\n{foot}' }]
  };

  T.general = {
    label: 'Other self-employed business', noun: ['Job', 'Jobs'], person: ['Client', 'Clients'], peopleTitle: 'Client',
    dob: false, stages: [{ id: 'enquiry', label: 'Enquiry' }, { id: 'quote', label: 'Quote sent' }, { id: 'progress', label: 'In progress' }, { id: 'invoiced', label: 'Invoiced' }, { id: 'paid', label: 'Paid' }],
    defaultStage: 'enquiry', doneStage: 'paid',
    types: ['New work', 'Repeat work', 'Consultation', 'Other'],
    sections: [{ id: 'work', title: 'Work', fields: [
      { k: 'jobAddress', l: 'Address or location', t: 'text', w: 1 },
      { k: 'keyWhat', l: 'Next key date is for', t: 'text' }, { k: 'keyDate', l: 'Next key date', t: 'date' },
      { k: 'renewal', l: 'Renewal or repeat due', t: 'date' }] }, billing()],
    reminders: [{ k: 'keyDate', l: 'Key date', ref: 'keyWhat', refL: '' }, { k: 'renewal', l: 'Renewal due' }, PAY_REM],
    value: { k: 'quote', l: 'Quoted work' }, addr: 'jobAddress', sub: 'keyWhat', subRef: 'invoiceNo', cols: JOB_COLS,
    strip: [['quote', 'Quote'], ['paidDate', 'Paid on'], ['next', 'Next key date']],
    apptTypes: ['Meeting', 'Call', 'Job', 'Follow-up', 'Other'], apptSubject: 'Appointment', taskHint: 'send quote', reviewWord: 'Due',
    dontRecord: 'Do not type bank or card details, passwords or anyone’s health details here.', msgFoot: FOOT, msgs: tradeMsgs('next appointment')
  };

  var ORDER = ['gas', 'plumber', 'electrician', 'builder', 'beauty', 'landlord', 'architect', 'accountant', 'solicitor', 'mortgage', 'general'];
  ORDER.forEach(function (id) {
    var t = T[id]; t.id = id; t.fields = [];
    t.sections.forEach(function (s) { s.fields.forEach(function (f) { t.fields.push(f); }); });
    t.byKey = {}; t.fields.forEach(function (f) { t.byKey[f.k] = f; });
    if (t.tenancyFields) { t.tByKey = {}; t.tenancyFields.forEach(function (f) { t.tByKey[f.k] = f; }); }
  });

  /* TRADE LOCK: set ONLY to a trade id (for example 'landlord') to fix the app to that one trade and hide the picker.
     '' = every trade is offered: users choose when they register and can change it in Settings. */
  var ONLY = '';
  if (!T[ONLY]) ONLY = '';
  var cur = null;
  try { cur = localStorage.getItem('cd.trade'); } catch (e) {}
  if (ONLY) { cur = ONLY; ORDER = [ONLY]; try { localStorage.setItem('cd.trade', ONLY); } catch (e) {} }
  /* OPEN TRADES: the kinds of work people can choose right now. Every other trade is still listed,
     greyed out as "Coming soon". To open another trade, add its id here, e.g. ['landlord', 'gas'].
     [] = all trades can be chosen. People already set up with another trade keep it. */
  var OPEN = ['landlord'].filter(function (id) { return T[id]; });
  var isOpen = function (id) { return !OPEN.length || OPEN.indexOf(id) > -1; };
  ORDER = ORDER.filter(isOpen).concat(ORDER.filter(function (id) { return !isOpen(id); }));
  window.CD_TRADES = { order: ORDER, all: T, only: ONLY, open: OPEN };
  window.CD_tradeOpen = isOpen;
  window.CD_tradeSet = function (id) { if (!T[id] || (ONLY && id !== ONLY)) return; cur = id; try { localStorage.setItem('cd.trade', id); } catch (e) {} };
  window.CD_tradeChosen = function () { return !!(cur && T[cur]); };
  window.CD_T = function () { return T[cur] || T.general; };
})();
