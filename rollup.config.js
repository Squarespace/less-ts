import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

export default {
  entry: './src/generate.ts',
  plugins: [
    typescript({
      tsconfigOverride: { 
        compilerOptions: {
          allowJs: true,
          module: 'esnext',
          declaration: false
        }
      },
      typescript: require('typescript')
    }),
    resolve()
  ],
  format: 'es',
  sourceMap: true,
  dest: 'dist/generate.js',
  external: [
    'core-js/library/modules/es6.set',
    'fs',
    'path',
    'cluster'
  ]
}

