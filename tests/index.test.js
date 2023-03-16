'use strict';
/**
 * Unit tests for index.
 */

const _ = require('lodash');
const BbPromise = require('bluebird');
const semver = require('semver');
const Serverless = require('serverless');
const ServerlessRspack = require('../src');

jest.mock('@rspack/core');

describe('ServerlessRspack', () => {
  let serverless;

  beforeEach(() => {
    jest.resetModules();
    serverless = new Serverless({
      commands: ['print'],
      options: {},
      serviceDir: null,
    });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn(),
    };
    serverless.pluginManager.spawn = jest
      .fn()
      .mockReturnValue(BbPromise.resolve());
    serverless.service.getFunction = jest
      .fn()
      .mockReturnValue({ runtime: 'nodejs12.x' });
    if (semver.gte(serverless.getVersion(), '2.10.0')) {
      serverless.configSchemaHandler.defineFunctionProperties = jest.fn();
    }
  });

  it('should expose a lib object', () => {
    const lib = ServerlessRspack.lib;
    expect(lib).toEqual({ entries: {}, rspack: { isLocal: false } });
  });

  it('should extend serverless', () => {
    new ServerlessRspack(serverless, {});
    if (semver.gte(serverless.getVersion(), '2.10.0')) {
      expect(
        serverless.configSchemaHandler.defineFunctionProperties,
      ).toHaveBeenCalledWith('aws', {
        properties: {
          entrypoint: { type: 'string' },
        },
      });
    } else {
      expect(
        serverless.configSchemaHandler.defineFunctionProperties,
      ).toBeUndefined();
    }
  });

  describe('with a JS rspack configuration', () => {
    it('should not load ts-node', () => {
      _.set(serverless, 'service.custom.rspack', 'rspack.config.js');
      new ServerlessRspack(serverless, {});
    });
  });

  _.forEach(
    [
      'commands.rspack',
      'commands.rspack.commands.validate',
      'commands.rspack.commands.compile',
      'commands.rspack.commands.compile.commands.watch',
      'commands.rspack.commands.package',
    ],
    (command) => {
      it(`should expose command/entrypoint ${_.last(
        _.split(command, '.'),
      )}`, () => {
        const slsw = new ServerlessRspack(serverless, {});
        expect(slsw).toHaveProperty(command);
      });
    },
  );

  describe('hooks', () => {
    const functionName = 'myFunction';
    const rawOptions = {
      f: functionName,
    };
    const processedOptions = {
      function: functionName,
    };
    let slsw;

    beforeAll(() => {
      slsw = new ServerlessRspack(serverless, rawOptions);
      if (serverless.processedInput) {
        // serverless.processedInput does not exist in serverless@<2.0.0
        serverless.processedInput.options = processedOptions;
      }
      slsw.cleanup = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.watch = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.wpwatch = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.packExternalModules = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.copyExistingArtifacts = jest
        .fn()
        .mockReturnValue(BbPromise.resolve());
      slsw.prepareRun = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.watchRun = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.validate = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.compile = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.packageModules = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.prepareLocalInvoke = jest.fn().mockReturnValue(BbPromise.resolve());
      slsw.prepareOfflineInvoke = jest
        .fn()
        .mockReturnValue(BbPromise.resolve());
      slsw.prepareStepOfflineInvoke = jest
        .fn()
        .mockReturnValue(BbPromise.resolve());
    });

    beforeEach(() => {
      ServerlessRspack.lib.rspack.isLocal = false;
      slsw.skipCompile = false;
    });

    _.forEach(
      [
        {
          name: 'before:package:createDeploymentArtifacts',
          test: () => {
            it('should spawn validate, compile and package', () => {
              return expect(
                slsw.hooks['before:package:createDeploymentArtifacts'](),
              )
                .resolves.toBeUndefined()
                .then(() => {
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(3);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(1, 'rspack:validate');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(2, 'rspack:compile');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(3, 'rspack:package');
                  return null;
                });
            });

            it('should skip compile if requested', () => {
              slsw.skipCompile = true;
              return expect(
                slsw.hooks['before:package:createDeploymentArtifacts'](),
              )
                .resolves.toBeUndefined()
                .then(() => {
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(2);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(1, 'rspack:validate');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(2, 'rspack:package');
                  return null;
                });
            });
          },
        },
        {
          name: 'after:package:createDeploymentArtifacts',
          test: () => {
            it('should call cleanup', () => {
              return expect(
                slsw.hooks['after:package:createDeploymentArtifacts'](),
              )
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.cleanup).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'before:deploy:function:packageFunction',
          test: () => {
            it('should spawn validate, compile and package', () => {
              slsw.options.function = functionName;

              return expect(
                slsw.hooks['before:deploy:function:packageFunction'](),
              )
                .resolves.toBeUndefined()
                .then(() => {
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(3);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(1, 'rspack:validate');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(2, 'rspack:compile');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(3, 'rspack:package');
                  return null;
                });
            });
          },
        },
        {
          name: 'rspack:rspack',
          test: () => {
            it('should spawn validate, compile and package', () => {
              return expect(slsw.hooks['rspack:rspack']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(3);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(1, 'rspack:validate');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(2, 'rspack:compile');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(3, 'rspack:package');
                  return null;
                });
            });
          },
        },
        {
          name: 'before:invoke:local:invoke',
          test: () => {
            it('should prepare for local invoke', () => {
              return expect(slsw.hooks['before:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessRspack.lib.rspack.isLocal).toBe(true);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(2);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(1, 'rspack:validate');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(2, 'rspack:compile');
                  expect(slsw.prepareLocalInvoke).toHaveBeenCalledTimes(1);
                  return null;
                });
            });

            it('should skip compile if requested', () => {
              slsw.options['skip-build'] = false;
              slsw.skipCompile = true;
              return expect(slsw.hooks['before:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(1);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledWith('rspack:validate');
                  expect(slsw.prepareLocalInvoke).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'after:invoke:local:invoke',
          test: () => {
            it('should return if watch is disabled', () => {
              slsw.options.watch = false;
              return expect(slsw.hooks['after:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });

            it('should watch if enabled', () => {
              slsw.options.watch = true;
              return expect(slsw.hooks['after:invoke:local:invoke']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(1);
                  expect(slsw.watch).toHaveBeenCalledWith('invoke:local');
                  return null;
                });
            });
          },
        },
        {
          name: 'before:run:run',
          test: () => {
            it('should prepare for run', () => {
              return expect(slsw.hooks['before:run:run']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.serverless.service.package.individually).toBe(
                    false,
                  );
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(2);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(1, 'rspack:validate');
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenNthCalledWith(2, 'rspack:compile');
                  expect(slsw.packExternalModules).toHaveBeenCalledTimes(1);
                  expect(slsw.prepareRun).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'after:run:run',
          test: () => {
            it('should return if watch is disabled', () => {
              slsw.options.watch = false;
              return expect(slsw.hooks['after:run:run']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });

            it('should watch if enabled', () => {
              slsw.options.watch = true;
              return expect(slsw.hooks['after:run:run']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.watch).toHaveBeenCalledTimes(1);
                  expect(slsw.watch).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'rspack:validate:validate',
          test: () => {
            it('should call validate', () => {
              return expect(slsw.hooks['rspack:validate:validate']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.validate).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'rspack:compile:compile',
          test: () => {
            it('should call compile', () => {
              return expect(slsw.hooks['rspack:compile:compile']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.compile).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'rspack:compile:watch:compile',
          test: () => {
            it('should resolve', () => {
              return expect(
                slsw.hooks['rspack:compile:watch:compile'](),
              ).resolves.toBeUndefined();
            });
          },
        },
        {
          name: 'rspack:package:packExternalModules',
          test: () => {
            it('should call packExternalModules', () => {
              return expect(slsw.hooks['rspack:package:packExternalModules']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.packExternalModules).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'rspack:package:packageModules',
          test: () => {
            it('should call packageModules', () => {
              return expect(slsw.hooks['rspack:package:packageModules']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.packageModules).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'rspack:package:copyExistingArtifacts',
          test: () => {
            it('should call copyExistingArtifacts', () => {
              return expect(
                slsw.hooks['rspack:package:copyExistingArtifacts'](),
              )
                .resolves.toBeUndefined()
                .then(() => {
                  expect(slsw.copyExistingArtifacts).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
          },
        },
        {
          name: 'before:offline:start',
          test: () => {
            it('should prepare offline', () => {
              slsw.options['skip-build'] = true;
              return expect(slsw.hooks['before:offline:start']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessRspack.lib.rspack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
            it('should skip compiling when requested', () => {
              slsw.options['skip-build'] = false;
              return expect(slsw.hooks['before:offline:start']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessRspack.lib.rspack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });
          },
        },
        {
          name: 'before:offline:start:init',
          test: () => {
            it('should prepare offline', () => {
              slsw.options['skip-build'] = true;
              return expect(slsw.hooks['before:offline:start:init']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessRspack.lib.rspack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(1);
                  return null;
                });
            });
            it('should skip compiling when requested', () => {
              slsw.options['skip-build'] = false;
              return expect(slsw.hooks['before:offline:start:init']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessRspack.lib.rspack.isLocal).toBe(true);
                  expect(slsw.prepareOfflineInvoke).toHaveBeenCalledTimes(1);
                  expect(slsw.wpwatch).toHaveBeenCalledTimes(0);
                  return null;
                });
            });
          },
        },
        {
          name: 'before:step-functions-offline:start',
          test: () => {
            it('should prepare offline', () => {
              return expect(slsw.hooks['before:step-functions-offline:start']())
                .resolves.toBeUndefined()
                .then(() => {
                  expect(ServerlessRspack.lib.rspack.isLocal).toBe(true);
                  expect(slsw.prepareStepOfflineInvoke).toHaveBeenCalledTimes(
                    1,
                  );
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledTimes(1);
                  expect(
                    slsw.serverless.pluginManager.spawn,
                  ).toHaveBeenCalledWith('rspack:compile');
                  return null;
                });
            });
          },
        },
        {
          name: 'initialize',
          test: () => {
            it('should override the raw options with the processed ones', () => {
              slsw.hooks.initialize();
              if (serverless.processedInput) {
                expect(slsw.options).toEqual(processedOptions);
              } else {
                // serverless.processedInput does not exist in serverless@<2.0.0
                // The options should not be changed
                expect(slsw.options).toEqual(rawOptions);
              }
            });
          },
        },
      ],
      (hook) => {
        it(`should expose hook ${hook.name}`, () => {
          expect(slsw).toHaveProperty(`hooks.${hook.name}`);
        });

        describe(hook.name, () => {
          hook.test();
        });
      },
    );
  });
});
