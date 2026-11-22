// Checks the js/app-*.js files as one program, the way the browser runs them:
//  1. a name used while the page is starting up must already exist (files load in the order index.html lists them)
//  2. functions nothing calls any more (dead code), reported as advice
// Run:  node tools/check-code.mjs     (needs the "acorn" package: npm install --no-save acorn)
import fs from 'node:fs';
import * as acorn from 'acorn';

const html = fs.readFileSync('index.html', 'utf8');
const order = [...html.matchAll(/src="(js\/app-[\w-]+\.js)/g)].map((m) => m[1]);
const sources = order.map((f) => fs.readFileSync(f, 'utf8'));
const trees = sources.map((s) =>
  acorn.parse(s, { ecmaVersion: 2022, sourceType: 'script', locations: true })
);

const fnFile = new Map(),
  varFile = new Map(),
  fnNode = new Map();
trees.forEach((ast, fi) =>
  ast.body.forEach((n) => {
    if (n.type === 'FunctionDeclaration') {
      fnFile.set(n.id.name, fi);
      fnNode.set(n.id.name, n);
    } else if (n.type === 'VariableDeclaration')
      n.declarations.forEach((d) => {
        if (d.id.type === 'Identifier' && !varFile.has(d.id.name)) varFile.set(d.id.name, fi);
      });
  })
);

const KEYS = (k) => !['loc', 'start', 'end', 'type'].includes(k);
function walk(node, on) {
  (function v(n) {
    if (!n || typeof n.type !== 'string') return;
    if (on(n) === false) return;
    for (const k of Object.keys(n))
      if (KEYS(k)) {
        const x = n[k];
        Array.isArray(x) ? x.forEach(v) : x && typeof x.type === 'string' && v(x);
      }
  })(node);
}
const idsIn = (node) => {
  const s = new Set();
  walk(node, (n) => {
    if (n.type === 'Identifier') s.add(n.name);
  });
  return s;
};
const callsIn = (node) => {
  const s = new Set();
  walk(node, (n) => {
    if ((n.type === 'CallExpression' || n.type === 'NewExpression') && n.callee.type === 'Identifier')
      s.add(n.callee.name);
  });
  return s;
};
// what runs while the file loads: everything except the inside of functions that are only defined there
function startIds(node, calls) {
  const s = new Set();
  (function v(n) {
    if (!n || typeof n.type !== 'string' || n.type === 'FunctionDeclaration') return;
    if ((n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') && !n._now) return;
    if (n.type === 'CallExpression' && /Function/.test(n.callee.type)) n.callee._now = true;
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier') s.add(n.callee.name);
    if (n.type === 'Identifier' && !calls) {
      s.add(n.name);
      return;
    }
    if (n.type === 'MemberExpression') {
      v(n.object);
      if (n.computed) v(n.property);
      return;
    }
    if (n.type === 'Property') {
      if (n.computed) v(n.key);
      v(n.value);
      return;
    }
    for (const k of Object.keys(n))
      if (KEYS(k)) {
        const x = n[k];
        Array.isArray(x) ? x.forEach(v) : x && typeof x.type === 'string' && v(x);
      }
  })(node);
  return s;
}
const problems = [];
const bodyCalls = new Map(),
  bodyIds = new Map();
for (const [nm, n] of fnNode) {
  bodyCalls.set(nm, callsIn(n.body));
  bodyIds.set(nm, idsIn(n.body));
}
trees.forEach((ast, fi) =>
  ast.body.forEach((n) => {
    if (n.type === 'FunctionDeclaration') return;
    const where = `${order[fi]}:${n.loc.start.line}`;
    // 1a. names used directly while loading
    for (const r of startIds(n, false)) {
      const later =
        (fnFile.has(r) && fnFile.get(r) > fi) || (varFile.has(r) && !fnFile.has(r) && varFile.get(r) > fi);
      const ownDecl = n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id.name === r);
      if (later && !ownDecl)
        problems.push(
          `${where} uses "${r}" which is defined later, in ${order[Math.max(fnFile.get(r) ?? 0, varFile.get(r) ?? 0)]}`
        );
    }
    // 1b. functions called while loading, and everything they call
    const seen = new Set(),
      q = [...startIds(n, true)].filter((x) => fnFile.has(x));
    while (q.length) {
      const f = q.pop();
      if (seen.has(f)) continue;
      seen.add(f);
      if (fnFile.get(f) > fi)
        problems.push(`${where} calls "${f}" which is defined later, in ${order[fnFile.get(f)]}`);
      bodyCalls.get(f).forEach((c) => {
        if (fnFile.has(c) && !seen.has(c)) q.push(c);
      });
    }
    for (const f of seen)
      for (const r of bodyIds.get(f))
        if (varFile.has(r) && !fnFile.has(r) && varFile.get(r) > fi)
          problems.push(
            `${where}: "${f}" (run while loading) reads "${r}" which is declared later, in ${order[varFile.get(r)]}`
          );
  })
);

// 2. functions that nothing mentions (advice only)
const all =
  sources.join('\n') +
  '\n' +
  ['sync.js', 'trades.js', 'index.html'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const dead = [...fnFile.keys()].filter(
  (n) =>
    (all.match(new RegExp('(?<![\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])', 'g')) || []).length < 2
);

const uniq = [...new Set(problems)];
if (uniq.length) {
  console.log('PROBLEMS (a file uses something that is not there yet when the page starts):');
  uniq.forEach((p) => console.log('  ' + p));
}
if (dead.length) console.log('Advice: functions nothing refers to any more:', dead.join(', '));
console.log(
  `${order.length} files, ${fnFile.size} functions, ${varFile.size} shared variables. ${uniq.length ? uniq.length + ' problem(s)' : 'No start-up order problems.'}`
);
process.exit(uniq.length ? 1 : 0);
