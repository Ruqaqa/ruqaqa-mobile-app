/**
 * Tests for authService — mobile signin role check, post-login validation,
 * token refresh, and server logout.
 */

// ---------------------------------------------------------------------------
// Mocks — must come before imports
// ---------------------------------------------------------------------------

// Mock expo-secure-store (required by tokenStorage)
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

// Mock keycloakDiscovery to avoid pulling in expo-constants
jest.mock('../keycloakDiscovery', () => ({
  keycloakConfig: {
    clientId: 'ruqaqa-mobile-app',
    scopes: ['openid', 'profile', 'email'],
  },
  keycloakEndpoints: {
    token: 'https://auth.ruqaqa.sa/realms/ruqaqa/protocol/openid-connect/token',
    endSession:
      'https://auth.ruqaqa.sa/realms/ruqaqa/protocol/openid-connect/logout',
  },
}));

// Mock config to avoid expo-constants
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'https://ruqaqa.sa',
    keycloakUrl: 'https://auth.ruqaqa.sa',
    keycloakRealm: 'ruqaqa',
    keycloakClientId: 'ruqaqa-mobile-app',
  },
}));

// Mock axios
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      post: jest.fn(),
      isAxiosError: actual.default.isAxiosError ?? actual.isAxiosError,
    },
    post: jest.fn(),
    isAxiosError: actual.isAxiosError,
  };
});

// Mock retry to pass through (no delays in tests)
jest.mock('../../utils/retry', () => ({
  withRetry: jest.fn((fn: () => Promise<any>) => fn()),
  isRetryableError: jest.fn((err: unknown) => {
    const axios = jest.requireActual('axios');
    return axios.isAxiosError(err) && !(err as any).response;
  }),
}));

// Mock employeeService (extracted from authService)
const mockValidateEmployee = jest.fn();
jest.mock('../employeeService', () => ({
  validateEmployee: (...args: any[]) => mockValidateEmployee(...args),
}));

import axios, { AxiosError } from 'axios';
import {
  hasMobileSigninRole,
  postLoginValidation,
  refreshTokens,
  logoutServer,
} from '../authService';
import { tokenStorage } from '../tokenStorage';

const mockedAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

