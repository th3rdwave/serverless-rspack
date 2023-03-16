'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const { rspack } = require('@rspack/core');
const { log, progress } = require('@serverless/utils/log');
const logStats = require('./logStats');

module.exports = {
  wpwatch() {
    if (this.options['rspack-no-watch']) {
      return this.serverless.pluginManager.spawn('rspack:compile');
    }

    const watchProgress = progress.get('rspack');
    log.verbose('[Rspack] Building with Rspack');
    watchProgress.update('[Rspack] Building with Rspack');

    const watchOptions = {};
    const usePolling = this.options['rspack-use-polling'];
    if (usePolling) {
      watchOptions.poll = _.isInteger(usePolling) ? usePolling : 3000;
      log(`Enabled polling (${watchOptions.poll} ms)`);
    }

    let currentCompileWatch = null;

    // This allows us to hold the compile until "rspack:compile:watch" has resolved
    const beforeCompile = () =>
      new BbPromise((resolve) => {
        // eslint-disable-next-line promise/catch-or-return
        BbPromise.resolve(currentCompileWatch)
          // Forwarding the error to the then so we don't display it twice
          // (once when it was originally thrown, and once when the promise rejects)
          .catch((error) => error)
          .then((error) => {
            if (error) {
              return null;
            }

            currentCompileWatch = null;
            resolve();
            return null;
          });
      });

    const compiler = rspack(this.rspackConfig);

    // Determine if we can use hooks or if we should fallback to the plugin api
    const hasHooks = compiler.hooks && compiler.hooks.beforeCompile;
    const hasPlugins = compiler.plugin;
    const canEmit = hasHooks || hasPlugins;

    if (hasHooks) {
      compiler.hooks.beforeCompile.tapPromise(
        'rspack:compile:watch',
        beforeCompile,
      );
    } else if (hasPlugins) {
      compiler.plugin('before-compile', (compilationParams, callback) => {
        beforeCompile()
          .then(callback) // eslint-disable-line promise/no-callback-in-promise
          .catch(_.noop);
      });
    }

    const consoleStats = this.rspackConfig.stats;
    // This starts the watch and waits for the immediate compile that follows to end or fail.
    let lastHash = null;

    const startWatch = (callback) => {
      let firstRun = true;
      compiler.watch(watchOptions, (err, stats) => {
        if (err) {
          if (firstRun) {
            firstRun = false;
            return callback(err);
          }
          throw err;
        }

        log.verbose(
          `Rspack watch invoke: HASH NEW=${
            stats && stats.hash
          } CUR=${lastHash}`,
        );

        // If the file hash did not change there were no effective code changes detected
        // (comment changes do not change the compile hash and do not account for a rebuild!)
        // See here: https://rspack.js.org/api/node/#watching (note below watching)
        if (stats && stats.hash === lastHash) {
          if (firstRun) {
            firstRun = false;
            callback();
          }
          return;
        }

        if (stats) {
          lastHash = stats.hash;
          try {
            logStats(stats, consoleStats, {
              ServerlessError: this.serverless.classes.Error,
            });
          } catch (error) {
            log.error(error.message);
          }
        }

        if (firstRun) {
          firstRun = false;
          log.verbose('[Rspack] Watch service...');
          watchProgress.notice('[Rspack] Watch service...');
          callback();
        } else if (canEmit && currentCompileWatch === null) {
          // eslint-disable-next-line promise/no-promise-in-callback
          currentCompileWatch = BbPromise.resolve(
            this.serverless.pluginManager.spawn('rspack:compile:watch'),
          );
        }
      });
    };

    return BbPromise.fromCallback((cb) => {
      startWatch(cb);
    });
  },
};
