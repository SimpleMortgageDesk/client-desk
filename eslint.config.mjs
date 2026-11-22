// Automatic bug check (runs on every push). Errors fail the check; warnings are only advice.
// The js/app-*.js files are loaded one after another on the same page and share their names, so
// the names defined in any of them are read from the files themselves and allowed in all of them.
import fs from 'node:fs';
import * as espree from 'espree';
import globals from 'globals';

const shared = {};
for (const f of fs.readdirSync('js').filter(f => /^app-.*\.js$/.test(f))) {
  const ast = espree.parse(fs.readFileSync('js/' + f, 'utf8'), { ecmaVersion: 2022, sourceType: 'script' });
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration') shared[n.id.name] = 'writable';
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') shared[d.id.name] = 'writable';
  }
}
const browser = { ...globals.browser, XLSX: 'readonly', pdfjsLib: 'readonly', Tesseract: 'readonly', claude: 'readonly' };

export default [
  { ignores: ['lib/**', 'android/**', 'admin/**', 'media/**'] },
  { files: ['js/app-*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...browser, ...shared } } },
  { files: ['sync.js', 'trades.js', 'config.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: browser } },
  { files: ['sw.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.serviceworker } } },
  { files: ['tools/**/*.mjs', 'eslint.config.mjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } } },
  { files: ['functions/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } } },
  { rules: {
    'no-undef': 'error', 'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-unreachable': 'error', 'no-self-assign': 'error',
    'no-const-assign': 'error', 'no-func-assign': 'error', 'no-cond-assign': ['error', 'except-parens'], 'no-unsafe-finally': 'error',
    'use-isnan': 'error', 'valid-typeof': 'error', 'no-sparse-arrays': 'error',
    // names shared between the js/app-*.js files are checked by tools/check-code.mjs instead
    'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }], 'no-redeclare': ['warn', { builtinGlobals: false }], 'no-useless-escape': 'warn', 'no-fallthrough': 'warn'
  } }
];
