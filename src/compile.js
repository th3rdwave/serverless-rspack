'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const pLimit = require('p-limit');
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
    rspack(config).run((error, stats) => {
      if (error) {
        reject(error);
      } else {
        resolve(stats);
      }
    });
  });
}

async function rspackCompile(config, logStats) {
  const functionName = config.output.path.split(path.sep).pop();
  const start = Date.now();

  let stats = await rspackAsync(config);
  stats = stats.stats ? stats.stats : [stats];

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
  const errors = [];

  const logStats = getStatsLogger(configs[0].stats, { ServerlessError });

  const limit = pLimit(1);
  const stats = await Promise.all(
    configs.map((config) =>
      limit(async () => {
        try {
          return await rspackCompile(config, logStats, ServerlessError);
        } catch (error) {
          errors.push(error);
          return error.stats;
        }
      }),
    ),
  );

  if (errors.length) {
    throw new ServerlessError(
      `Rspack compilation failed:\n\n${errors
        .map((error) => error.message)
        .join('\n\n')}`,
    );
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
