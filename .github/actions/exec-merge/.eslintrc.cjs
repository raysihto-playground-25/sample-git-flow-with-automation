module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.test.ts'],
  rules: {
    // Allow explicit any in some cases for GitHub API responses
    '@typescript-eslint/no-explicit-any': 'warn',
    // Enforce consistent type imports
    '@typescript-eslint/consistent-type-imports': 'error',
  },
};
