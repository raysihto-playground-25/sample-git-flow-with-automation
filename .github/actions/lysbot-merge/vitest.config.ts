import { defineConfig } from 'vitest/config';

const config = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['__tests__/**/*.test.ts', 'src/index.ts'],
    },
  },
});

export default config;
