'use strict';
/**
 * Unit tests for packagers/index
 */

const _ = require('lodash');
const Serverless = require('serverless');
const baseModule = require('../../src/packagers/index');

jest.mock('fs-extra');
jest.mock('../../src/packagers/npm', () => ({
  hello: 'I am NPM',
}));
jest.mock('../../src/packagers/yarn', () => ({
  hello: 'I am Yarn',
}));

describe('packagers factory', () => {
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
        options: {
          verbose: true,
        },
      },
      baseModule,
    );
  });

  it('should throw on unknown packagers', () => {
    expect(() => module.get.call({ serverless }, 'unknown')).toThrow(
      /Could not find packager/,
    );
  });

  it('should return npm packager', () => {
    const npm = module.get.call(module, 'npm');
    expect(npm).toEqual({
      hello: 'I am NPM',
    });
  });
});
