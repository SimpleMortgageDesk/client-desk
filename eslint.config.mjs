// Automatic bug check (runs on every push). Errors fail the check; warnings are only advice.
import globals from 'globals';
const browser = { ...globals.browser, XLSX: 'readonly', pdfjsLib: 'readonly', Tesseract: 'readonly', claude: 'readonly' };
export default [
  { ignores: ['lib/**', 'android/**', 'admin/**', 'media/**'] },
  { files: ['app.js', 'sync.js', 'trades.js', 'config.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: browser } },
  { files: ['sw.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.serviceworker } } },
  { files: ['functions/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } } },
  { rules: {
    'no-undef': 'error', 'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-unreachable': 'error', 'no-self-assign': 'error',
    'no-const-assign': 'error', 'no-func-assign': 'error', 'no-cond-assign': ['error', 'except-parens'], 'no-unsafe-finally': 'error',
    'use-isnan': 'error', 'valid-typeof': 'error', 'no-sparse-arrays': 'error',
    'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-redeclare': 'warn', 'no-useless-escape': 'warn', 'no-fallthrough': 'warn'
  } }
];
