'use strict';

const _ = require('lodash');
const path = require('path');

/**
 * Special settings for use with serverless-offline.
 */

module.exports = {
  prepareOfflineInvoke() {
    this.skipCompile =
      _.get(this.serverless, 'service.custom.rspack.noBuild') === true ||
      _.get(this.options, 'skip-build') === true;

    // Use service packaging for compile
    _.set(this.serverless, 'service.package.individually', false);

    return this.serverless.pluginManager.spawn('rspack:validate').then(() => {
      // Set offline location automatically if not set manually
      if (
        !this.options.location &&
        !_.get(this.serverless, 'service.custom.serverless-offline.location')
      ) {
        _.set(
          this.serverless,
          'service.custom.serverless-offline.location',
          path.relative(
            this.serverless.config.servicePath,
            path.join(this.rspackOutputPath, 'service'),
          ),
        );
      }
      return null;
    });
  },
};
