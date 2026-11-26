/* Makes one landing page per trade (for/<slug>.html) and the sitemap from home.html and tools/trade-content.mjs.
   Run:  node tools/make-trade-pages.mjs   then commit the result. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { TRADES, COMMON_FAQS } from './trade-content.mjs';
const SITE = 'https://mysimpledesk.co.uk';
const home = readFileSync('home.html', 'utf8');
const cut = (a, b, from = 0) => {
  const i = home.indexOf(a, from);
  const j = home.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('missing ' + a);
  return home.slice(i, j + b.length);
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const style = cut('<style>', '</style>');
const configTag = home
  .match(/<script src="config\.js[^>]*><\/script>/)[0]
  .replace('src="config.js', 'src="/config.js');
const icons = home
  .match(/<meta name="theme-color"[^\n]*\n/)[0]
  .replace('href="manifest.webmanifest"', 'href="/manifest.webmanifest"')
  .replace('href="apple-touch-icon.png', 'href="/apple-touch-icon.png');
const header = cut('<header>', '</header>')
  .replace('href="#top"', 'href="/home"')
  .replace(
    /<nav class="links"[\s\S]*?<\/nav>/,
    '<nav class="links" aria-label="Page sections"><a href="#help">What it keeps track of</a><a href="/home#privacy">Your data</a><a href="#faq">Questions</a></nav>'
  )
  .replace(/href="\.\/\?p=/g, 'href="/?p=');
const trust = cut('<div class="trustbar"', '</div>\n</div>').replace(
  'href="#privacy"',
  'href="/home#privacy"'
);
const footer = cut('<footer>', '</footer>').replace('href="privacy.html"', 'href="/privacy"');
let script = cut('<script>\n(function () {', '})();\n')
  .replace(/\n  document\.title = [^\n]*/, '')
  .replace('a[href^="./?p="]', 'a[href^="/?p="]')
  .replace("a.href = './'", "a.href = '/'");
const slideOf = (name) => {
  const re = new RegExp(
    '<div class="slide[^"]*"[^>]*aria-label="\\d+ of \\d+: ' +
      name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '"[^>]*>'
  );
  const m = re.exec(home);
  if (!m) throw new Error('slide ' + name);
  let i = m.index,
    d = 0,
    k = i;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = i;
  let t;
  while ((t = tag.exec(home))) {
    d += t[0] === '</div>' ? -1 : 1;
    if (!d) {
      k = tag.lastIndex;
      break;
    }
  }
  return home.slice(i, k);
};
const faqHtml = (f) =>
  f.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
const ld = (o) => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>';
const app = (t) => ({
  '@type': 'SoftwareApplication',
  name: 'MySimpleDesk',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser, Android',
  url: SITE + '/for/' + t.slug,
  description: t.desc,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'GBP',
    description: 'First year free, no card needed'
  },
  audience: { '@type': 'Audience', audienceType: t.name }
});
mkdirSync('for', { recursive: true });
for (const t of TRADES) {
  const url = SITE + '/for/' + t.slug,
    faqs = [...t.faqs, ...COMMON_FAQS];
  const raw = slideOf(t.slide);
  const slide = raw
    .replace(/ data-hold="2"/, '')
    .replace(/ aria-hidden="true"/, '')
    .replace(/class="slide[^"]*"/, 'class="slide on"')
    .replace(/aria-label="\d+ of \d+: /, 'aria-label="')
    .replace(' role="group" aria-roledescription="slide"', ' role="group"');
  const acc = /--acc:(#[0-9A-Fa-f]{6})/.exec(raw)[1],
    soft = /--soft:(#[0-9A-Fa-f]{6})/.exec(raw)[1];
  const others = TRADES.filter((x) => x.slug !== t.slug)
    .map((x) => `<a href="/for/${x.slug}">${esc(x.name)}</a>`)
    .join(' · ');
  const title = t.title + ' | MySimpleDesk';
  const graph = [
    app(t),
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a }
      }))
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MySimpleDesk', item: SITE + '/home' },
        { '@type': 'ListItem', position: 2, name: 'For ' + t.name, item: url }
      ]
    }
  ];
  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(t.desc)}">
${icons}<link rel="icon" href="/icon-192.png?v=3">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:image" content="${SITE}/icon-512.png">
<meta name="twitter:card" content="summary">
${ld({ '@context': 'https://schema.org', '@graph': graph })}
${configTag}
${style}
</head>
<body>
${header.replace('href="/?p=register"', `href="/?p=register&trade=${t.tid}"`)}
${trust}

<main id="top">
<div class="hero">
  <div class="wrap">
    <div>
      <span class="pill"><b>First year free.</b> No card needed.</span>
      <h1>${t.h1}</h1>
      <p class="lead">${esc(t.lead)}</p>
      <div class="cta">
        <a class="btn pri" href="/?p=register&trade=${t.tid}">Start free</a>
        <a class="btn sec" href="/home">See what else it does</a>
      </div>
    </div>
    <div class="show" style="--acc:${acc};--soft:${soft}" aria-label="How MySimpleDesk looks for ${esc(t.name)} (invented example)">
      <div class="mock">${slide}</div>
    </div>
  </div>
</div>
<section id="help" aria-labelledby="help-h">
  <div class="wrap">
    <div class="kicker">For ${esc(t.name)}</div>
    <h2 id="help-h">What it keeps track of for you</h2>
    <p class="intro">Add something once and the app does the reminding. You only see the screens you need.</p>
    <div class="who">
${t.cards.map(([h, li]) => `      <div class="card"><h3>${esc(h)}</h3><ul>${li.map((x) => '<li>' + esc(x) + '</li>').join('')}</ul></div>`).join('\n')}
    </div>
  </div>
</section>
<section class="alt" aria-labelledby="priv-h">
  <div class="wrap" style="max-width:820px">
    <div class="kicker">Your data stays yours</div>
    <h2 id="priv-h">Your records never come to us</h2>
    <p class="intro">Everything you add is saved as files in a folder in your own <span data-store>OneDrive</span>. We run no database of your customers, and you can open the folder any time. <a href="/home#privacy">How it works</a></p>
  </div>
</section>
<section id="faq" aria-labelledby="faq-h">
  <div class="wrap" style="max-width:820px">
    <div class="kicker">Questions</div>
    <h2 id="faq-h">Good to know</h2>
${faqHtml(faqs)}
  </div>
</section>
<section class="alt" aria-labelledby="oth-h">
  <div class="wrap" style="max-width:820px">
    <h2 id="oth-h" style="font-size:20px">Other trades and professions</h2>
    <p>${others} · <a href="/home">home owners and families</a></p>
  </div>
</section>
<section style="padding-top:0">
  <div class="wrap">
    <div class="final">
      <h2>Start knowing nothing is missed</h2>
      <p>Sign in with your email account and start in a minute. The first year is free and needs no card.</p>
      <div class="cta">
        <a class="btn pri" href="/?p=register&trade=${t.tid}">Start free</a>
      </div>
    </div>
  </div>
</section>
</main>
${footer}
${script}
</body>
</html>
`;
  writeFileSync('for/' + t.slug + '.html', html);
  console.log('for/' + t.slug + '.html', html.length);
}
const today = new Date().toISOString().slice(0, 10);
const urls = [
  '/home',
  ...TRADES.map((t) => '/for/' + t.slug),
  '/about',
  '/download',
  '/support',
  '/security',
  '/terms',
  '/privacy'
];
writeFileSync(
  'sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n'
);
