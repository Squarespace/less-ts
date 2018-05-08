import typescript from 'rollup-plugin-typescript';

export default {
  entry: './src/index.ts',
  plugins: [
    typescript({
      typescript: require('typescript')
    })
  ],
  format: 'cjs',
  sourceMap: true,
  dest: 'dist/dist.js'
}

