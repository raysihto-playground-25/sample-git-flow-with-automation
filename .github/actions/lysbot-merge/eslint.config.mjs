import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      // Allow explicit any in some cases for GitHub API responses
      '@typescript-eslint/no-explicit-any': 'warn',
      // Enforce consistent type imports
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module', // ES Modules対応
      parserOptions: {
        project: null, // ✅ 型チェックを無効化
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      // JS用の追加ルール
      'no-unused-vars': 'warn',
      // Node.jsスクリプトなのでconsoleは許可
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '**/*.test.ts'],
  },
);
