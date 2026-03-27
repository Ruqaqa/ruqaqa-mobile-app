/**
 * Tests for appLifecycle — first launch tracking.
 */

// Mock AsyncStorage
const mockAsyncStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockAsyncStore.get(key) ?? null),
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStore.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockAsyncStore.delete(key);
    return Promise.resolve();
  }),
}));

import { isFirstLaunch, markLaunched } from '../appLifecycle';

beforeEach(() => {
  jest.clearAllMocks();
  mockAsyncStore.clear();
});

describe('isFirstLaunch and markLaunched', () => {
  it('returns true on first call', async () => {
    expect(await isFirstLaunch()).toBe(true);
  });

  it('returns false after markLaunched', async () => {
    await markLaunched();
    expect(await isFirstLaunch()).toBe(false);
  });

  it('returns true again after storage is cleared', async () => {
    await markLaunched();
    expect(await isFirstLaunch()).toBe(false);
    mockAsyncStore.clear();
    expect(await isFirstLaunch()).toBe(true);
  });
});
