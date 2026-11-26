/* The words for each trade page. tools/make-trade-pages.mjs turns these into for/<slug>.html */
export const TRADES = [
  {
    slug: 'landlords',
    tid: 'landlord',
    slide: 'Landlords',
    name: 'landlords',
    title: 'Landlord diary and task app',
    h1: 'Never miss a rent date, a gas safety certificate or a <em>tenancy renewal</em>.',
    lead: 'A simple diary and to-do list for landlords. Tenants, rent, safety certificates and renewals for each property sit in one place, and you are reminded before anything runs out.',
    desc: 'A simple app for landlords: tenants, rent paid and overdue, gas safety, EICR and EPC dates, tenancy agreements and reminders. Saved in your own Outlook account. First year free.',
    cards: [
      [
        'Rent, tenants and deposits',
        ['Tenants, rent and deposit for each property', 'See what is paid, due and overdue at a glance']
      ],
      [
        'Safety dates that do not slip',
        ['Gas safety, EICR and EPC dates for each property', 'A reminder well before each one runs out']
      ],
      [
        'Tenancy paperwork',
        ['Tenancy agreement templates for England', 'Renewals and legal to let checks with reminders']
      ],
      [
        'Reports for your accountant',
        [
          'Send a rent report to your accountant when you need to',
          'Receipts kept with the property they belong to'
        ]
      ],
      [
        'Insurance and renewals',
        ['Buildings and landlord insurance renewal dates', 'Mortgage product end dates']
      ],
      [
        'A diary and to-do list',
        ['Book viewings and inspections', 'The day before, the app prompts you to remind the person']
      ]
    ],
    faqs: [
      [
        'Is the tenancy agreement legal advice?',
        'No. The agreements are templates for England that follow current government guidance. Always have important documents checked by a solicitor.'
      ],
      [
        'Can I keep more than one property?',
        'Yes. Each property has its own tenants, rent, certificates and renewal dates, and the Today screen shows what is due across all of them.'
      ]
    ]
  },
  {
    slug: 'mortgage-advisers',
    tid: 'mortgage',
    slide: 'Mortgage advisers',
    name: 'mortgage advisers',
    title: 'Mortgage adviser client and case management app',
    h1: 'Never miss a product end date, an offer expiry or a <em>client review</em>.',
    lead: 'A simple client and case diary for mortgage and protection advisers. Review reminders come from each deal end date, and your client records stay in your own OneDrive, not on our computers.',
    desc: 'A simple app for mortgage advisers: cases, applicants and security addresses, review reminders from deal end dates, reading lender documents, advice fee invoices. Records stay in your own Outlook account.',
    cards: [
      [
        'Cases, applicants and properties',
        [
          'Joint applicants, dates of birth and security addresses',
          'Each case moves from enquiry to completed'
        ]
      ],
      [
        'Reviews from deal end dates',
        [
          'A review reminder for every deal end date, for each property',
          'Reminders for buildings insurance and protection reviews'
        ]
      ],
      [
        'Read a lender document',
        [
          'Upload an offer or illustration and the app reads names and the deal end date',
          'It is read on your own device, not sent to us'
        ]
      ],
      [
        'Advice fee and invoices',
        [
          'Record the advice fee for each case, or no fee',
          'Create a PDF invoice with the client and property filled in'
        ]
      ],
      [
        'Appointments and reminders',
        [
          'Book appointments in the diary',
          'A prompt the day before to send a reminder by WhatsApp, text or email'
        ]
      ],
      [
        'Spot duplicates',
        [
          'The app suggests records to merge when it finds the same client twice',
          'Merge, and undo if you change your mind'
        ]
      ]
    ],
    faqs: [
      [
        "Where are my clients' details kept?",
        'In a folder in your own OneDrive. We do not run a database of your clients and cannot read your records. That makes it easier to meet your own data protection duties, but you remain responsible for them.'
      ],
      [
        'Can I bring in clients from another system?',
        'Yes. You can import a CSV file or a backup, and the app matches clients that are already there by name, date of birth and address and offers to merge them.'
      ]
    ]
  },
  {
    slug: 'gas-engineers',
    tid: 'gas',
    slide: 'Gas and heating engineers',
    name: 'gas and heating engineers',
    title: 'Gas and heating engineer job and service reminder app',
    h1: 'Never miss an annual service or a <em>gas safety record</em> renewal.',
    lead: 'A simple diary, job list and reminder app for gas and heating engineers. Customers, jobs, certificates and service dates in one place, with reminders before each one is due.',
    desc: 'A simple app for gas and heating engineers: customers, jobs, quotes, invoices, certificates and annual service reminders. Saved in your own Outlook account. First year free.',
    cards: [
      [
        'Customers and jobs',
        [
          'Customer, address and boiler details for each job',
          'Enquiry, quote, booked, in progress, invoiced and paid'
        ]
      ],
      [
        'Service and safety reminders',
        ['Annual service reminder for each customer', 'Gas safety record renewals every year']
      ],
      [
        'Certificates with the job',
        [
          'Keep certificates with the job they belong to',
          'A reminder to notify the scheme after a new install'
        ]
      ],
      ['Quotes and invoices', ['Quotes with a follow up reminder', 'Invoices, and what is still unpaid']],
      ['Receipts', ['Photograph parts receipts and file them with the job', 'Handy for your tax return']],
      [
        'A diary with reminders',
        ['Book appointments in the diary', 'A prompt the day before to remind the customer']
      ]
    ],
    faqs: [
      [
        'Can it remind my customers about their annual service?',
        'The app shows you who is due a service and prompts you to send each customer a message by WhatsApp, text or email. You press send from your own phone.'
      ],
      [
        'Does it replace my gas safety certificate software?',
        'No. It keeps the certificates you already issue with each job and reminds you when they are due again.'
      ]
    ]
  },
  {
    slug: 'accountants',
    tid: 'accountant',
    slide: 'Accountants and bookkeepers',
    name: 'accountants and bookkeepers',
    title: 'Accountant and bookkeeper client deadline app',
    h1: 'Never miss a <em>filing deadline</em> or a client year end.',
    lead: "A simple client list and deadline diary for accountants and bookkeepers. Year ends, VAT quarters and filing dates are worked out from each client's details and shown before they are due.",
    desc: 'A simple app for accountants and bookkeepers: clients, year ends, VAT quarters, filing deadlines, engagement letters and AML checks. Saved in your own Outlook account. First year free.',
    cards: [
      [
        'Year ends and deadlines',
        [
          'Accounts and filing dates worked out from each year end',
          'VAT quarter dates and Self Assessment reminders'
        ]
      ],
      [
        'Client details',
        ['Sole trader, company and partnership details', 'MTD and VAT status for each client']
      ],
      ['Onboarding', ['Engagement letters and proposals', 'ID and AML checks with a yearly review reminder']],
      ['Fees', ['The annual fee for each client', 'Quotes, invoices and what is unpaid']],
      [
        'Papers kept with the client',
        [
          'File client papers with each client record',
          'Use the document reader to fill in details, on your own device'
        ]
      ],
      ['A diary and to-do list', ['Book client meetings', 'A prompt the day before to send a reminder']]
    ],
    faqs: [
      [
        'Does it file anything with HMRC or Companies House?',
        'No. It is a diary and client list that reminds you when things are due. You file as you do now.'
      ],
      [
        "Are my clients' details safe?",
        'Records are saved in a folder in your own OneDrive and are not on our computers. The app locks itself after a period of inactivity.'
      ]
    ]
  },
  {
    slug: 'plumbers',
    tid: 'plumber',
    slide: 'Plumbers',
    name: 'plumbers',
    title: 'Plumber job, quote and invoice app',
    h1: 'Never miss a <em>quote follow up</em> or an unpaid invoice.',
    lead: 'A simple diary, job list and reminder app for plumbers. Customers, jobs, quotes and invoices in one place, with reminders for guarantees and servicing.',
    desc: 'A simple app for plumbers: customers, jobs, appointments, quotes, invoices, photos, receipts and guarantee reminders. Saved in your own Outlook account. First year free.',
    cards: [
      [
        'Customers and jobs',
        ['Customer and address for each job', 'Enquiry, quote, booked, in progress, invoiced and paid']
      ],
      ['Quotes that get chased', ['A reminder to follow up each quote', 'See quoted work in progress']],
      ['Invoices', ['Create and track invoices', 'Unpaid invoices shown by how many days late']],
      [
        'Guarantees and servicing',
        ['A reminder before a guarantee ends', 'Service reminders for cylinders and boilers']
      ],
      [
        'Photos and receipts',
        ['Photos of the work kept with the job', 'Receipts filed with the job it was for']
      ],
      [
        'A diary with reminders',
        ['Book appointments in the diary', 'A prompt the day before to remind the customer']
      ]
    ],
    faqs: [
      [
        'Does it work on my phone on site?',
        "Yes. Open it in your phone's browser or add it to your home screen like an app. You can add a job and take a photo on site."
      ],
      [
        'Can I send a customer their quote?',
        'Yes. Create the quote and send it from your own email or WhatsApp. The app reminds you to follow it up.'
      ]
    ]
  },
  {
    slug: 'electricians',
    tid: 'electrician',
    slide: 'Electricians',
    name: 'electricians',
    title: 'Electrician job, certificate and re-test reminder app',
    h1: 'Never miss an <em>EICR re-test</em> or a certificate that needs sending.',
    lead: 'A simple diary, job list and reminder app for electricians. Customers, jobs, test certificates and re-test dates in one place, with reminders before each one is due.',
    desc: 'A simple app for electricians: customers, jobs, test certificates, EICR and PAT re-test reminders, quotes, invoices and receipts. Saved in your own Outlook account. First year free.',
    cards: [
      [
        'Customers and jobs',
        ['Customer and address for each job', 'Enquiry, quote, booked, in progress, invoiced and paid']
      ],
      ['Test certificates', ['File certificates with each job', 'A reminder to send the certificate']],
      [
        'Re-test reminders',
        ['EICR re-test dates for each property', 'PAT testing reminders for your commercial customers']
      ],
      [
        'Quotes and invoices',
        ['A follow up reminder for each quote', 'Unpaid invoices shown by how many days late']
      ],
      ['Parts and receipts', ['Photograph receipts and file them with the job', 'Handy for your tax return']],
      [
        'A diary with reminders',
        ['Book appointments in the diary', 'A prompt the day before to remind the customer']
      ]
    ],
    faqs: [
      [
        'Can it remind customers when their EICR is due again?',
        'The app shows you each re-test coming up and prompts you to message the customer by WhatsApp, text or email. You press send from your own phone.'
      ],
      [
        'Does it make the certificates?',
        'No. It keeps the certificates you already issue with each job and reminds you of the next date.'
      ]
    ]
  },
  {
    slug: 'builders',
    tid: 'builder',
    slide: 'Builders and general trades',
    name: 'builders and general trades',
    title: 'Builder and general trades job and quote app',
    h1: 'Never miss a <em>stage payment</em>, an inspection or a guarantee end date.',
    lead: 'A simple diary, job list and reminder app for builders and general trades. Quotes, jobs on site, payments and inspection dates in one place.',
    desc: 'A simple app for builders and general trades: customers, jobs, quotes, stage payments, plans, permits, site photos, guarantee dates and receipts. Saved in your own Outlook account. First year free.',
    cards: [
      [
        'Jobs on site',
        ['Each job with its customer and address', 'Enquiry, quote, booked, in progress, invoiced and paid']
      ],
      [
        'Quotes and stage payments',
        ['Quotes with a follow up reminder', 'Stage payments and invoices, and what is unpaid']
      ],
      ['Plans and permits', ['Keep plans and permits with the job', 'Site photos filed with the job']],
      [
        'Inspections and guarantees',
        ['Building control inspection dates', 'A reminder before a guarantee ends']
      ],
      ['Receipts', ['Photograph receipts and file them with the job', 'Handy for your tax return']],
      [
        'A diary with reminders',
        ['Book site visits and appointments', 'A prompt the day before to remind the customer']
      ]
    ],
    faqs: [
      [
        'Can I keep photos of the work?',
        'Yes. Add photos and documents to each job. They are saved in your own OneDrive.'
      ],
      [
        'Is it suitable for one-man bands?',
        'Yes. It is built for sole traders and small firms, and you only see the screens you need.'
      ]
    ]
  },
  {
    slug: 'hairdressers-and-beauticians',
    tid: 'beauty',
    slide: 'Barbers, hairdressers and beauticians',
    name: 'barbers, hairdressers and beauticians',
    title: 'Barber, hairdresser and beautician client and appointment app',
    h1: "Never miss a <em>rebooking</em>, a patch test or a regular's birthday.",
    lead: 'A simple client book and diary for barbers, hairdressers and beauticians. Client cards, appointments and reminders to rebook, with a prompt to send each client a reminder the day before.',
    desc: 'A simple app for barbers, hairdressers and beauticians: client cards, treatment notes, appointments, rebooking and patch test reminders, birthdays and consent forms. Saved in your own Outlook account.',
    cards: [
      [
        'Client cards',
        ['Contact details and treatment notes for each client', 'Consent forms kept with the client']
      ],
      [
        'Appointments',
        [
          'Book in the diary',
          'The day before, a prompt to send the client a reminder by WhatsApp, text or email'
        ]
      ],
      [
        'Rebooking',
        ['See clients who have not visited for a while', 'A reminder to get in touch with lapsed clients']
      ],
      [
        'Patch tests',
        ['A reminder when a patch test is due or needs renewing', 'Keep the result with the client']
      ],
      ['Birthdays and offers', ["A reminder on a client's birthday", 'Send a message in a few taps']],
      [
        'Consent forms and documents',
        ['Keep signed consent forms with each client', 'Receipts filed for your tax return']
      ]
    ],
    faqs: [
      [
        'Will it send the reminders for me?',
        'The app prompts you the day before and opens a message ready to send in WhatsApp, text or email. You press send from your own phone, so it comes from your number.'
      ],
      [
        'Can I keep colour formulas and notes?',
        'Yes. Each client card has notes you can add to after every visit.'
      ]
    ]
  },
  {
    slug: 'driving-instructors',
    tid: 'driving',
    slide: 'Driving instructors',
    name: 'driving instructors',
    title: 'Driving instructor lesson and learner management app',
    h1: 'Never miss a <em>driving test</em>, a lesson or your ADI badge renewal.',
    lead: 'A simple diary and learner list for driving instructors. Lessons, test dates and what each learner owes in one place, with reminders for your badge, MOT and insurance.',
    desc: 'A simple app for driving instructors: learners, lessons, test dates, rebooking reminders, ADI badge, MOT and insurance renewals, lesson sheets and receipts. Saved in your own Outlook account.',
    cards: [
      [
        'Learners and lessons',
        ['A card for each learner with lessons taken', 'Lesson count and test date at a glance']
      ],
      ['Test dates', ['Test dates shown with a reminder', 'Learners on test this month']],
      ['Rebooking', ['See learners who have gone quiet', 'A reminder to get in touch']],
      [
        'Your own renewals',
        ['ADI badge, car MOT and insurance renewal dates', 'Reminded well before each one']
      ],
      ['Money owed', ['What each learner has paid and owes', 'Receipts and lesson sheets filed']],
      [
        'A diary with reminders',
        ['Book lessons in the diary', 'A prompt the day before to remind the learner']
      ]
    ],
    faqs: [
      [
        'Can it remind learners about their lesson?',
        'The app prompts you the day before and opens a message ready to send by WhatsApp, text or email. You press send from your own phone.'
      ],
      [
        'Does it work on my phone in the car?',
        "Yes. Open it in your phone's browser or add it to your home screen like an app."
      ]
    ]
  },
  {
    slug: 'architects-and-designers',
    tid: 'architect',
    slide: 'Architects and designers',
    name: 'architects and designers',
    title: 'Architect and designer project and planning date app',
    h1: 'Never miss a <em>planning decision date</em> or a fee invoice.',
    lead: 'A simple project diary for architects and designers. Projects move through the work stages, with planning and building control dates and fees kept in one place.',
    desc: 'A simple app for architects and designers: projects by work stage, planning and building regulations dates, fees and invoices, drawings and site notes. Saved in your own Outlook account. First year free.',
    cards: [
      [
        'Projects by stage',
        ['From enquiry and brief to handover and use', 'See every live project and its stage']
      ],
      [
        'Planning dates',
        ['Planning submitted, decision and approval expiry dates', 'A reminder when a decision is due']
      ],
      [
        'Building control',
        ['Building regulations inspection dates', 'Practical completion and defects reminders']
      ],
      ['Fees and invoices', ['The fee for each project', 'Stage invoices and what is unpaid']],
      [
        'Drawings and notes',
        ['Keep drawings and site notes with the project', 'Photos from site filed with the project']
      ],
      [
        'A diary with reminders',
        ['Book client meetings and site visits', 'A prompt the day before to send a reminder']
      ]
    ],
    faqs: [
      [
        'Are the stages the RIBA work stages?',
        'The project stages run from 0 to 7 in line with the RIBA Plan of Work, plus an enquiry stage.'
      ],
      [
        'Can I keep large drawings in it?',
        'Documents are filed in your own OneDrive with the project. Large drawing sets are best kept in your usual drawing system, with a note in the project.'
      ]
    ]
  },
  {
    slug: 'solicitors',
    tid: 'solicitor',
    slide: 'Solicitors and legal services',
    name: 'solicitors and legal services',
    title: 'Solicitor and legal services matter and key date app',
    h1: 'Never miss a <em>completion date</em>, a hearing or a client ID check.',
    lead: 'A simple matter list and key date diary for solicitors and legal services. Checks, client care letters and time limits in one place, with reminders before each date.',
    desc: 'A simple app for solicitors and small legal practices: matters, conflict and ID checks, client care letters, key dates, time limits and reminders. Records stay in your own Outlook account. First year free.',
    cards: [
      [
        'Matters and stages',
        ['Enquiry, checks, client care letter sent, in progress and closed', 'See every open matter']
      ],
      ['Conflict and ID checks', ['Know which clients still need ID', 'AML review reminders']],
      ['Client care letters', ['Record when a letter was sent', 'Filed with the matter']],
      [
        'Key dates and time limits',
        ['Exchange, completion and hearing dates', 'A reminder before each date']
      ],
      [
        'Documents together',
        [
          'Keep matter documents with the matter',
          'Closed matters flagged for review after the retention period'
        ]
      ],
      ['A diary with reminders', ['Book client appointments', 'A prompt the day before to send a reminder']]
    ],
    faqs: [
      [
        'Is it a case management system?',
        'No. It is a simple matter list and diary for small practices, to make sure no date or check is missed. It does not replace a full case management system.'
      ],
      [
        'Where is client information kept?',
        'In a folder in your own OneDrive. We do not run a database of your matters and cannot read your records.'
      ]
    ]
  },
  {
    slug: 'self-employed',
    tid: 'general',
    slide: 'Other self-employed businesses',
    name: 'self-employed people and small businesses',
    title: 'Diary, jobs and invoicing app for the self-employed',
    h1: 'Never miss a <em>quote</em>, an unpaid invoice or an insurance renewal.',
    lead: 'A simple diary, job list and reminder app for self-employed people and small businesses. Customers, jobs, quotes and invoices in one place, with reminders for every renewal.',
    desc: 'A simple app for the self-employed: customers, jobs, appointments, quotes, invoices, receipts and renewal reminders. Saved in your own Outlook account. First year free, no card needed.',
    cards: [
      [
        'Customers and jobs',
        ['Customer and address for each job', 'Enquiry, quote, booked, in progress, invoiced and paid']
      ],
      [
        'Quotes and invoices',
        ['A follow up reminder for each quote', 'Unpaid invoices shown by how many days late']
      ],
      ['Renewals', ['Insurance, vehicle and licence renewal dates', 'Reminded in good time before each one']],
      [
        'Receipts and documents',
        ['Photograph receipts and file them with the job', 'Keep certificates and paperwork together']
      ],
      [
        'Regular customers',
        ['A reminder for annual or regular work', 'Birthday and thank you messages in a few taps']
      ],
      [
        'A diary with reminders',
        ['Book appointments in the diary', 'A prompt the day before to remind the customer']
      ]
    ],
    faqs: [
      [
        'I do not see my trade. Can I still use it?',
        'Yes. Choose the general self-employed option when you register. You get customers, jobs, quotes, invoices and reminders that suit most trades.'
      ],
      [
        'Do I need to be registered as a business?',
        'No. It works for sole traders and anyone who is self-employed.'
      ]
    ]
  }
];
/* questions every trade page shares */
export const COMMON_FAQS = [
  [
    'What does it cost?',
    'The first year is free and needs no card. After that the price is shown before you pay anything, and you can leave at any time with your records still in your own account.'
  ],
  [
    'Where are my records kept?',
    "In a folder in your own Outlook account's OneDrive. We do not collect, sell or read your records, and none of your customers' details are on our computers."
  ]
];
