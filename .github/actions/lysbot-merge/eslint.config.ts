import { dirname } from 'path';
import { fileURLToPath } from 'url';

import eslint from '@eslint/js';
// @ts-expect-error - eslint-plugin-import doesn't have proper types
import importPlugin from 'eslint-plugin-import';
// @ts-expect-error - eslint-plugin-promise doesn't have proper types
import promisePlugin from 'eslint-plugin-promise';
import tseslint from 'typescript-eslint';

// Configuration files that need special handling with allowDefaultProject
const configFiles = [
  // keep this list sorted alphabetically
  '.ncurc.cjs',
  'eslint.config.ts',
  'prettier.config.ts',
  'rollup.config.mjs',
  'vitest.config.ts',
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: configFiles,
        },
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
    },
  },
  {
    plugins: {
      import: importPlugin,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      promise: promisePlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'import/no-unresolved': 'error',
      'import/order': ['error', { alphabetize: { order: 'asc' }, 'newlines-between': 'always' }],
      'no-console': 'error',
      'no-process-exit': 'error',
      'no-sync': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'promise/always-return': 'warn',
      'promise/catch-or-return': 'error',
      'promise/no-nesting': 'warn',
      'promise/no-return-wrap': 'error',
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
  {
    files: configFiles,
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-console': 'off',
    },
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
