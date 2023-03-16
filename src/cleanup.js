'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const fse = require('fs-extra');
const { log } = require('@serverless/utils/log');

module.exports = {
  cleanup() {
    const rspackOutputPath = this.rspackOutputPath;
    const keepOutputDirectory =
      this.keepOutputDirectory || this.configuration.keepOutputDirectory;

    if (!keepOutputDirectory) {
      log.verbose(`Remove ${rspackOutputPath}`);
      if (this.serverless.utils.dirExistsSync(rspackOutputPath)) {
        // Remove async to speed up process
        fse
          .remove(rspackOutputPath)
          .then(() => {
            log.verbose(`Removing ${rspackOutputPath} done`);
            return null;
          })
          .catch((error) => {
            log.error(
              `Error occurred while removing ${rspackOutputPath}: ${error}`,
            );
          });
      }
    } else {
      log(`Keeping ${rspackOutputPath}`);
    }

    return BbPromise.resolve();
  },
};
