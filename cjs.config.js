import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin'

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/cjs/index.js',
    format: 'cjs'
  },
  exports: 'named',
  plugins: [optimizeLodashImports()]
}
