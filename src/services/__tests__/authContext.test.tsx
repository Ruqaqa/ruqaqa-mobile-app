/**
 * Tests for AuthContext logout — verifies that all caches and stores
 * are cleared during sign-out (security fix).
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — must come before imports
// ---------------------------------------------------------------------------

// Mock expo-secure-store
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn((key: string) =>
    Promise.resolve(mockStore.get(key) ?? null),
  ),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
}));

// Mock react-native
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
  Platform: { OS: 'android' },
}));

// Mock expo-auth-session
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'ruqaqa://auth/callback'),
  AuthRequest: jest.fn(),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  dismissBrowser: jest.fn(),
  __esModule: true,
}));

// Mock keycloakDiscovery
jest.mock('../keycloakDiscovery', () => ({
  keycloakConfig: {
    clientId: 'ruqaqa-mobile-app',
    scopes: ['openid', 'profile', 'email'],
  },
  keycloakEndpoints: {
    authorization: 'https://auth.ruqaqa.sa/realms/ruqaqa/protocol/openid-connect/auth',
    token: 'https://auth.ruqaqa.sa/realms/ruqaqa/protocol/openid-connect/token',
    endSession: 'https://auth.ruqaqa.sa/realms/ruqaqa/protocol/openid-connect/logout',
  },
}));

// Mock config
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'https://ruqaqa.sa',
    keycloakUrl: 'https://auth.ruqaqa.sa',
    keycloakRealm: 'ruqaqa',
    keycloakClientId: 'ruqaqa-mobile-app',
  },
}));

// Mock authService
const mockLogoutServer = jest.fn().mockResolvedValue(undefined);
jest.mock('../authService', () => ({
  exchangeCodeForTokens: jest.fn(),
  logoutServer: (...args: any[]) => mockLogoutServer(...args),
  postLoginValidation: jest.fn().mockResolvedValue({ success: false, error: 'no_token' }),
  refreshTokens: jest.fn().mockResolvedValue({ success: false, isNetworkError: false }),
}));

// Mock apiClient
jest.mock('../apiClient', () => ({
  setSessionExpiredHandler: jest.fn(),
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

// Mock employeeCacheService
const mockClearEmployeeCache = jest.fn();
jest.mock('../employeeCacheService', () => ({
  initializeEmployeeCache: jest.fn().mockResolvedValue(undefined),
  clearEmployeeCache: (...args: any[]) => mockClearEmployeeCache(...args),
}));

// Mock financeChannelService
const mockClearFinanceChannelCache = jest.fn();
jest.mock('../financeChannelService', () => ({
  initializeFinanceChannelCache: jest.fn().mockResolvedValue(undefined),
  clearFinanceChannelCache: (...args: any[]) => mockClearFinanceChannelCache(...args),
}));

// Mock formCacheService
const mockClearFormCache = jest.fn().mockResolvedValue(undefined);
jest.mock('../formCacheService', () => ({
  clearFormCache: (...args: any[]) => mockClearFormCache(...args),
}));

// Mock watermarkSettingsService
const mockInvalidateWatermarkCache = jest.fn();
jest.mock('../../features/gallery/services/watermarkSettingsService', () => ({
  invalidateCache: (...args: any[]) => mockInvalidateWatermarkCache(...args),
}));

// Mock shareIntentStore
const mockShareIntentClear = jest.fn();
jest.mock('../shareIntent/shareIntentStore', () => ({
  shareIntentStore: {
    clear: (...args: any[]) => mockShareIntentClear(...args),
    getState: jest.fn(() => ({ status: 'idle' })),
    subscribe: jest.fn(() => () => {}),
  },
}));

// Mock deduplicatedRefresh
jest.mock('../../utils/deduplicatedRefresh', () => ({
  createDeduplicatedRefresh: (fn: Function) => fn,
}));

import { AuthProvider, useAuth } from '../authContext';
import * as WebBrowser from 'expo-web-browser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthContext logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
  });

  it('calls logoutServer during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for init to complete
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(mockLogoutServer).toHaveBeenCalledTimes(1);
  });

  it('clears employee and finance channel caches during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(mockClearEmployeeCache).toHaveBeenCalledTimes(1);
    expect(mockClearFinanceChannelCache).toHaveBeenCalledTimes(1);
  });

  it('clears form cache during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(mockClearFormCache).toHaveBeenCalledTimes(1);
  });

  it('invalidates watermark settings cache during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(mockInvalidateWatermarkCache).toHaveBeenCalledTimes(1);
  });

  it('clears share intent store during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(mockShareIntentClear).toHaveBeenCalledTimes(1);
  });

  it('sets isAuthenticated to false after logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('clears employee and permissions after logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.employee).toBeNull();
    expect(result.current.permissions).toBeNull();
  });

  it('sets logoutMessage when message is provided', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout('userSignedOut');
    });

    expect(result.current.logoutMessage).toBe('userSignedOut');
  });

  it('does not set logoutMessage when no message is provided', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.logoutMessage).toBeNull();
  });

  it('dismisses browser session during logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(WebBrowser.dismissBrowser).toHaveBeenCalledTimes(1);
  });
});
