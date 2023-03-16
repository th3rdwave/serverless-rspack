'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const { rspack } = require('@rspack/core');
const { log, progress } = require('@serverless/utils/log');

module.exports = {
  watch(command) {
    const functionName = this.options.function;
    const watchProgress = progress.get('rspack');
    if (functionName) {
      log.verbose(`[Rspack] Watch function "${functionName}"`);
      watchProgress.notice(`[Rspack] Watch function "${functionName}"`);
    } else {
      log.verbose('[Rspack] Watch service');
      watchProgress.notice('[Rspack] Watch service');
    }

    const compiler = rspack(this.rspackConfig);
    const watchOptions = {};
    const usePolling = this.options['rspack-use-polling'];
    if (usePolling) {
      watchOptions.poll = _.isInteger(usePolling) ? usePolling : 3000;
      log(`Enabled polling (${watchOptions.poll} ms)`);
    }

    return new BbPromise((resolve, reject) => {
      compiler.watch(watchOptions, (err /*, stats */) => {
        if (err) {
          reject(err);
          return;
        }

        // eslint-disable-next-line promise/catch-or-return, promise/no-promise-in-callback
        BbPromise.try(() => {
          if (this.originalServicePath) {
            process.chdir(this.originalServicePath);
            this.serverless.config.servicePath = this.originalServicePath;
          }

          if (!this.isWatching) {
            this.isWatching = true;
            return BbPromise.resolve();
          }

          log('Sources changed.');
          if (_.isFunction(command)) {
            return command();
          }

          log.verbose(`Invoke ${command}`);
          return this.serverless.pluginManager.spawn(command);
        }).then(() => {
          if (functionName) {
            log.verbose(`[Rspack] Watch function "${functionName}"`);
            watchProgress.notice(`[Rspack] Watch function "${functionName}"`);
          } else {
            log.verbose('[Rspack] Watch service');
            watchProgress.notice('[Rspack] Watch service');
          }
          return null;
        }, reject);
      });
    });
  },
};
