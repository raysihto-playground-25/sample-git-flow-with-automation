import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuration files that need special handling with allowDefaultProject
const configFiles = ['scripts/*.mjs', '.ncurc.cjs', 'eslint.config.ts', 'vitest.config.ts'];

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
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.test.ts'],
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
    ignores: ['coverage/', 'dist/', 'node_modules/'],
  },
);
