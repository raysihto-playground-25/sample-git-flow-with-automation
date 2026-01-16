// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

const config = defineConfig({
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    inlineDynamicImports: true,
    sourcemap: false,
  },
  plugins: [
    // @ts-expect-error Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config
    commonjs(),
    // @ts-expect-error Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config
    nodeResolve({ preferBuiltins: true }),
    // @ts-expect-error Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config
    terser({
      compress: { drop_console: true, drop_debugger: true },
      format: { comments: false },
    }),
    // @ts-expect-error Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config
    typescript(),
  ],
  onwarn: (warning, warn) => {
    // Suppress circular dependency warnings for node_modules
    if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.ids?.some((id) => id.includes('node_modules'))) {
      return;
    }
    // Use default warning handler for all other warnings
    warn(warning);
  },
});

export default config;
