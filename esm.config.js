import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin'

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/esm/index.js',
    format: 'es'
  },
  exports: 'named',
  plugins: [optimizeLodashImports({
    // explore this in the future upon further research
    // useLodashEs: true
  })]
}
