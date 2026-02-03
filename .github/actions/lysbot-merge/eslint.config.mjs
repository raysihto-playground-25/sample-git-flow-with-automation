import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
/* @ts-expect-error -- ESLint plugin module is required at runtime, but does not provide TypeScript typings */
import eslintComments from 'eslint-plugin-eslint-comments';
import import_ from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
/* @ts-expect-error -- ESLint plugin module is required at runtime, but does not provide TypeScript typings */
import promise from 'eslint-plugin-promise';
import tseslint from 'typescript-eslint';

const config = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      // keep this list sorted alphabetically
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ESLint plugin import is valid at runtime, but lacks proper TypeScript typings */
      eslintComments,
      import_,
      prettier,
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ESLint plugin import is valid at runtime, but lacks proper TypeScript typings */
      promise,
      stylistic,
    },

    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },

    rules: {
      // keep this list sorted alphabetically
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'eslintComments/disable-enable-pair': ['error', { allowWholeFile: true }],
      'eslintComments/no-unlimited-disable': 'error',
      'eslintComments/no-unused-disable': 'error',
      'eslintComments/no-use': ['error', { allow: ['eslint-disable-next-line'] }],
      'eslintComments/require-description': ['error', { ignore: [] }],
      'import_/no-deprecated': 'error',
      'import_/no-duplicates': 'error',
      'import_/no-unresolved': 'error',
      'import_/order': ['error', { alphabetize: { order: 'asc' }, 'newlines-between': 'always' }],
      'no-console': 'error',
      'no-process-exit': 'error',
      'no-sync': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prettier/prettier': 'error',
      'promise/always-return': 'warn',
      'promise/catch-or-return': 'error',
      'promise/no-nesting': 'warn',
      'promise/no-return-wrap': 'error',
      'stylistic/member-delimiter-style': [
        'error',
        { multiline: { delimiter: 'semi', requireLast: true }, singleline: { delimiter: 'semi', requireLast: false } },
      ],
      'stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0 }],
      'stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
      ],
      curly: 'error',
      eqeqeq: 'error',
    },
  },

  {
    files: ['__tests__/**/*.test.ts'],
    rules: {
      // Allow async functions without await in test files for mock implementations
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Debug helper for config files:
  // Uncomment temporarily when inspecting config behavior with console.
  // Revert after use.
  // { files: ['*.config.mjs'], languageOptions: { globals: { console: 'readonly' } }, rules: { 'no-console': 'off' } },

  {
    files: ['.ncurc.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'readonly' } },
  },

  {
    ignores: [
      // keep this list sorted alphabetically
      'coverage/',
      'dist/',
      'node_modules/',
    ],
  },
);

export default config;
