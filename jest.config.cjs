// jest.config.js
module.exports = {
  verbose: true,
  transform: {
    // <transform_regex>: ['ts-jest', { /* ts-jest config goes here in Jest */ }],
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  testPathIgnorePatterns: ["/node_modules/"],
  testRegex: "/__tests__/.*\\.test\\.ts$",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  moduleFileExtensions: ["ts", "js", "json", "node"],
  globals: {
    "ts-jest": {
      diagnostics: {
        // Do not fail on TS compilation errors
        // https://kulshekhar.github.io/ts-jest/user/config/diagnostics#do-not-fail-on-first-error
        warnOnly: true,
      },
    },
  },
  testEnvironment: "node",
  testTimeout: 20000,
};
