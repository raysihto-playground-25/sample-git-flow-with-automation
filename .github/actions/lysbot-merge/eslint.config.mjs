import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Configuration files that need special handling with allowDefaultProject
const configFiles = ['scripts/*.mjs', '.ncurc.cjs', 'eslint.config.mjs', 'vitest.config.ts'];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
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
    files: configFiles,
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: configFiles,
        },
      },
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
