const BbPromise = require('bluebird');
const _ = require('lodash');
const { log, progress } = require('@serverless/utils/log');

const validate = require('./validate');
const compile = require('./compile');
const wpwatch = require('./wpwatch');
const cleanup = require('./cleanup');
const run = require('./run');
const prepareLocalInvoke = require('./prepareLocalInvoke');
const runPluginSupport = require('./runPluginSupport');
const prepareOfflineInvoke = require('./prepareOfflineInvoke');
const prepareStepOfflineInvoke = require('./prepareStepOfflineInvoke');
const packExternalModules = require('./packExternalModules');
const packageModules = require('./packageModules');
const { isNodeRuntime } = require('./utils');
const { extendFunctionProperties } = require('./extendServerless');
const lib = require('./lib');

class ServerlessRspack {
  static get lib() {
    return lib;
  }

  constructor(serverless, options) {
    this.serverless = serverless;
    extendFunctionProperties(this.serverless);

    this.options = options;

    _.assign(
      this,
      validate,
      compile,
      wpwatch,
      cleanup,
      run,
      packExternalModules,
      packageModules,
      prepareLocalInvoke,
      runPluginSupport,
      prepareOfflineInvoke,
      prepareStepOfflineInvoke,
    );

    this.commands = {
      rspack: {
        usage: 'Bundle with Rspack',
        lifecycleEvents: ['rspack'],
        options: {
          out: {
            usage: 'Path to output directory',
            shortcut: 'o',
            type: 'string',
          },
        },
        commands: {
          validate: {
            type: 'entrypoint',
            lifecycleEvents: ['validate'],
          },
          compile: {
            type: 'entrypoint',
            lifecycleEvents: ['compile'],
            commands: {
              watch: {
                type: 'entrypoint',
                lifecycleEvents: ['compile'],
              },
            },
          },
          package: {
            type: 'entrypoint',
            lifecycleEvents: [
              'packExternalModules',
              'packageModules',
              'copyExistingArtifacts',
            ],
          },
        },
      },
      invoke: {
        commands: {
          local: {
            options: {
              'skip-build': {
                usage: 'Skip Rspack compilation',
                type: 'boolean',
              },
              watch: {
                usage: 'Flag to watch changes',
                type: 'boolean',
              },
              'rspack-use-polling': {
                usage:
                  'Define time (in ms) for polling for changes. Default: `3000`',
                type: 'string',
              },
            },
          },
        },
      },
      offline: {
        options: {
          'rspack-no-watch': {
            usage: 'Disable automatic watch mode from Serverless Rspack',
            type: 'boolean',
          },
          'skip-build': {
            usage: 'Skip Rspack compilation',
            type: 'boolean',
          },
        },
        commands: {
          start: {
            options: {
              'rspack-no-watch': {
                usage: 'Disable automatic watch mode from Serverless Rspack',
                type: 'boolean',
              },
              'skip-build': {
                usage: 'Skip Rspack compilation',
                type: 'boolean',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      initialize: () => {
        // serverless.processedInput does not exist in serverless@<2.0.0. This ensure the retrocompatibility with serverless v1
        if (
          this.serverless.processedInput &&
          this.serverless.processedInput.options
        ) {
          this.options = this.serverless.processedInput.options;
        }
      },
      'before:package:createDeploymentArtifacts': () =>
        BbPromise.bind(this)
          .then(() => this.serverless.pluginManager.spawn('rspack:validate'))
          .then(() =>
            this.skipCompile
              ? BbPromise.resolve()
              : this.serverless.pluginManager.spawn('rspack:compile'),
          )
          .then(() => this.serverless.pluginManager.spawn('rspack:package'))
          .then(() => progress.get('rspack').remove()),

      'after:package:createDeploymentArtifacts': () =>
        BbPromise.bind(this).then(this.cleanup),

      'before:deploy:function:packageFunction': () => {
        const runtime =
          this.serverless.service.getFunction(this.options.function).runtime ||
          this.serverless.service.provider.runtime ||
          'nodejs';

        if (isNodeRuntime(runtime)) {
          return BbPromise.bind(this)
            .then(() => this.serverless.pluginManager.spawn('rspack:validate'))
            .then(() => this.serverless.pluginManager.spawn('rspack:compile'))
            .then(() => this.serverless.pluginManager.spawn('rspack:package'));
        }
      },

      'before:invoke:local:invoke': () =>
        BbPromise.bind(this)
          .then(() => {
            lib.rspack.isLocal = true;

            return this.serverless.pluginManager.spawn('rspack:validate');
          })
          .then(() =>
            this.skipCompile
              ? BbPromise.resolve()
              : this.serverless.pluginManager.spawn('rspack:compile'),
          )
          .then(this.prepareLocalInvoke),

      'after:invoke:local:invoke': () =>
        BbPromise.bind(this).then(() => {
          if (this.options.watch && !this.isWatching) {
            return this.watch('invoke:local');
          }
          return BbPromise.resolve();
        }),

      'before:run:run': () =>
        BbPromise.bind(this)
          .then(() =>
            _.set(this.serverless, 'service.package.individually', false),
          )
          .then(() => this.serverless.pluginManager.spawn('rspack:validate'))
          .then(() => this.serverless.pluginManager.spawn('rspack:compile'))
          .then(this.packExternalModules)
          .then(this.prepareRun),

      'after:run:run': () =>
        BbPromise.bind(this).then(() => {
          if (this.options.watch && !this.isWatching) {
            return this.watch(this.watchRun.bind(this));
          }
          return BbPromise.resolve();
        }),

      'rspack:rspack': () =>
        BbPromise.bind(this)
          .then(() => this.serverless.pluginManager.spawn('rspack:validate'))
          .then(() => this.serverless.pluginManager.spawn('rspack:compile'))
          .then(() => this.serverless.pluginManager.spawn('rspack:package')),

      /*
       * Internal rspack events (can be hooked by plugins)
       */
      'rspack:validate:validate': () =>
        BbPromise.bind(this).then(this.validate),

      'rspack:compile:compile': () => BbPromise.bind(this).then(this.compile),

      'rspack:compile:watch:compile': () => BbPromise.resolve(),

      'rspack:package:packExternalModules': () =>
        BbPromise.bind(this).then(this.packExternalModules),

      'rspack:package:packageModules': () =>
        BbPromise.bind(this).then(this.packageModules),

      'rspack:package:copyExistingArtifacts': () =>
        BbPromise.bind(this).then(this.copyExistingArtifacts),

      'before:offline:start': () =>
        BbPromise.bind(this)
          .tap(() => {
            lib.rspack.isLocal = true;
            // --skip-build override
            if (this.options['skip-build'] === false) {
              this.skipCompile = true;
            }
          })
          .then(this.prepareOfflineInvoke)
          .then(() =>
            this.skipCompile ? BbPromise.resolve() : this.wpwatch(),
          ),

      'before:offline:start:init': () =>
        BbPromise.bind(this)
          .tap(() => {
            lib.rspack.isLocal = true;
            // --skip-build override
            if (this.options['skip-build'] === false) {
              this.skipCompile = true;
            }
          })
          .then(this.prepareOfflineInvoke)
          .then(() =>
            this.skipCompile ? BbPromise.resolve() : this.wpwatch(),
          ),

      'before:step-functions-offline:start': () =>
        BbPromise.bind(this)
          .tap(() => {
            lib.rspack.isLocal = true;
          })
          .then(this.prepareStepOfflineInvoke)
          .then(() => this.serverless.pluginManager.spawn('rspack:compile')),
    };
  }
}

module.exports = ServerlessRspack;
