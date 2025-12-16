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
    // @ts-expect-error ---
    commonjs(),
    // @ts-expect-error ---
    nodeResolve({ preferBuiltins: true }),
    // @ts-expect-error ---
    terser({
      compress: { drop_console: true, drop_debugger: true },
      format: { comments: false },
    }),
    // @ts-expect-error ---
    typescript(),
  ],
});

export default config;