// Helper: build a minimal JWT string with a given payload
function buildJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const sig = 'fake-signature';
  return `${header}.${body}.${sig}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
});

// ---------------------------------------------------------------------------
// hasMobileSigninRole
// ---------------------------------------------------------------------------

describe('hasMobileSigninRole', () => {
  it('returns true when mobile_signin is in realm roles', () => {
    expect(
      hasMobileSigninRole({
        realm_access: { roles: ['mobile_signin', 'other_role'] },
      }),
    ).toBe(true);
  });

  it('returns true when mobile_signin is in client roles', () => {
    expect(
      hasMobileSigninRole({
        resource_access: {
          'ruqaqa-mobile-app': { roles: ['mobile_signin'] },
        },
      }),
    ).toBe(true);
  });

  it('returns false when role absent from both', () => {
    expect(
      hasMobileSigninRole({
        realm_access: { roles: ['other_role'] },
        resource_access: {
          'ruqaqa-mobile-app': { roles: ['other_role'] },
        },
      }),
    ).toBe(false);
  });

  it('returns false for empty payload', () => {
    expect(hasMobileSigninRole({})).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// postLoginValidation
// ---------------------------------------------------------------------------

describe('postLoginValidation', () => {
  it('returns error no_token when no access token payload', async () => {
    // mockStore is empty — no tokens stored
    const result = await postLoginValidation();
    expect(result).toMatchObject({
      success: false,
      employee: null,
      permissions: null,
      error: 'no_token',
    });
  });

  it('returns error no_mobile_signin and clears tokens when role missing', async () => {
    // Store a JWT that does NOT have mobile_signin role
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    const result = await postLoginValidation();
    expect(result.success).toBe(false);
    expect(result.error).toBe('no_mobile_signin');
    // Verify tokens were cleared
    expect(await tokenStorage.getAccessToken()).toBeNull();
  });

  it('returns error validation_failed when backend validation fails', async () => {
    // Store a JWT with mobile_signin role
    const jwt = buildJwt({
      sub: 'user1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      realm_access: { roles: ['mobile_signin'] },
    });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    // Mock validateEmployee to return null (validation failed)
    mockValidateEmployee.mockResolvedValueOnce(null);

    const result = await postLoginValidation();
    expect(result.success).toBe(false);
    expect(result.error).toBe('validation_failed');
    // Verify tokens were cleared
    expect(await tokenStorage.getAccessToken()).toBeNull();
  });

  it('returns success with employee and permissions when everything passes', async () => {
    const jwt = buildJwt({
      sub: 'user1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      realm_access: { roles: ['mobile_signin', 'transactions_create'] },
    });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    const mockEmployee = {
      id: 'emp1',
      name: 'Test User',
      email: 'test@ruqaqa.sa',
    };
    mockValidateEmployee.mockResolvedValueOnce(mockEmployee);

    const result = await postLoginValidation();
    expect(result.success).toBe(true);
    expect(result.employee).toEqual(mockEmployee);
    expect(result.permissions).toBeDefined();
    expect(result.permissions!.canCreateTransactions).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// refreshTokens
// ---------------------------------------------------------------------------

describe('refreshTokens', () => {
  it('returns success false when no refresh token exists', async () => {
    // mockStore is empty — no refresh token
    const result = await refreshTokens();
    expect(result).toEqual({ success: false, isNetworkError: false });
  });

  it('returns success true and saves new tokens on 200', async () => {
    // Store a refresh token
    mockStore.set('auth_refresh_token', 'old-refresh-token');

    const newJwt = buildJwt({
      sub: 'user1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        access_token: newJwt,
        refresh_token: 'new-refresh-token',
        id_token: 'new-id-token',
        expires_in: 3600,
      },
    });

    const result = await refreshTokens();
    expect(result).toEqual({ success: true, isNetworkError: false });
    // Verify tokens were saved
    expect(await tokenStorage.getAccessToken()).toBe(newJwt);
    expect(await tokenStorage.getRefreshToken()).toBe('new-refresh-token');
  });

  it('returns success false with isNetworkError true when axios has no response', async () => {
    mockStore.set('auth_refresh_token', 'some-refresh-token');

    const networkErr = new AxiosError('Network Error', 'ERR_NETWORK');
    mockedAxiosPost.mockRejectedValueOnce(networkErr);

    const result = await refreshTokens();
    expect(result).toEqual({ success: false, isNetworkError: true });
  });

  it('returns success false with isNetworkError false on 400/401 rejection', async () => {
    mockStore.set('auth_refresh_token', 'some-refresh-token');

    const authErr = new AxiosError(
      'Bad Request',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
        data: { error: 'invalid_grant' },
      },
    );
    mockedAxiosPost.mockRejectedValueOnce(authErr);

    const result = await refreshTokens();
    expect(result).toEqual({ success: false, isNetworkError: false });
  });
});

// ---------------------------------------------------------------------------
// logoutServer
// ---------------------------------------------------------------------------

describe('logoutServer', () => {
  it('revokes token on Keycloak and clears local storage', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'refresh-to-revoke',
      expiresIn: 3600,
    });

    mockedAxiosPost.mockResolvedValueOnce({ data: {} });

    await logoutServer();

    // Verify Keycloak logout was called
    expect(mockedAxiosPost).toHaveBeenCalledWith(
      'https://auth.ruqaqa.sa/realms/ruqaqa/protocol/openid-connect/logout',
      expect.any(String),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    // Verify local tokens were cleared
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it('clears local storage even if server revocation fails', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'refresh-to-revoke',
      expiresIn: 3600,
    });

    mockedAxiosPost.mockRejectedValueOnce(new Error('Server unreachable'));

    await logoutServer();

    // Tokens should still be cleared
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it('clears local storage even if no refresh token exists', async () => {
    // Store only an access token, no refresh token
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    mockStore.set('auth_access_token', jwt);

    await logoutServer();

    // Should not have tried to revoke (no refresh token)
    expect(mockedAxiosPost).not.toHaveBeenCalled();
    // Local storage should still be cleared
    expect(await tokenStorage.getAccessToken()).toBeNull();
  });

  it('retries revocation once on failure', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'refresh-to-revoke',
      expiresIn: 3600,
    });

    // First call fails, second succeeds
    mockedAxiosPost
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: {} });

    await logoutServer();

    // Should have been called twice (initial + 1 retry)
    const logoutCalls = mockedAxiosPost.mock.calls.filter(([url]) =>
      (url as string).includes('logout'),
    );
    expect(logoutCalls).toHaveLength(2);
    // Tokens still cleared
    expect(await tokenStorage.getAccessToken()).toBeNull();
  });

  it('clears tokens even if both revocation attempts fail', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'refresh-to-revoke',
      expiresIn: 3600,
    });

    // Both attempts fail
    mockedAxiosPost
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error again'));

    await logoutServer();

    // Should have tried twice
    const logoutCalls = mockedAxiosPost.mock.calls.filter(([url]) =>
      (url as string).includes('logout'),
    );
    expect(logoutCalls).toHaveLength(2);
    // Tokens must still be cleared
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });
});
