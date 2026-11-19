// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // `monaco-editor` ships only ES modules, and the grammar test tokenizes with it, so it has to
  // be transformed like the Grafana packages are.
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, '@marcbachmann/cel-js', 'monaco-editor'])],
};
