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

  onwarn(warning, defaultHandler) {
    // Warnings originating entirely from node_modules may be candidates for suppression until upstream issues are resolved.
    const ids = warning.ids ?? (warning.id ? [warning.id] : []);
    if (0 < ids.length && ids.every((id) => id.includes('/node_modules/'))) {
      // Suppress some warnings from node_modules; this may become unnecessary once the upstream dependencies are fixed.
      if (warning.code === 'CIRCULAR_DEPENDENCY' || warning.code === 'THIS_IS_UNDEFINED') {
        return;
      }
    }
    defaultHandler(warning);
  },

  plugins: [
    /* @ts-expect-error -- Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config */
    commonjs(),
    /* @ts-expect-error -- Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config */
    nodeResolve({ preferBuiltins: true }),
    /* @ts-expect-error -- Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config */
    terser({
      compress: { drop_console: true, drop_debugger: true },
      format: { comments: false },
    }),
    /* @ts-expect-error -- Rollup plugin is callable at runtime, but TS treats this ESM import type as non-callable in .mjs config */
    typescript(),
  ],
});

export default config;
