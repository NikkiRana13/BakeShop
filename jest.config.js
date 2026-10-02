module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // The full-app render test walks every tab; a cold transform on a slow
  // machine can exceed Jest's 5 s default.
  testTimeout: 30000,
  // The vendor-search server is a separate Node project.
  modulePathIgnorePatterns: ['<rootDir>/server/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/server/'],
};
