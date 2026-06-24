const base = require('../../jest.config.js');

module.exports = { ...base, rootDir: __dirname, collectCoverageFrom: ['src/**/*.ts'] };
