import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      /* Security: no dynamic code execution or raw HTML anywhere in the app. */
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Documents must never be persisted.' },
        { object: 'window', property: 'sessionStorage', message: 'Documents must never be persisted.' },
        { object: 'document', property: 'cookie', message: 'Documents must never be persisted.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Documents must never be persisted.' },
        { name: 'sessionStorage', message: 'Documents must never be persisted.' },
        { name: 'indexedDB', message: 'Documents must never be persisted.' },
        { name: 'fetch', message: 'Redacta is client-side only — no network requests.' },
        { name: 'XMLHttpRequest', message: 'Redacta is client-side only — no network requests.' },
        { name: 'WebSocket', message: 'Redacta is client-side only — no network requests.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render text through React; never inject raw HTML.',
        },
        {
          selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
          message: 'Never assign raw HTML.',
        },
        {
          selector: "MemberExpression[object.name='navigator'][property.name='sendBeacon']",
          message: 'Redacta is client-side only — no network requests.',
        },
      ],
    },
  },
  {
    files: ['*.{js,ts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
