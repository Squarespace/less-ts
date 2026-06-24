// Shared jest config: the package configs point here and
// only scope the rootDir and the coverage path.
module.exports = {
  "collectCoverageFrom": [
    "packages/*/src/**/*.ts",
    "!packages/*/src/**/index.ts",
    "!packages/*/src/**/*.d.ts"
  ],
  "coverageReporters": [
    "json",
    "lcov",
    "text",
    "html"
  ],
  "moduleFileExtensions": [
    "js",
    "ts",
    "tsx"
  ],
  "testMatch": [
    "**/__tests__/**/*.test.ts"
  ],
  "transform": {
    "^.+\\.(ts|tsx)$": "ts-jest"
  }
};
