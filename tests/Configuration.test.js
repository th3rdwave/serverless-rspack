'use strict';
/**
 * Unit tests for Configuration.
 */

const os = require('os');
const Configuration = require('../src/Configuration');

describe('Configuration', () => {
  describe('defaults', () => {
    let expectedDefaults;

    beforeAll(() => {
      expectedDefaults = {
        rspackConfig: 'rspack.config.js',
        includeModules: false,
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length,
      };
    });

    it('should set default configuration without custom', () => {
      const config = new Configuration();
      expect(config._config).toEqual(expectedDefaults);
      expect(config.hasLegacyConfig).toBe(false);
    });

    it('should set default configuration without rspack property', () => {
      const config = new Configuration({});
      expect(config._config).toEqual(expectedDefaults);
      expect(config.hasLegacyConfig).toBe(false);
    });
  });

  describe('with legacy configuration', () => {
    it('should use custom.rspackIncludeModules', () => {
      const testCustom = { rspackIncludeModules: { forceInclude: ['mod1'] } };
      const config = new Configuration(testCustom);
      expect(config.includeModules).toEqual(testCustom.rspackIncludeModules);
    });

    it('should use custom.rspack as string', () => {
      const testCustom = { rspack: 'myRspackFile.js' };
      const config = new Configuration(testCustom);
      expect(config.rspackConfig).toBe('myRspackFile.js');
    });

    it('should detect it', () => {
      const testCustom = { rspack: 'myRspackFile.js' };
      const config = new Configuration(testCustom);
      expect(config.hasLegacyConfig).toBe(true);
    });

    it('should add defaults', () => {
      const testCustom = {
        rspackIncludeModules: { forceInclude: ['mod1'] },
        rspack: 'myRspackFile.js',
      };
      const config = new Configuration(testCustom);
      expect(config.includeModules).toEqual(testCustom.rspackIncludeModules);
      expect(config._config).toEqual({
        rspackConfig: 'myRspackFile.js',
        includeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length,
      });
    });
  });

  describe('with a configuration object', () => {
    it('should use it and add any defaults', () => {
      const testCustom = {
        rspack: {
          includeModules: { forceInclude: ['mod1'] },
          rspackConfig: 'myRspackFile.js',
        },
      };
      const config = new Configuration(testCustom);
      expect(config._config).toEqual({
        rspackConfig: 'myRspackFile.js',
        includeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length,
      });
    });

    it('should favor new configuration', () => {
      const testCustom = {
        rspackIncludeModules: { forceExclude: ['mod2'] },
        rspack: {
          includeModules: { forceInclude: ['mod1'] },
          rspackConfig: 'myRspackFile.js',
        },
      };
      const config = new Configuration(testCustom);
      expect(config._config).toEqual({
        rspackConfig: 'myRspackFile.js',
        includeModules: { forceInclude: ['mod1'] },
        packager: 'npm',
        packagerOptions: {},
        keepOutputDirectory: false,
        config: null,
        concurrency: os.cpus().length,
      });
    });

    it('should accept a numeric string as concurrency value', () => {
      const testCustom = {
        rspack: {
          includeModules: { forceInclude: ['mod1'] },
          rspackConfig: 'myRspackFile.js',
          concurrency: '3',
        },
      };
      const config = new Configuration(testCustom);
      expect(config.concurrency).toBe(3);
    });

    it('should not accept an invalid string as concurrency value', () => {
      const testCustom = {
        rspack: {
          includeModules: { forceInclude: ['mod1'] },
          rspackConfig: 'myRspackFile.js',
          concurrency: '3abc',
        },
      };
      expect(() => new Configuration(testCustom)).toThrow();
    });

    it('should not accept a non-positive number as concurrency value', () => {
      const testCustom = {
        rspack: {
          includeModules: { forceInclude: ['mod1'] },
          rspackConfig: 'myRspackFile.js',
          concurrency: 0,
        },
      };
      expect(() => new Configuration(testCustom)).toThrow();
    });

    it('should be backward compatible with serializedCompile', () => {
      const testCustom = {
        rspack: {
          serializedCompile: true,
        },
      };
      const config = new Configuration(testCustom);
      expect(config.concurrency).toBe(1);
    });
  });
});
