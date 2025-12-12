import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/index.js',
    format: 'esm',
    sourcemap: false,
  },
  external: [],
  plugins: [
    // Resolve node_modules
    resolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    // Convert CommonJS modules to ES6
    commonjs(),
    // Handle JSON imports
    json(),
    // Compile TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
      sourceMap: false,
    }),
    // Minify the output
    terser({
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    }),
  ],
};
