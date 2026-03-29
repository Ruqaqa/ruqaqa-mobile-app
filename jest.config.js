/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(mp3|wav|ogg)$': '<rootDir>/src/__mocks__/fileMock.js',
  },
};
