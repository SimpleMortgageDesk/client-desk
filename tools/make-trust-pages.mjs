/* Makes about.html, support.html, security.html and terms.html in the same look as privacy.html.
   Run:  node tools/make-trust-pages.mjs   then commit the result. */
import { readFileSync, writeFileSync } from 'node:fs';
const priv = readFileSync('privacy.html', 'utf8');
const style = priv.match(/<style>[\s\S]*?<\/style>/)[0];
const cfg = priv.match(/<script src="config\.js[^>]*><\/script>/)[0];
const SITE = 'https://mysimpledesk.co.uk';
const PAGES = [
  {
    file: 'about',
    title: 'About us',
    desc: 'Who provides MySimpleDesk, what it is for, and how to contact us.',
    body: `
    <h1>About us</h1>
    <p class="muted">Last updated: 25 November 2026</p>
    <div class="key"><p><b>MySimpleDesk is a simple diary, to-do list and record keeper for home owners, landlords, the self-employed and small professional practices.</b> It reminds you before a task, an appointment or a renewal is due, and it keeps your records in your own account, not on our computers.</p></div>
    <h2>Who provides it</h2>
    <p>MySimpleDesk is provided by <span data-owner></span>, in the United Kingdom. You can reach us at <span data-email></span>.</p>
    <h2>What we believe</h2>
    <ul>
      <li><b>Your records are yours.</b> They are saved as files in your own OneDrive. We run no database of your customers, tenants or clients, and we cannot read them. <a href="/security">How your data is protected</a>.</li>
      <li><b>Simple beats clever.</b> You only see the screens for your own kind of work, and the app reminds you instead of expecting you to remember.</li>
      <li><b>No adverts, no selling your details.</b> We make money from the service, not from your information.</li>
      <li><b>Honest about the limits.</b> The examples on our pages are invented, the document templates are not legal advice, and we say so.</li>
    </ul>
    <h2>Who it is for</h2>
    <p>Home owners and families, landlords, mortgage advisers, accountants and bookkeepers, gas engineers, plumbers, electricians, builders, barbers and beauticians, driving instructors, architects, solicitors and other self-employed people. <a href="/home#trades">See it for your trade</a>.</p>
    <h2>Talk to us</h2>
    <p>Questions, ideas and problems are welcome. See the <a href="/support">support page</a> or email <span data-email></span>.</p>`
  },
  {
    file: 'support',
    title: 'Support',
    desc: 'Help with MySimpleDesk: logging in, your records, your phone, importing, and how to contact us.',
    body: `
    <h1>Support</h1>
    <p class="muted">We are happy to help. Email <span data-email></span> and say what you were trying to do. We usually reply within a couple of working days.</p>
    <h2>Before you write: quick answers</h2>
    <details><summary>I cannot log in</summary><p>Sign in with the same Microsoft account you registered with. If you set an app password, that is separate from your Microsoft password. Forgotten it? On the login page choose "Forgot your password or user ID?" and follow the steps. If you changed your Microsoft password, just sign in again with the new one.</p></details>
    <details><summary>I lost or replaced my phone</summary><p>Your records are safe in your own OneDrive. Log in on the new device and they come back. The app on the old phone locks itself and signs out after a period of inactivity. You can also remove the app's access in your Microsoft account under app permissions.</p></details>
    <details><summary>How do I put the app on my phone?</summary><p>Open the site in your phone's browser and choose "Add to home screen" (Android Chrome: menu, then Install app). It then opens like any other app.</p></details>
    <details><summary>How do I bring in clients or records from another system?</summary><p>Open Settings, then Backup and restore. You can import a CSV file or an earlier backup. The app matches people already in the app and offers to merge them.</p></details>
    <details><summary>How do I delete my account and records?</summary><p>Open Settings and choose Delete my account. Your records stay in your own OneDrive until you delete the folder yourself. See the <a href="/privacy">privacy policy</a> for what we keep and for how long.</p></details>
    <details><summary>Appointments are not appearing in my Outlook calendar</summary><p>This is switched off until you turn it on. Open Settings, then Email and calendar, and turn on calendar reminders. You will be asked to sign in to Microsoft once more to allow it.</p></details>
    <h2>Reporting a problem</h2>
    <p>It helps if you tell us: what you did, what you expected, what happened instead, the device and browser you use, and a screenshot. In the app, Settings has a Support details section that shows the app version and your device type. <b>Please do not send client, tenant or customer details by email.</b></p>
    <h2>Contact</h2>
    <p><span data-email></span></p>`
  },
  {
    file: 'security',
    title: 'How your data is protected',
    desc: 'Where MySimpleDesk keeps your records, what we can and cannot see, and how the app is protected.',
    body: `
    <h1>How your data is protected</h1>
    <p class="muted">Last updated: 25 November 2026</p>
    <div class="key"><p><b>The short version.</b> Your records are saved in your own OneDrive, under your own Microsoft account. They do not pass through our computers, so we cannot read, sell or lose them. We keep only a short sign-up list with your own contact details.</p></div>
    <h2>Where your records are</h2>
    <ul>
      <li>In a folder in your own OneDrive, in <b>Apps &rsaquo; Client Desk</b>. You can open that folder any time.</li>
      <li>A working copy on your device, so the app works offline. Logging out removes it from that device.</li>
      <li>We keep no copy and run no database of your customers, tenants or clients.</li>
    </ul>
    <h2>What we can and cannot see</h2>
    <ul>
      <li><b>We can see:</b> the account details you gave when registering (name, email, mobile, business name, kind of work) and simple usage counts, held in a sign-up list.</li>
      <li><b>We cannot see:</b> your records, documents, notes, customers' details or your app password.</li>
      <li>The app can only use its own folder. It cannot see the rest of your OneDrive, and it cannot read your email.</li>
      <li>When you upload a document and the app reads a date from it, that happens inside your own browser. The document is not sent to us.</li>
    </ul>
    <h2>How the app is protected</h2>
    <ul>
      <li><b>Sign-in by Microsoft.</b> The app never sees your Microsoft password.</li>
      <li><b>App lock.</b> You can set an app password. The app locks after a period of inactivity and signs out after a longer one.</li>
      <li><b>Encrypted connection.</b> Everything between your device, our site and Microsoft travels over HTTPS.</li>
      <li><b>Strict page security.</b> The site only runs its own scripts, so injected code cannot run. Links to other sites are checked before they open.</li>
      <li><b>No adverts or trackers.</b> The only outside script is Cloudflare Web Analytics, which uses no cookies and does not identify you.</li>
      <li><b>Password-protected backups.</b> A backup file is protected with a password you choose.</li>
      <li><b>Shared computers.</b> Tick "This is a shared or public computer" when you log in and nothing is kept on it.</li>
    </ul>
    <h2>The limits, honestly</h2>
    <ul>
      <li>The working copy on your device is not encrypted by the app. Use a device with a screen lock and disk encryption, and turn on two-step verification for your Microsoft account.</li>
      <li>We test the app ourselves. It has not yet had an independent security audit.</li>
      <li>If you keep other people's details, you are responsible for them under UK data protection law. The app helps (it keeps accounts apart, warns you not to record bank details or National Insurance numbers, and lets you export and delete records) but it does not remove your duties. See section 7 of the <a href="/privacy">privacy policy</a>.</li>
    </ul>
    <h2>Found a security problem?</h2>
    <p>Please email <span data-email></span> with the details and give us a reasonable time to fix it before telling others. Do not include other people's personal data.</p>
    <p>The full detail is in the <a href="/privacy">privacy policy</a>.</p>`
  },
  {
    file: 'terms',
    title: 'Terms of use',
    desc: 'The terms for using MySimpleDesk, in plain English.',
    body: `
    <h1>Terms of use</h1>
    <p class="muted">Last updated: 25 November 2026</p>
    <div class="key"><p>These are the terms for using MySimpleDesk, written in plain English. By registering or using the app you agree to them. Please read them together with the <a href="/privacy">privacy policy</a>.</p></div>
    <h2>1. Who we are</h2>
    <p>MySimpleDesk is provided by <span data-owner></span> ("we", "us"). Email <span data-email></span>.</p>
    <h2>2. Who can use it</h2>
    <p>You must be 18 or over and use the app for yourself, your home, your property letting or your business. You need your own Microsoft account. You are responsible for keeping your account, app password and devices secure.</p>
    <h2>3. Your records</h2>
    <p>The records, documents and notes you add are yours. They are saved in your own OneDrive and on your device. We do not own them, hold them or read them. You are responsible for their accuracy, for keeping your own backups, and for how you use other people's details (see section 7 of the privacy policy).</p>
    <h2>4. Using the app properly</h2>
    <ul>
      <li>Do not use the app for anything unlawful, or to harm others or the service.</li>
      <li>Do not try to break into, overload or copy the service, or access another person's account.</li>
      <li>Do not record bank details or National Insurance numbers in the app.</li>
    </ul>
    <h2>5. Not advice</h2>
    <p>MySimpleDesk is a diary and record keeper. Reminders, dates read from documents, calculations, reports and templates (including tenancy agreements and invoices) are there to help you. They are not legal, financial, mortgage, tax or professional advice. Check anything important yourself, and have important documents checked by a suitable professional such as a solicitor.</p>
    <h2>6. Price</h2>
    <p>Home owners can use the app free. Landlords and professionals get the first year free with no card needed. After that, the price is shown before you pay anything, and you can leave at any time. We will tell you before any price you have agreed to changes.</p>
    <h2>7. Availability and changes</h2>
    <p>We work to keep the app running, but we cannot promise it will always be available or error free, and it may depend on services we do not control (such as Microsoft, your internet connection and your device). We may improve, change or remove features, and we will try to give notice of changes that matter to you.</p>
    <h2>8. Our responsibility</h2>
    <p>We are responsible for loss or damage that is a foreseeable result of us failing to use reasonable care and skill. We do not exclude or limit our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not allow us to limit. Subject to that, we are not liable for business losses such as lost profit, or for missed deadlines or renewals, so please keep your own checks for anything critical. Our total liability to you in any 12 months is limited to the amount you paid us in that period, or £100 if you paid nothing.</p>
    <h2>9. Ending your use</h2>
    <p>You can stop at any time, and delete your account in Settings. Your records stay in your own OneDrive unless you delete them. We may suspend or close an account that breaks these terms, and we will tell you why where we can.</p>
    <h2>10. Changes to these terms</h2>
    <p>If these terms change, the new version will be published here with a new date. If you carry on using the app after that, you accept the new terms.</p>
    <h2>11. Law</h2>
    <p>These terms are governed by the law of England and Wales, and the courts of England and Wales can deal with any dispute, unless you live in another part of the UK and the law there gives you the right to use your own courts.</p>
    <h2>12. Contact</h2>
    <p><span data-email></span></p>`
  },
  {
    file: 'download',
    title: 'Download the app for Windows or Mac',
    desc: 'Download MySimpleDesk for Windows or Mac. The same simple diary, to-do list and records, in its own window on your computer.',
    body: `
    <h1>Download MySimpleDesk</h1>
    <p class="muted">For Windows and Mac. It is the same app as the website, in its own window on your computer.</p>
    <div class="dl">
      <a class="dlb" href="https://github.com/SimpleMortgageDesk/client-desk/releases/download/desktop/MySimpleDesk-Setup.exe"><b>Download for Windows</b><span>Windows 10 or 11 &middot; about 115 MB</span></a>
      <a class="dlb" href="https://github.com/SimpleMortgageDesk/client-desk/releases/download/desktop/MySimpleDesk-arm64.dmg"><b>Download for Mac (Apple chip)</b><span>M1, M2, M3, M4 or newer &middot; about 113 MB</span></a>
      <a class="dlb" href="https://github.com/SimpleMortgageDesk/client-desk/releases/download/desktop/MySimpleDesk-x64.dmg"><b>Download for Mac (Intel)</b><span>Macs made before late 2020 &middot; about 120 MB</span></a>
    </div>
    <p class="muted"><b>Not sure which Mac you have?</b> Click the Apple menu, then <b>About This Mac</b>. If it says <b>Chip: Apple M&hellip;</b>, choose Apple chip. If it says <b>Processor: Intel</b>, choose Intel.</p>
    <h2>Installing it</h2>
    <details open><summary>Windows</summary><p>Open the file you downloaded and follow the steps. Windows may show a blue box saying "Windows protected your PC", because the app is new and not yet widely downloaded. Click <b>More info</b>, then <b>Run anyway</b>. You then find MySimpleDesk on the Start menu and your desktop.</p></details>
    <details open><summary>Mac</summary><p>Open the downloaded file and drag MySimpleDesk into the Applications folder. The first time, do not double-click it: <b>right-click (or Control-click) it and choose Open</b>, then click <b>Open</b> again. If your Mac still refuses, open System Settings, then Privacy &amp; Security, scroll down and click <b>Open Anyway</b>. You only do this once.</p></details>
    <h2>Good to know</h2>
    <ul>
      <li><b>You need an internet connection</b> to open it, as with the website. Your records are saved in your own OneDrive, and the app keeps a working copy on your computer.</li>
      <li><b>Updates are automatic.</b> The app opens the live website, so you always have the latest version. You do not need to download it again.</li>
      <li><b>Log in with the same Microsoft account</b> you use on the website or your phone, and everything is there.</li>
      <li><b>Links to other sites</b> open in your normal web browser.</li>
    </ul>
    <p>Prefer not to install anything? Open <a href="/">mysimpledesk.co.uk</a> in your browser. You can also <a href="/support">ask for help</a>.</p>`
  }
];
const nav =
  '<a href="/about">About</a> · <a href="/download">Download</a> · <a href="/support">Support</a> · <a href="/security">Data protection</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>';
const script = priv
  .match(/\(function \(\) \{\n  var c = window\.MD_CONFIG[\s\S]*?\n\}\)\(\);/)[0]
  .replace(/\n  document\.title = [^\n]*/, '')
  .replace(/\n  var su = [^\n]*\n[^\n]*data-su[^\n]*\n[^\n]*data-nosu[^\n]*/, '');
for (const p of PAGES) {
  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.title} · MySimpleDesk</title>
<meta name="description" content="${p.desc}">
<link rel="canonical" href="${SITE}/${p.file}">
<meta property="og:title" content="${p.title} · MySimpleDesk">
<meta property="og:description" content="${p.desc}">
<meta property="og:image" content="${SITE}/icon-512.png">
<link rel="icon" href="/icon-192.png?v=3">
${style.replace('</style>', '  details{border-bottom:1px solid var(--line);padding:10px 0}\n  .dl{display:grid;gap:12px;margin:20px 0}.dlb{display:block;padding:16px 20px;border-radius:12px;background:var(--accent);color:#fff;text-decoration:none}.dlb b{display:block;font-size:19px}.dlb span{font-size:14px;opacity:.92}.dlb:hover{filter:brightness(1.1)}.dlb:focus-visible{outline:3px solid #101C26;outline-offset:2px}summary{cursor:pointer;font-weight:600}details p{margin:8px 0 0}\n  .foot{margin-top:28px;font-size:15px;color:var(--muted)}\n</style>')}
${cfg.replace('src="config.js', 'src="/config.js')}
</head>
<body>
<main>
  <div class="top"><a href="/home" style="text-decoration:none;color:inherit">&#9670; <span data-brand>MySimpleDesk</span></a><a href="/">Open the app</a></div>
  <div class="card">
${p.body}
    <p class="foot">${nav}</p>
  </div>
</main>
<script>
${script}
</script>
</body>
</html>
`;
  writeFileSync(p.file + '.html', html);
  console.log(p.file + '.html', html.length);
}
