const path = require('path');
const slsw = require('serverless-rspack');

const isLocal = slsw.lib.rspack.isLocal;

module.exports = {
  mode: isLocal ? 'development' : 'production',
  entry: slsw.lib.entries,
  devtool: 'source-map',
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.rspack'),
    filename: '[name].js',
  },
  target: 'node',
};
