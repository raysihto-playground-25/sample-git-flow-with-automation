import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Configuration files that need special handling with allowDefaultProject
const configFiles = ['scripts/*.mjs', '.ncurc.cjs', 'eslint.config.mjs', 'vitest.config.ts'];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: configFiles,
        },
        tsconfigRootDir: import.meta.dirname,
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
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
);
