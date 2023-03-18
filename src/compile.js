'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const path = require('path');
const { rspack } = require('@rspack/core');
const { log, progress } = require('@serverless/utils/log');
const isBuiltinModule = require('is-builtin-module');
const logStats = require('./logStats');

function ensureArray(obj) {
  return _.isArray(obj) ? obj : [obj];
}

function getStatsLogger(statsConfig, { ServerlessError }) {
  return (stats) => {
    logStats(stats, statsConfig, { ServerlessError });
  };
}

function isIndividialPackaging() {
  return _.get(this.serverless, 'service.package.individually');
}

function getExternalModuleName(module) {
  const pathArray = module.identifier.split(' ');
  if (pathArray.length < 2) {
    throw new Error(
      `Unable to extract module name from Rspack identifier: ${module.identifier}`,
    );
  }

  const path = pathArray[pathArray.length - 1];
  const pathComponents = path.split('/');
  const main = pathComponents[0];

  // this is a package within a namespace
  if (main.charAt(0) == '@') {
    return `${main}/${pathComponents[1]}`;
  }

  return main;
}

function isExternalModule(module) {
  return (
    _.startsWith(module.identifier, 'external ') &&
    !isBuiltinModule(getExternalModuleName(module))
  );
}

function getExternalModules(stats) {
  const { modules } = stats.toJson({ modules: true });
  const externals = new Set();
  for (const module of modules) {
    if (isExternalModule(module)) {
      externals.add({
        origin: undefined,
        external: getExternalModuleName(module),
      });
    }
  }
  return Array.from(externals);
}

function rspackAsync(config) {
  return new Promise((resolve, reject) => {
    const compiler = rspack(config);
    compiler.run((error, stats) => {
      if (error) {
        reject(error);
      } else {
        resolve(stats);
      }
      // This crashes if invoked immediately.
      // Remove when rspack can cleanup itself.
      setTimeout(() => {
        compiler.close(() => {});
      }, 100);
    });
  });
}

async function rspackCompile(config, ServerlessError) {
  const functionName = config.output.path.split(path.sep).pop();
  const start = Date.now();

  let stats = await rspackAsync(config);
  stats = stats.stats ? stats.stats : [stats];

  const logStats = getStatsLogger(config.stats, { ServerlessError });
  stats.forEach(logStats);

  const result = stats.map((compileStats) => ({
    outputPath: compileStats.compilation.compiler.outputPath,
    externalModules: getExternalModules(compileStats),
  }));

  log(
    `[Rspack] Compiled function "${functionName}" in ${Date.now() - start}ms`,
  );

  return result;
}

async function rspackConcurrentCompile(configs, concurrency, ServerlessError) {
  const stats = [];
  try {
    // For now Rspack is already concurrent, and uses a good amount of memory,
    // so run in sequence.
    // TODO: Investigate perf when running multiple builds concurrently.
    for (const config of configs) {
      const stat = await rspackCompile(config, ServerlessError);
      stats.push(stat);
    }
  } catch (error) {
    throw new ServerlessError(`Rspack compilation failed:\n\n${error.message}`);
  }

  return stats.flat();
}

module.exports = {
  async compile() {
    log.verbose('[Rspack] Building with Rspack');
    progress.get('rspack').update('[Rspack] Building with Rspack');

    const configs = ensureArray(this.rspackConfig);
    if (configs[0] === undefined) {
      throw new this.serverless.classes.Error(
        'Unable to find Rspack configuration',
      );
    }

    if (!this.configuration) {
      throw new this.serverless.classes.Error('Missing plugin configuration');
    }
    const concurrency = this.configuration.concurrency;

    const stats = await rspackConcurrentCompile(
      configs,
      concurrency,
      this.serverless.classes.Error,
    );
    this.compileStats = { stats };
  },
};
