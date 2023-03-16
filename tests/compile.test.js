'use strict';

const _ = require('lodash');
const Serverless = require('serverless');
const rspackMock = require('@rspack/core');
const baseModule = require('../src/compile');

jest.mock('@rspack/core');

const baseConfig = {
  output: { path: '.rspack/testFn' },
};

describe('compile', () => {
  let serverless;
  let module;

  beforeEach(() => {
    serverless = new Serverless({
      commands: ['print'],
      options: {},
      serviceDir: null,
    });
    serverless.cli = {
      log: jest.fn(),
      consoleLog: jest.fn(),
    };

    module = _.assign(
      {
        serverless,
        options: {},
        rspackConfig: [baseConfig],
      },
      baseModule,
    );
  });

  it('should expose a `compile` method', () => {
    expect(module.compile).toEqual(expect.any(Function));
  });

  it('should compile with rspack from a context configuration', () => {
    module.configuration = { concurrency: 1 };
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(rspackMock.rspack).toHaveBeenCalledWith(baseConfig);
        expect(rspackMock.compilerMock.run).toHaveBeenCalledTimes(1);
        return null;
      });
  });

  it('should fail if configuration is missing', async () => {
    expect.assertions(1);
    delete module.rspackConfig;
    await expect(() => module.compile()).rejects.toThrow(
      'Unable to find Rspack configuration',
    );
  });

  it('should fail if plugin configuration is missing', () => {
    module.configuration = undefined;
    expect.assertions(1);
    return module
      .compile()
      .catch((e) =>
        expect(e.toString()).toEqual(
          'ServerlessError: Missing plugin configuration',
        ),
      );
  });

  it('should fail if there are compilation errors', async () => {
    module.configuration = { concurrency: 1 };
    rspackMock.statsMock.compilation.errors = ['error'];
    expect.assertions(1);
    await expect(() => module.compile()).rejects.toThrow(
      /Rspack compilation failed/,
    );
  });

  it('should work with multi compile', () => {
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'statsMock-outputPath',
            },
          },
          toJson: () => ({ modules: [] }),
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false),
        },
      ],
    };
    module.configuration = { concurrency: 1 };
    rspackMock.compilerMock.run.mockClear();
    rspackMock.compilerMock.run.mockImplementation((cb) =>
      cb(null, multiStats),
    );
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(rspackMock.rspack).toHaveBeenCalledWith(baseConfig);
        expect(rspackMock.compilerMock.run).toHaveBeenCalledTimes(1);
        return null;
      });
  });

  it('should work with individual compile', () => {
    const testRspackConfig = {
      // Below entry is inserted during validate() which happens before compile()
      // Thus the assumed value
      entry: {
        'function-name/handler': './function-name/handler.js',
      },
      output: { path: '.rspack/testFn' },
    };
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'statsMock-outputPath',
            },
          },
          toJson: () => ({ modules: [] }),
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false),
        },
      ],
    };
    module.rspackConfig = testRspackConfig;
    module.configuration = { concurrency: 1 };
    module.serverless.service.package = {
      individually: true,
    };
    module.entryFunctions = [
      {
        handlerFile: 'function-name/handler',
        funcName: 'function-name',
        func: {
          handler: 'function-name/handler.handler',
          name: 'service-stage-function-name',
        },
        entry: {
          key: 'function-name/handler',
          value: './function-name/handler.js',
        },
      },
    ];
    rspackMock.compilerMock.run.mockClear();
    rspackMock.compilerMock.run.mockImplementation((cb) =>
      cb(null, multiStats),
    );
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(rspackMock.rspack).toHaveBeenCalledWith({
          entry: {
            'function-name/handler': './function-name/handler.js',
          },
          output: { path: '.rspack/testFn' },
        });
        expect(rspackMock.compilerMock.run).toHaveBeenCalledTimes(1);
        return null;
      });
  });

  it('should work with concurrent compile', () => {
    const testRspackConfig = [
      { output: { path: '.rspack/testFn1' } },
      { output: { path: '.rspack/testFn2' } },
    ];
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'statsMock-outputPath',
            },
          },
          toJson: () => ({ modules: [] }),
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false),
        },
      ],
    };
    module.rspackConfig = testRspackConfig;
    module.configuration = { concurrency: 2 };
    rspackMock.compilerMock.run.mockClear();
    rspackMock.compilerMock.run.mockImplementation((cb) =>
      cb(null, multiStats),
    );
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(rspackMock.rspack).toHaveBeenCalledWith(testRspackConfig[0]);
        expect(rspackMock.rspack).toHaveBeenCalledWith(testRspackConfig[1]);
        expect(rspackMock.compilerMock.run).toHaveBeenCalledTimes(2);
        return null;
      });
  });

  it('should concurrently work with individual compile', () => {
    const testRspackConfig = [
      {
        // Below entry is inserted during validate() which happens before compile()
        // Thus the assumed value
        entry: {
          'function-name-1/handler': './function-name-1/handler.js',
        },
        output: { path: '.rspack/testFn' },
      },
      {
        // Below entry is inserted during validate() which happens before compile()
        // Thus the assumed value
        entry: {
          'function-name-2/handler': './function-name-2/handler.js',
        },
        output: { path: '.rspack/testFn' },
      },
    ];
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'statsMock-outputPath',
            },
          },
          toJson: () => ({ modules: [] }),
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false),
        },
      ],
    };
    module.rspackConfig = testRspackConfig;
    module.configuration = { concurrency: 2 };
    module.serverless.service.package = {
      individually: true,
    };
    module.entryFunctions = [
      {
        handlerFile: 'function-name-1/handler',
        funcName: 'function-name-1',
        func: {
          handler: 'function-name-1/handler.handler',
          name: 'service-stage-function-name-1',
        },
        entry: {
          key: 'function-name-1/handler',
          value: './function-name-1/handler.js',
        },
      },
      {
        handlerFile: 'function-name-2/handler',
        funcName: 'function-name-2',
        func: {
          handler: 'function-name-2/handler.handler',
          name: 'service-stage-function-name-2',
        },
        entry: {
          key: 'function-name-2/handler',
          value: './function-name-2/handler.js',
        },
      },
    ];
    rspackMock.compilerMock.run.mockClear();
    rspackMock.compilerMock.run.mockImplementation((cb) =>
      cb(null, multiStats),
    );
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(rspackMock.rspack).toHaveBeenCalledWith({
          entry: {
            'function-name-1/handler': './function-name-1/handler.js',
          },
          output: { path: '.rspack/testFn' },
        });
        expect(rspackMock.rspack).toHaveBeenCalledWith({
          entry: {
            'function-name-2/handler': './function-name-2/handler.js',
          },
          output: { path: '.rspack/testFn' },
        });
        expect(rspackMock.compilerMock.run).toHaveBeenCalledTimes(2);
        return null;
      });
  });

  it('should use correct stats option', () => {
    const testRspackConfig = {
      stats: 'minimal',
      output: { path: '.rspack/testFn' },
    };
    const mockStats = {
      compilation: {
        errors: [],
        compiler: {
          outputPath: 'statsMock-outputPath',
        },
      },
      toJson: () => ({ modules: [] }),
      toString: jest.fn().mockReturnValue('testStats'),
      hasErrors: _.constant(false),
    };

    module.rspackConfig = testRspackConfig;
    module.configuration = { concurrency: 1 };
    rspackMock.compilerMock.run.mockClear();
    rspackMock.compilerMock.run.mockImplementation((cb) => cb(null, mockStats));
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(rspackMock.rspack).toHaveBeenCalledWith(testRspackConfig);
        expect(mockStats.toString.mock.calls).toEqual([
          [testRspackConfig.stats],
        ]);
        module.rspackConfig = [testRspackConfig];
        return expect(module.compile()).resolves.toBeUndefined();
      })
      .then(() => {
        expect(rspackMock.rspack).toHaveBeenCalledWith(testRspackConfig);
        expect(mockStats.toString.mock.calls).toEqual([
          [testRspackConfig.stats],
          [testRspackConfig.stats],
        ]);
        return null;
      });
  });

  it('should set stats outputPath', () => {
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'compileStats-outputPath',
            },
          },
          toJson: () => ({ modules: [] }),
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false),
        },
      ],
    };
    module.configuration = { concurrency: 1 };
    rspackMock.compilerMock.run.mockClear();
    rspackMock.compilerMock.run.mockImplementation((cb) =>
      cb(null, multiStats),
    );
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(module.compileStats.stats[0].outputPath).toEqual(
          'compileStats-outputPath',
        );
        return null;
      });
  });

  it('should set stats externals', () => {
    const multiStats = {
      stats: [
        {
          compilation: {
            errors: [],
            compiler: {
              outputPath: 'compileStats-outputPath',
            },
          },
          toJson: () => ({
            modules: [
              {
                identifier: 'crypto',
              },
              { identifier: 'uuid/v4' },
              { identifier: 'mockery' },
              {
                identifier: '@scoped/vendor/module1',
              },
              {
                identifier: 'external @scoped/vendor/module2',
              },
              {
                identifier: 'external uuid/v4',
              },
              {
                identifier: 'external localmodule',
              },
              {
                identifier: 'external aws-sdk',
              },
              {
                identifier: 'external node-commonjs lodash',
              },
              {
                identifier: 'external this glob',
              },
              {
                identifier: 'external module semver',
              },
              {
                identifier: 'external assign whatever',
              },
              {
                identifier: 'external umd2 hiyou',
              },
            ],
          }),
          toString: jest.fn().mockReturnValue('testStats'),
          hasErrors: _.constant(false),
        },
      ],
    };
    module.configuration = { concurrency: 1 };
    rspackMock.compilerMock.run.mockClear();
    rspackMock.compilerMock.run.mockImplementation((cb) =>
      cb(null, multiStats),
    );
    return expect(module.compile())
      .resolves.toBeUndefined()
      .then(() => {
        expect(module.compileStats.stats[0].externalModules).toEqual([
          { external: '@scoped/vendor', origin: undefined },
          { external: 'uuid', origin: undefined },
          { external: 'localmodule', origin: undefined },
          { external: 'aws-sdk', origin: undefined },
          { external: 'lodash', origin: undefined },
          { external: 'glob', origin: undefined },
          { external: 'semver', origin: undefined },
          { external: 'whatever', origin: undefined },
          { external: 'hiyou', origin: undefined },
        ]);
        return null;
      });
  });
});
