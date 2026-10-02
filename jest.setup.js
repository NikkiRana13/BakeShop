/* eslint-env jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
// Tests never call the vendor-search server; they use the sample data.
jest.mock('./src/services/config', () => ({
  API_BASE_URL: 'http://localhost:8787',
  USE_LIVE_API: false,
}));
