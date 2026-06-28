const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  moduleNameMapper: {
    ...jestConfig.moduleNameMapper,
    "^lightning/graphql$":
      "<rootDir>/force-app/test/jest-mocks/lightning/graphql"
  },
  modulePathIgnorePatterns: ["<rootDir>/.localdevserver"]
};
