/* Builds the live copy of the site into dist/ :
     - makes the JavaScript and CSS smaller (comments, spaces and long names removed; nothing else changes)
     - stamps every file with a short code taken from its content, so a changed file is always fetched fresh
       and the "new version ready" bar appears by itself - no more bumping version labels by hand
     - leaves out things that are not part of the website (android/, tools/, tests, notes)
   Run:  npm install --no-save esbuild   then   node tools/build.mjs
   The source files in the repo stay readable and keep working unbuilt, so the site can also be served as-is. */
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
let esbuild;
try {
  esbuild = await import('esbuild');
} catch (e) {
  console.error('esbuild is missing. Run:  npm install --no-save esbuild');
  process.exit(1);
}

/* what the website consists of */
const FOLDERS = ['admin', '.well-known', 'lib', 'media', 'js'];
const FILES = [
  'index.html',
  'home.html',
  'privacy.html',
  'explainer.html',
  '404.html',
  'config.js',
  'trades.js',
  'sync.js',
  'styles.css',
  'sw.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'robots.txt',
  'sitemap.xml',
  '_headers',
  'version.json'
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) if (existsSync(join(root, f))) cpSync(join(root, f), join(out, f));
for (const d of FOLDERS)
  if (existsSync(join(root, d))) cpSync(join(root, d), join(out, d), { recursive: true });

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/* 1. smaller JavaScript and CSS (our own files only, not the ready-made files in lib/) */
let before = 0,
  after = 0;
const mine = walk(out).filter(
  (p) => /\.(js|css)$/.test(p) && !p.includes('/lib/') && !p.includes('/.well-known/')
);
for (const p of mine) {
  const src = readFileSync(p, 'utf8');
  const r = await esbuild.transform(src, {
    loader: p.endsWith('.css') ? 'css' : 'js',
    minify: true,
    target: p.endsWith('.css') ? 'chrome80' : 'es2019',
    legalComments: 'none'
  });
  before += Buffer.byteLength(src);
  after += Buffer.byteLength(r.code);
  writeFileSync(p, r.code);
}

/* 2. one short code for this exact content */
const h = createHash('sha256');
for (const p of walk(out)
  .filter((p) => /\.(js|css|html|webmanifest)$/.test(p) && !p.includes('/lib/'))
  .sort()) {
  h.update(p.slice(out.length)).update(readFileSync(p));
}
const code = h.digest('hex').slice(0, 8);

/* the LATESTnnn number is still the one people read; it comes from version.json and must match index.html */
const num = (JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).build.match(/LATEST\d+/) || [
  ''
])[0];
const indexTxt = readFileSync(join(out, 'index.html'), 'utf8');
if (!num || !indexTxt.includes(num)) {
  console.error(
    'version.json says ' + (num || 'nothing') + ' but index.html does not mention it. Make them match.'
  );
  process.exit(1);
}
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' ' + num + '-' + code;

for (const p of walk(out).filter((p) => /\.html$/.test(p))) {
  let t = readFileSync(p, 'utf8');
  t = t
    .replace(/\?v=\d{12}/g, '?v=' + code)
    .replace(/window\.MD_BUILD="[^"]*"/, 'window.MD_BUILD="' + stamp + '"');
  writeFileSync(p, t);
}
const sw = join(out, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replace(/client-desk-v\d+/, 'client-desk-' + code));
writeFileSync(join(out, 'version.json'), JSON.stringify({ build: stamp }) + '\n');

console.log(
  'Built dist/  ' +
    stamp +
    '  JS+CSS ' +
    (before / 1024).toFixed(0) +
    ' KB -> ' +
    (after / 1024).toFixed(0) +
    ' KB'
);
