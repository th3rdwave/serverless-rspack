'use strict';

const statsMock = {
  compilation: {
    errors: [],
    compiler: {
      outputPath: 'statsMock-outputPath',
    },
  },
  toString: jest.fn().mockReturnValue('testStats'),
  toJson: () => ({ modules: [] }),
  hasErrors() {
    return Boolean(this.compilation.errors.length);
  },
};

const compilerMock = {
  run: jest.fn().mockImplementation((cb) => cb(null, statsMock)),
  watch: jest.fn().mockImplementation((cb) => cb(null, statsMock)),
  hooks: {
    beforeCompile: {
      tapPromise: jest.fn(),
    },
  },
  plugin: jest.fn().mockImplementation((name, cb) => cb(null, {})),
  close: jest.fn(),
};

const rspack = jest.fn().mockReturnValue(compilerMock);

module.exports = { rspack, compilerMock, statsMock };
