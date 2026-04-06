const basePreset = require('expo-module-scripts/jest-preset');

// Use only the Node project from the preset — our tests are pure TypeScript
// and don't need iOS/Android/Web platform runners
const nodeProject = basePreset.projects.find((p) => p.displayName?.name === 'Node');

module.exports = {
  ...nodeProject,
  // Override setupFiles to skip react-native setup that requires Flow parsing
  setupFiles: [],
  // Remove the react-native → react-native-web mapping so jest.mock('react-native') works
  moduleNameMapper: {
    ...nodeProject.moduleNameMapper,
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
  },
  // Drop the RN resolver — default jest resolver is sufficient for our pure-TS tests
  resolver: undefined,
};
