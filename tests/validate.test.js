'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const path = require('path');
const Serverless = require('serverless');

jest.mock('fs-extra');
jest.mock('glob');
jest.mock('@serverless/utils/log');

describe('validate', () => {
  let module;
  let serverless;
  let baseModule;
  let fsExtraMock;
  let globMock;
  let logMock;

  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    fsExtraMock = require('fs-extra');
    globMock = require('glob');
    logMock = require('@serverless/utils/log').log;
    jest.doMock(path.join('..', 'src', 'lib'), () => ({
      entries: {},
      rspack: {
        isLocal: false,
      },
    }));
    serverless = new Serverless({
      commands: ['print'],
      options: {},
      serviceDir: null,
    });
    serverless.cli = {
      log: jest.fn(),
    };

    baseModule = require('../src/validate');
    module = _.assign(
      {
        serverless,
        options: {},
      },
      baseModule,
    );
  });

  it('should expose a `validate` method', () => {
    expect(module.validate).toEqual(expect.any(Function));
  });

  it('should set `rspackConfig` in the context to `custom.rspack` option', () => {
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: 'test',
      },
    };
    _.set(module.serverless.service, 'custom.rspack.config', testConfig);
    return module
      .validate()
      .then(() => expect(module.rspackConfig).toEqual(testConfig));
  });

  it('should delete the output path', () => {
    const testOutPath = 'test';
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: testOutPath,
      },
    };
    _.set(module.serverless.service, 'custom.rspack.config', testConfig);
    return module
      .validate()
      .then(() =>
        expect(fsExtraMock.removeSync).toHaveBeenCalledWith(testOutPath),
      );
  });

  it('should keep the output path if requested', () => {
    const testOutPath = 'test';
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: testOutPath,
      },
    };
    _.set(module, 'keepOutputDirectory', true);
    _.set(module.serverless.service, 'custom.rspack.config', testConfig);
    return module
      .validate()
      .then(() => expect(fsExtraMock.removeSync).toHaveBeenCalledTimes(0));
  });

  it('should override the output path if `out` option is specified', () => {
    const testConfig = {
      entry: 'test',
      context: 'testcontext',
      output: {
        path: 'originalpath',
        filename: 'filename',
      },
    };
    const testServicePath = 'testpath';
    const testOptionsOut = 'testdir';
    module.options.out = testOptionsOut;
    module.serverless.config.servicePath = testServicePath;
    _.set(module.serverless.service, 'custom.rspack.config', testConfig);
    return module.validate().then(() =>
      expect(module.rspackConfig.output).toEqual({
        path: path.join(testServicePath, testOptionsOut, 'service'),
        filename: 'filename',
      }),
    );
  });

  it('should set a default `rspackConfig.context` if not present', () => {
    const testConfig = {
      entry: 'test',
      output: {},
    };
    const testServicePath = 'testpath';
    module.serverless.config.servicePath = testServicePath;
    _.set(module.serverless.service, 'custom.rspack.config', testConfig);
    return module
      .validate()
      .then(() => expect(module.rspackConfig.context).toEqual(testServicePath));
  });

  it('should fail when `includeModules` and `packagerOptions.noInstall` are set', () => {
    const testConfig = {
      includeModules: true,
      packagerOptions: { noInstall: true },
    };
    _.set(module.serverless.service, 'custom.rspack.config', testConfig);
    expect(() => module.validate()).toThrow();
  });

  describe('default target', () => {
    it('should set a default `rspackConfig.target` if not present', () => {
      const testConfig = {
        entry: 'test',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      return module
        .validate()
        .then(() => expect(module.rspackConfig.target).toEqual('node'));
    });

    it('should not change `rspackConfig.target` if one is present', () => {
      const testConfig = {
        entry: 'test',
        target: 'myTarget',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      return module
        .validate()
        .then(() => expect(module.rspackConfig.target).toEqual('myTarget'));
    });
  });

  describe('default output', () => {
    it('should set a default `rspackConfig.output` if not present', () => {
      const testEntry = 'testentry';
      const testConfig = {
        entry: testEntry,
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      return module.validate().then(() =>
        expect(module.rspackConfig.output).toEqual({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.rspack', 'service'),
          filename: '[name].js',
        }),
      );
    });

    it('should set a default `rspackConfig.output.filename` if `entry` is an array', () => {
      const testEntry = ['first', 'second', 'last'];
      const testConfig = {
        entry: testEntry,
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      return module.validate().then(() =>
        expect(module.rspackConfig.output).toEqual({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.rspack', 'service'),
          filename: '[name].js',
        }),
      );
    });

    it('should set a default `rspackConfig.output.filename` if `entry` is not defined', () => {
      const testConfig = {};
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      return module.validate().then(() =>
        expect(module.rspackConfig.output).toEqual({
          libraryTarget: 'commonjs',
          path: path.join(testServicePath, '.rspack', 'service'),
          filename: '[name].js',
        }),
      );
    });
  });

  describe('config file load', () => {
    afterEach(() => {
      jest.unmock(path.join('testServicePath', 'testconfig'));
    });

    it('should load a rspack config from file if `custom.rspack` is a string', () => {
      const loadedConfig = {
        entry: 'testentry',
      };
      jest.doMock(
        path.join('testServicePath', 'testconfig'),
        () => loadedConfig,
        { virtual: true },
      );
      module.serverless.config.servicePath = 'testServicePath';
      module.serverless.service.custom.rspack = 'testconfig';
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(true);
      return expect(module.validate())
        .resolves.toBeUndefined()
        .then(() => {
          expect(serverless.utils.fileExistsSync).toHaveBeenCalledWith(
            path.join('testServicePath', 'testconfig'),
          );
          expect(module.rspackConfig).toBe(loadedConfig);
          return null;
        });
    });

    it('should load a async rspack config from file if `custom.rspack` is a string', () => {
      const loadedConfig = {
        entry: 'testentry',
      };
      jest.doMock(
        path.join('testServicePath', 'testconfig'),
        () => BbPromise.resolve(loadedConfig),
        { virtual: true },
      );
      module.serverless.config.servicePath = 'testServicePath';
      module.serverless.service.custom.rspack = 'testconfig';
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(true);
      return expect(module.validate())
        .resolves.toBeUndefined()
        .then(() => {
          expect(serverless.utils.fileExistsSync).toHaveBeenCalledWith(
            path.join('testServicePath', 'testconfig'),
          );
          expect(module.rspackConfig).toEqual(loadedConfig);
          return null;
        });
    });

    it('should interop default when rspack config is exported as an ES6 module', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      const requiredPath = path.join(testServicePath, testConfig);
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.rspack = testConfig;
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(true);
      const loadedConfig = {
        default: {
          entry: 'testentry',
        },
      };
      jest.doMock(requiredPath, () => loadedConfig, { virtual: true });
      return expect(module.validate())
        .resolves.toBeUndefined()
        .then(() => {
          expect(serverless.utils.fileExistsSync).toHaveBeenCalledWith(
            requiredPath,
          );
          expect(module.rspackConfig).toEqual(loadedConfig.default);
          return null;
        });
    });

    it('should catch errors while loading a async rspack config from file if `custom.rspack` is a string', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      const requiredPath = path.join(testServicePath, testConfig);
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.rspack = testConfig;
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(true);
      const loadedConfigPromise = BbPromise.reject('config failed to load');
      jest.doMock(requiredPath, () => loadedConfigPromise, { virtual: true });
      return expect(module.validate())
        .rejects.toEqual('config failed to load')
        .then(() => {
          expect(serverless.utils.fileExistsSync).toHaveBeenCalledWith(
            requiredPath,
          );
          return null;
        });
    });

    it('should load a wrong thenable rspack config as normal object from file if `custom.rspack` is a string', () => {
      module.serverless.config.servicePath = 'testconfig';
      module.serverless.service.custom.rspack = 'testpath';
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(true);
      const loadedConfig = {
        then: 'I am not a Promise member',
        entry: 'testentry',
      };
      jest.doMock(path.join('testconfig', 'testpath'), () => loadedConfig, {
        virtual: true,
      });
      return expect(module.validate())
        .resolves.toBeUndefined()
        .then(() => {
          expect(serverless.utils.fileExistsSync).toHaveBeenCalledWith(
            path.join('testconfig', 'testpath'),
          );
          expect(module.rspackConfig).toEqual(loadedConfig);
          return null;
        });
    });

    it('should throw if providing an invalid file', () => {
      const testConfig = 'testconfig';
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.rspack = testConfig;
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(false);
      return expect(module.validate()).rejects.toThrow(/could not find/);
    });

    it('should load a default file if no custom config is provided', () => {
      module.serverless.config.servicePath = 'testpath';
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(true);
      const loadedConfig = {
        entry: 'testentry',
      };
      jest.doMock(
        path.join('testpath', 'rspack.config.js'),
        () => loadedConfig,
        { virtual: true },
      );
      return expect(module.validate())
        .resolves.toBeUndefined()
        .then(() => {
          expect(serverless.utils.fileExistsSync).toHaveBeenCalledWith(
            path.join('testpath', 'rspack.config.js'),
          );
          expect(module.rspackConfig).toEqual(loadedConfig);
          return null;
        });
    });

    it('should fail when importing a broken configuration file', () => {
      const testConfig = 'invalid.rspack.config.js';
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      module.serverless.service.custom.rspack = testConfig;
      serverless.utils.fileExistsSync = jest.fn().mockReturnValue(true);
      return expect(module.validate())
        .rejects.toThrow(
          `Cannot find module '${path.join(
            'testpath',
            'invalid.rspack.config.js',
          )}' from 'src/validate.js'`,
        )
        .then(() =>
          expect(logMock.error).toHaveBeenCalledWith(
            expect.stringMatching(/^Could not load rspack config/),
          ),
        );
    });
  });

  describe('lib', () => {
    it('should expose the serverless instance', () => {
      const testOutPath = 'test';
      const testConfig = {
        entry: 'test',
        context: 'testcontext',
        output: {
          path: testOutPath,
        },
      };
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      return expect(module.validate())
        .resolves.toBeUndefined()
        .then(() => {
          expect(require('../src/lib').serverless).toBe(serverless);
          return null;
        });
    });

    it('should expose the plugin options', () => {
      const testOutPath = 'test';
      const testConfig = {
        entry: 'test',
        context: 'testcontext',
        output: {
          path: testOutPath,
        },
      };
      const testOptions = {
        stage: 'testStage',
        verbose: true,
      };
      const configuredModule = _.assign(
        {
          serverless,
          options: _.cloneDeep(testOptions),
        },
        baseModule,
      );
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      return expect(configuredModule.validate())
        .resolves.toBeUndefined()
        .then(() => {
          const lib = require('../src/lib');
          expect(lib.options).toEqual(testOptions);
          return null;
        });
    });

    describe('entries', () => {
      const testFunctionsConfig = {
        func1: {
          handler: 'module1.func1handler',
          artifact: 'artifact-func1.zip',
          events: [
            {
              http: {
                method: 'get',
                path: 'func1path',
              },
            },
          ],
          runtime: 'node10.x',
        },
        func2: {
          handler: 'module2.func2handler',
          artifact: 'artifact-func2.zip',
          events: [
            {
              http: {
                method: 'POST',
                path: 'func2path',
              },
            },
            {
              nonhttp: 'non-http',
            },
          ],
          runtime: 'node10.x',
        },
        func3: {
          handler: 'handlers/func3/module2.func3handler',
          artifact: 'artifact-func3.zip',
          events: [
            {
              nonhttp: 'non-http',
            },
          ],
          runtime: 'node10.x',
        },
        func4: {
          handler: 'handlers/module2/func3/module2.func3handler',
          artifact: 'artifact-func3.zip',
          events: [
            {
              nonhttp: 'non-http',
            },
          ],
          runtime: 'node10.x',
        },
        func5: {
          handler: 'com.serverless.Handler',
          artifact: 'target/hello-dev.jar',
          events: [
            {
              nonhttp: 'non-http',
            },
          ],
          runtime: 'java8',
        },
        rustfunc: {
          handler: 'my-rust-func',
          runtime: 'rust',
          events: [
            {
              http: {
                method: 'POST',
                path: 'rustfuncpath',
              },
            },
          ],
        },
        dockerfunc: {
          image: {
            name: 'some-docker-image',
            command: ['com.serverless.Handler'],
          },
          events: [
            {
              http: {
                method: 'POST',
                path: 'mydockerfuncpath',
              },
            },
          ],
        },
        dockerfuncuri: {
          image: {
            name: 'some-image-with-uri',
            uri: 'http://hub.dock.er/image',
            command: ['method.lambda'],
          },
          events: [
            {
              http: {
                method: 'POST',
                path: 'mydockerfuncpath',
              },
            },
          ],
        },
        layerFunc: {
          handler: 'layer.handler',
          entrypoint: 'module1.func1handler',
        },
      };

      const testFunctionsGoogleConfig = {
        func1: {
          handler: 'func1handler',
          events: [
            {
              http: {
                method: 'get',
                path: 'func1path',
              },
            },
          ],
          runtime: 'node10.x',
        },
      };

      it('should expose all node functions if `options.function` is not defined', () => {
        const testOutPath = 'test';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
          getFunction: (func) => {
            return testFunctionsConfig[func];
          },
        };

        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        globMock.sync.mockImplementation((filename) => [
          _.replace(filename, '*', 'js'),
        ]);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {
              'com.serverless': './com.serverless.js',
              module1: './module1.js',
              module2: './module2.js',
              'handlers/func3/module2': './handlers/func3/module2.js',
              'handlers/module2/func3/module2':
                './handlers/module2/func3/module2.js',
            };

            expect(lib.entries).toEqual(expectedLibEntries);
            expect(globMock.sync).toHaveBeenCalledTimes(6);
            expect(logMock).toHaveBeenCalledTimes(0);
            return null;
          });
      });

      it('should expose the requested function if `options.function` is defined and the function is found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globMock.sync.mockImplementation((filename) => [
          _.replace(filename, '*', 'js'),
        ]);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {
              module1: './module1.js',
            };

            expect(lib.entries).toEqual(expectedLibEntries);
            expect(globMock.sync).toHaveBeenCalledTimes(1);
            expect(logMock).toHaveBeenCalledTimes(0);
            return null;
          });
      });

      it('should ignore non-node runtimes', () => {
        const testOutPath = 'test';
        const testFunctionsConfig = {
          func1: {
            handler: 'module1.func1handler',
            artifact: 'artifact-func1.zip',
            events: [
              {
                http: {
                  method: 'get',
                  path: 'func1path',
                },
              },
            ],
            runtime: 'node10.x',
          },
          func2: {
            handler: 'module2.func2handler',
            artifact: 'artifact-func2.zip',
            events: [
              {
                http: {
                  method: 'POST',
                  path: 'func2path',
                },
              },
              {
                nonhttp: 'non-http',
              },
            ],
            runtime: 'provided',
            allowCustomRuntime: true,
          },
          func3: {
            handler: 'module3.func2handler',
            artifact: 'artifact-func3.zip',
            events: [
              {
                http: {
                  method: 'POST',
                  path: 'func3path',
                },
              },
              {
                nonhttp: 'non-http',
              },
            ],
            runtime: 'provided',
          },
          func4: {
            artifact: 'artifact-func4.zip',
            events: [
              {
                http: {
                  method: 'POST',
                  path: 'func4path',
                },
              },
              {
                nonhttp: 'non-http',
              },
            ],
            image: {
              name: 'custom-image',
              command: ['module4.func1handler'],
            },
          },
        };

        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
          getFunction: (func) => {
            return testFunctionsConfig[func];
          },
        };

        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        globMock.sync.mockImplementation((filename) => [
          _.replace(filename, '*', 'js'),
        ]);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {
              module1: './module1.js',
              module4: './module4.js',
            };

            expect(lib.entries).toEqual(expectedLibEntries);
            expect(globMock.sync).toHaveBeenCalledTimes(2);
            expect(logMock).toHaveBeenCalledTimes(0);
            return null;
          });
      });

      it('should skip image defined with URI', () => {
        const testOutPath = 'test';
        const testFunctionsConfig = {
          dockerfuncwithuri: {
            image: {
              name: 'some-image-with-uri',
              uri: 'http://hub.dock.er/image',
              command: ['method.lambda'],
            },
            events: [
              {
                http: {
                  method: 'POST',
                  path: 'mydockerfuncpath',
                },
              },
            ],
          },
        };

        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
          getFunction: (func) => {
            return testFunctionsConfig[func];
          },
        };

        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        globMock.sync.mockImplementation((filename) => [
          _.replace(filename, '*', 'js'),
        ]);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {};

            expect(lib.entries).toEqual(expectedLibEntries);
            expect(globMock.sync).toHaveBeenCalledTimes(0);
            expect(logMock).toHaveBeenCalledTimes(0);
            return null;
          });
      });

      it('should throw error if container image is not well defined', () => {
        const testOutPath = 'test';
        const testFunctionsConfig = {
          func1: {
            artifact: 'artifact-func1.zip',
            events: [
              {
                http: {
                  method: 'POST',
                  path: 'func1path',
                },
              },
              {
                nonhttp: 'non-http',
              },
            ],
            image: {
              name: 'custom-image',
              command: [],
            },
          },
        };

        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
          getFunction: (func) => {
            return testFunctionsConfig[func];
          },
        };

        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        globMock.sync.mockImplementation((filename) => [
          _.replace(filename, '*', 'js'),
        ]);
        expect(() => {
          module.validate();
        }).toThrow(/Either function.handler or function.image must be defined/);
      });

      it('should not throw error if container image is a simple string', () => {
        const testOutPath = 'test';
        const testFunctionsConfig = {
          func1: {
            artifact: 'artifact-func1.zip',
            events: [
              {
                http: {
                  method: 'POST',
                  path: 'func1path',
                },
              },
              {
                nonhttp: 'non-http',
              },
            ],
            image:
              'XXXX.dkr.ecr.ca-central-1.amazonaws.com/myproject/customNode:latest',
          },
        };

        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
          getFunction: (func) => {
            return testFunctionsConfig[func];
          },
        };

        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        globMock.sync.mockImplementation((filename) => [
          _.replace(filename, '*', 'js'),
        ]);

        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {};

            expect(lib.entries).toEqual(expectedLibEntries);
            expect(globMock.sync).toHaveBeenCalledTimes(0);
            expect(logMock).toHaveBeenCalledTimes(0);
            return null;
          });
      });

      describe('google provider', () => {
        beforeEach(() => {
          _.set(module.serverless, 'service.provider.name', 'google');
        });

        afterEach(() => {
          _.unset(module.serverless, 'service.provider.name');
        });

        it('should ignore entry points for the Google provider', () => {
          const testOutPath = 'test';
          const testFunction = 'func1';
          const testConfig = {
            entry: './index.js',
            target: 'node',
            output: {
              path: testOutPath,
              filename: 'index.js',
            },
          };
          _.set(module.serverless.service, 'custom.rspack.config', testConfig);
          module.serverless.service.functions = testFunctionsGoogleConfig;
          module.options.function = testFunction;
          globMock.sync.mockReturnValue([]);
          return expect(module.validate())
            .resolves.toBeUndefined()
            .then(() => {
              const lib = require('../src/lib');

              expect(lib.entries).toEqual({});
              expect(globMock.sync).toHaveBeenCalledTimes(0);
              expect(logMock).toHaveBeenCalledTimes(0);
              return null;
            });
        });
      });

      describe('package individually', () => {
        const testConfig = {
          output: {
            path: 'output',
          },
        };

        beforeEach(() => {
          _.set(module.serverless, 'service.package.individually', 'true');
        });

        afterEach(() => {
          _.unset(module.serverless, 'service.package.individually');
        });

        it('should fail if rspackConfig.entry is customised', () => {
          _.set(
            module.serverless.service,
            'custom.rspack.config',
            _.merge({}, testConfig, {
              entry: {
                module1: './module1.js',
                module2: './module2.js',
              },
            }),
          );
          module.serverless.service.functions = testFunctionsConfig;
          globMock.sync.mockImplementation((filename) => [
            _.replace(filename, '*', 'js'),
          ]);
          return expect(module.validate()).rejects.toThrow(
            /Rspack entry must be automatically resolved when package.individually is set to true/,
          );
        });

        it.skip('should not fail if rspackConfig.entry is set to lib.entries for backward compatibility', () => {
          const lib = require('../src/lib');
          _.set(
            module.serverless.service,
            'custom.rspack.config',
            _.merge({}, testConfig, {
              entry: lib.entries,
            }),
          );
          module.serverless.service.functions = testFunctionsConfig;
          globMock.sync.mockImplementation((filename) => [
            _.replace(filename, '*', 'js'),
          ]);
          return expect(module.validate()).resolves.toBeUndefined();
        });

        it('should expose all functions details in entryFunctions property', () => {
          _.set(module.serverless.service, 'custom.rspack.config', testConfig);
          module.serverless.service.functions = testFunctionsConfig;
          globMock.sync.mockImplementation((filename) => [
            _.replace(filename, '*', 'js'),
          ]);
          return expect(module.validate())
            .resolves.toBeUndefined()
            .then(() => {
              expect(module.entryFunctions).toEqual([
                {
                  handlerFile: 'module1',
                  funcName: 'func1',
                  func: testFunctionsConfig.func1,
                  entry: { key: 'module1', value: './module1.js' },
                },
                {
                  handlerFile: 'module1',
                  funcName: 'layerFunc',
                  func: {
                    handler: 'layer.handler',
                    entrypoint: 'module1.func1handler',
                  },
                  entry: { key: 'module1', value: './module1.js' },
                },
                {
                  handlerFile: 'module2',
                  funcName: 'func2',
                  func: testFunctionsConfig.func2,
                  entry: { key: 'module2', value: './module2.js' },
                },
                {
                  handlerFile: path.join('handlers', 'func3', 'module2'),
                  funcName: 'func3',
                  func: testFunctionsConfig.func3,
                  entry: {
                    key: 'handlers/func3/module2',
                    value: './handlers/func3/module2.js',
                  },
                },
                {
                  handlerFile: path.join(
                    'handlers',
                    'module2',
                    'func3',
                    'module2',
                  ),
                  funcName: 'func4',
                  func: testFunctionsConfig.func4,
                  entry: {
                    key: 'handlers/module2/func3/module2',
                    value: './handlers/module2/func3/module2.js',
                  },
                },
                {
                  handlerFile: 'com.serverless',
                  funcName: 'dockerfunc',
                  func: testFunctionsConfig.dockerfunc,
                  entry: {
                    key: 'com.serverless',
                    value: './com.serverless.js',
                  },
                },
              ]);
              return null;
            });
        });

        it('should set rspackConfig output path for every functions', () => {
          _.set(module.serverless.service, 'custom.rspack.config', testConfig);
          module.serverless.service.functions = testFunctionsConfig;
          globMock.sync.mockImplementation((filename) => [
            _.replace(filename, '*', 'js'),
          ]);
          return expect(module.validate())
            .resolves.toBeUndefined()
            .then(() => {
              expect(module.rspackConfig).toHaveLength(6);
              expect(module.rspackConfig[0].output.path).toEqual(
                path.join('output', 'func1'),
              );
              expect(module.rspackConfig[1].output.path).toEqual(
                path.join('output', 'layerFunc'),
              );
              expect(module.rspackConfig[2].output.path).toEqual(
                path.join('output', 'func2'),
              );
              expect(module.rspackConfig[3].output.path).toEqual(
                path.join('output', 'func3'),
              );
              expect(module.rspackConfig[4].output.path).toEqual(
                path.join('output', 'func4'),
              );
              expect(module.rspackConfig[5].output.path).toEqual(
                path.join('output', 'dockerfunc'),
              );

              return null;
            });
        });

        it('should clone other rspackConfig options without modification', () => {
          _.set(
            module.serverless.service,
            'custom.rspack.config',
            _.merge({}, testConfig, {
              devtool: 'source-map',
              context: 'some context',
              output: {
                libraryTarget: 'commonjs',
              },
            }),
          );
          module.serverless.service.functions = testFunctionsConfig;
          globMock.sync.mockImplementation((filename) => [
            _.replace(filename, '*', 'js'),
          ]);
          return expect(module.validate())
            .resolves.toBeUndefined()
            .then(() => {
              expect(module.rspackConfig).toHaveLength(6);
              expect(module.rspackConfig[0].devtool).toEqual('source-map');
              expect(module.rspackConfig[1].devtool).toEqual('source-map');
              expect(module.rspackConfig[2].devtool).toEqual('source-map');
              expect(module.rspackConfig[3].devtool).toEqual('source-map');
              expect(module.rspackConfig[4].devtool).toEqual('source-map');
              expect(module.rspackConfig[5].devtool).toEqual('source-map');

              expect(module.rspackConfig[0].context).toEqual('some context');
              expect(module.rspackConfig[1].context).toEqual('some context');
              expect(module.rspackConfig[2].context).toEqual('some context');
              expect(module.rspackConfig[3].context).toEqual('some context');
              expect(module.rspackConfig[4].context).toEqual('some context');
              expect(module.rspackConfig[5].context).toEqual('some context');

              expect(module.rspackConfig[0].output.libraryTarget).toEqual(
                'commonjs',
              );
              expect(module.rspackConfig[1].output.libraryTarget).toEqual(
                'commonjs',
              );
              expect(module.rspackConfig[2].output.libraryTarget).toEqual(
                'commonjs',
              );
              expect(module.rspackConfig[3].output.libraryTarget).toEqual(
                'commonjs',
              );
              expect(module.rspackConfig[4].output.libraryTarget).toEqual(
                'commonjs',
              );
              expect(module.rspackConfig[5].output.libraryTarget).toEqual(
                'commonjs',
              );

              return null;
            });
        });
      });

      it('should show a warning if more than one matching handler is found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globMock.sync.mockReturnValue(['module1.ts', 'module1.js']);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {
              module1: './module1.ts',
            };

            expect(lib.entries).toEqual(expectedLibEntries);
            expect(globMock.sync).toHaveBeenCalledTimes(1);
            expect(logMock.warning).toHaveBeenCalledTimes(1);
            expect(logMock.warning).toHaveBeenCalledWith(
              'More than one matching handlers found for "module1". Using "module1.ts"',
            );
            return null;
          });
      });

      it('should select the most probable handler if multiple hits are found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globMock.sync.mockReturnValue([
          'module1.doc',
          'module1.json',
          'module1.test.js',
          'module1.ts',
          'module1.js',
        ]);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {
              module1: './module1.ts',
            };

            expect(lib.entries).toEqual(expectedLibEntries);
            expect(globMock.sync).toHaveBeenCalledTimes(1);
            expect(logMock.warning).toHaveBeenCalledTimes(1);
            expect(logMock.warning).toHaveBeenCalledWith(
              'More than one matching handlers found for "module1". Using "module1.ts"',
            );
            return null;
          });
      });

      it('should call glob with ignore parameter if there is an excludeFiles config', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        _.set(
          module.serverless.service,
          'custom.rspack.excludeFiles',
          '**/*.ts',
        );
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globMock.sync.mockReturnValue(['module1.js']);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            const expectedLibEntries = {
              module1: './module1.js',
            };

            expect(lib.entries).toEqual(expectedLibEntries);

            // handle different stub in case of serverless version
            if (serverless.version.match(/^1/)) {
              expect(globMock.sync).toHaveBeenCalledTimes(1);
              expect(globMock.sync).toHaveBeenCalledWith('module1.*', {
                ignore: '**/*.ts',
                cwd: null,
                nodir: true,
              });
            } else if (serverless.version.match(/^3/)) {
              expect(globMock.sync).toHaveBeenCalledTimes(1);
              expect(globMock.sync).toHaveBeenCalledWith('module1.*', {
                cwd: null,
                nodir: true,
                ignore: '**/*.ts',
              });
            } else {
              expect(globMock.sync).toHaveBeenCalledTimes(1);
              expect(globMock.sync).toHaveBeenCalledWith('module1.*', {
                ignore: '**/*.ts',
                cwd: undefined,
                nodir: true,
              });
            }

            expect(logMock).toHaveBeenCalledTimes(0);
            return null;
          });
      });

      it('should throw an exception if no handler is found', () => {
        const testOutPath = 'test';
        const testFunction = 'func1';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        globMock.sync.mockReturnValue([]);
        expect(() => {
          module.validate();
        }).toThrow(/No matching handler found for/);
      });

      it('should throw an exception if `options.function` is defined but not found in entries from serverless.yml', () => {
        const testOutPath = 'test';
        const testFunction = 'test';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        module.serverless.service.functions = testFunctionsConfig;
        module.options.function = testFunction;
        expect(() => {
          module.validate();
        }).toThrow(new RegExp(`^Function "${testFunction}" doesn't exist`));
      });
    });

    describe('rspack', () => {
      it('should default isLocal to false', () => {
        const testOutPath = 'test';
        const testConfig = {
          entry: 'test',
          context: 'testcontext',
          output: {
            path: testOutPath,
          },
        };
        _.set(module.serverless.service, 'custom.rspack.config', testConfig);
        return expect(module.validate())
          .resolves.toBeUndefined()
          .then(() => {
            const lib = require('../src/lib');
            expect(lib.rspack.isLocal).toBe(false);
            return null;
          });
      });
    });
  });

  describe('with skipped builds', () => {
    it('should set `skipCompile` to true if `options.skip-build` is true', () => {
      const testConfig = {
        entry: 'test',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);

      module.options['skip-build'] = true;

      fsExtraMock.pathExistsSync.mockReturnValue(true);
      return module.validate().then(() => {
        expect(module.skipCompile).toBe(true);
        return null;
      });
    });

    it('should keep output directory', () => {
      const testConfig = {
        entry: 'test',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      module.options['skip-build'] = true;
      fsExtraMock.pathExistsSync.mockReturnValue(true);
      return module.validate().then(() => {
        expect(module.keepOutputDirectory).toBe(true);
        return null;
      });
    });

    it('should fail without exiting output', () => {
      const testConfig = {
        entry: 'test',
        output: {},
      };
      const testServicePath = 'testpath';
      module.serverless.config.servicePath = testServicePath;
      _.set(module.serverless.service, 'custom.rspack.config', testConfig);
      module.options['skip-build'] = true;
      fsExtraMock.pathExistsSync.mockReturnValue(false);
      return expect(module.validate()).rejects.toThrow(
        /No compiled output found/,
      );
    });
  });
});
