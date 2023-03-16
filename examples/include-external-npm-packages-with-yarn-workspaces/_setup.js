'use strict';

const path = require('path');

module.exports = async (originalFixturePath, fixturePath, utils) => {
  const pluginPath = path.resolve(originalFixturePath, '..', '..');

  const SLS_CONFIG_PATH = path.join(
    fixturePath,
    'packages',
    'project',
    'serverless.yml',
  );
  const RSPACK_CONFIG_PATH = path.join(
    fixturePath,
    'packages',
    'project',
    'rspack.config.js',
  );
  const PACKAGE_JSON_PATH = path.join(
    fixturePath,
    'packages',
    'project',
    'package.json',
  );
  const LOCK_PATH = path.join(fixturePath, 'yarn.lock');

  await Promise.all([
    utils.replaceInFile(
      SLS_CONFIG_PATH,
      '- serverless-rspack',
      `- ${pluginPath}`,
    ),
    utils.replaceInFile(
      RSPACK_CONFIG_PATH,
      "'serverless-rspack'",
      `'${pluginPath}'`,
    ),
    utils.replaceInFile(PACKAGE_JSON_PATH, 'file:../..', `file:${pluginPath}`),
    utils.replaceInFile(LOCK_PATH, '../..', `${pluginPath}`),
  ]);

  const command = /^win/.test(process.platform) ? 'yarn.cmd' : 'yarn';

  return utils.spawnProcess(command, ['install'], { cwd: __dirname });
};
