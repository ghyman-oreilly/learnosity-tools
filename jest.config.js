module.exports = {
  testPathIgnorePatterns: [
    "<rootDir>/test/node/",  // Ignore the 'node' folder
  ],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
  },
};