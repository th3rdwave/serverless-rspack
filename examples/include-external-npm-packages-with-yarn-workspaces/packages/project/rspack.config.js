const slsw = require('serverless-rspack');

const isLocal = slsw.lib.rspack.isLocal;

module.exports = {
  mode: isLocal ? 'development' : 'production',
  entry: slsw.lib.entries,
  target: 'node',
};
