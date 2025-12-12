// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const config = {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    //
    commonjs(),
    nodeResolve({ preferBuiltins: true }),
    terser({
      compress: { drop_console: true, drop_debugger: true },
      format: { comments: false },
    }),
    typescript(),
  ],
};

export default config;
