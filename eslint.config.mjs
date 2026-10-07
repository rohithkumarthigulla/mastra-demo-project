import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/web-build/**',
      '**/coverage/**',
      'apps/api/drizzle/**',
      '.artifacts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/api/**', 'packages/**', '*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/client/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
