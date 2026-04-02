/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(mp3|wav|ogg)$': '<rootDir>/src/__mocks__/fileMock.js',
    '^react-native-compressor$': '<rootDir>/src/__mocks__/react-native-compressor.js',
    '^expo-keep-awake$': '<rootDir>/src/__mocks__/expo-keep-awake.js',
  },
};
