'use strict';

const _ = require('lodash');
const Serverless = require('serverless');
const Configuration = require('../src/Configuration');
const fseMock = require('fs-extra');
const logMock = require('@serverless/utils/log').log;
const baseModule = require('../src/cleanup');

jest.mock('fs-extra');
jest.mock('@serverless/utils/log');

describe('cleanup', () => {
  let serverless;
  let module;
  let dirExistsSyncStub;

  beforeEach(() => {
    serverless = new Serverless({
      commands: ['print'],
      options: {},
      serviceDir: null,
    });
    serverless.cli = {
      log: jest.fn(),
      error: jest.fn(),
      consoleLog: jest.fn(),
    };

    dirExistsSyncStub = jest.fn();
    serverless.utils.dirExistsSync = dirExistsSyncStub;

    module = _.assign(
      {
        serverless,
        options: {
          verbose: true,
        },
        rspackOutputPath: 'my/Output/Path',
        configuration: new Configuration(),
      },
      baseModule,
    );
  });

  it('should remove output dir if it exists', () => {
    dirExistsSyncStub.mockReturnValue(true);
    fseMock.remove.mockResolvedValue(true);

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(1);
        expect(dirExistsSyncStub).toHaveBeenCalledWith('my/Output/Path');
        expect(fseMock.remove).toHaveBeenCalledTimes(1);
        expect(logMock.verbose).toHaveBeenCalledWith(
          'Removing my/Output/Path done',
        );
        return null;
      });
  });

  it('should log nothing is verbose is false', () => {
    dirExistsSyncStub.mockReturnValue(true);
    fseMock.remove.mockResolvedValue(true);

    module = _.assign({}, module, { options: { verbose: false } });

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(1);
        expect(dirExistsSyncStub).toHaveBeenCalledWith('my/Output/Path');
        expect(fseMock.remove).toHaveBeenCalledTimes(1);
        expect(serverless.cli.log).toHaveBeenCalledTimes(0);
        return null;
      });
  });

  it('should log an error if it occurs', () => {
    dirExistsSyncStub.mockReturnValue(true);
    fseMock.remove.mockRejectedValue('remove error');

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(logMock.error).toHaveBeenCalledWith(
          'Error occurred while removing my/Output/Path: remove error',
        );

        return null;
      });
  });

  it('should not call remove if output dir does not exists', () => {
    dirExistsSyncStub.mockReturnValue(false);

    return expect(module.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(1);
        expect(dirExistsSyncStub).toHaveBeenCalledWith('my/Output/Path');
        expect(fseMock.remove).toHaveBeenCalledTimes(0);
        return null;
      });
  });

  it('should keep output dir if keepOutputDir = true', () => {
    dirExistsSyncStub.mockReturnValue(true);

    const configuredModule = _.assign({}, module, {
      keepOutputDirectory: true,
    });
    return expect(configuredModule.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(0);
        expect(fseMock.remove).toHaveBeenCalledTimes(0);
        return null;
      });
  });

  it('should keep output dir if keepOutputDir = true in configuration', () => {
    dirExistsSyncStub.mockReturnValue(true);

    const configuredModule = _.assign({}, module, {
      configuration: new Configuration({
        rspack: { keepOutputDirectory: true },
      }),
    });

    return expect(configuredModule.cleanup())
      .resolves.toBeUndefined()
      .then(() => {
        expect(dirExistsSyncStub).toHaveBeenCalledTimes(0);
        expect(fseMock.remove).toHaveBeenCalledTimes(0);
        return null;
      });
  });
});
