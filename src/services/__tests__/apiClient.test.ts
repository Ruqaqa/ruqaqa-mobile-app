/**
 * Tests for apiClient — request interceptor (Bearer token, proactive refresh),
 * response error interceptor (401 retry, session expiration), and refresh deduplication.
 */

// ---------------------------------------------------------------------------
// Mocks — must come before imports
// ---------------------------------------------------------------------------

// Mock expo-secure-store (required by tokenStorage)
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock keycloakDiscovery to avoid expo-constants
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

// Mock config
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'https://ruqaqa.sa',
    keycloakUrl: 'https://auth.ruqaqa.sa',
    keycloakRealm: 'ruqaqa',
    keycloakClientId: 'ruqaqa-mobile-app',
  },
}));

// Mock tokenStorage with controllable return values
const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
const mockIsTokenExpiringSoon = jest.fn<Promise<boolean>, []>();
jest.mock('../tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: (...args: any[]) => mockGetAccessToken(...args),
    isTokenExpiringSoon: (...args: any[]) => mockIsTokenExpiringSoon(...args),
    getRefreshToken: jest.fn(() => Promise.resolve(null)),
    saveTokens: jest.fn(() => Promise.resolve()),
    clearAll: jest.fn(() => Promise.resolve()),
  },
}));

// Mock authService.refreshTokens
const mockRefreshTokens = jest.fn<
  Promise<{ success: boolean; isNetworkError: boolean }>,
  []
>();
jest.mock('../authService', () => ({
  refreshTokens: (...args: any[]) => mockRefreshTokens(...args),
}));

import MockAdapter from 'axios-mock-adapter';
import { apiClient, setSessionExpiredHandler } from '../apiClient';

let mock: MockAdapter;

beforeEach(() => {
  jest.clearAllMocks();
  mock = new MockAdapter(apiClient);
  mockGetAccessToken.mockResolvedValue(null);
  mockIsTokenExpiringSoon.mockResolvedValue(false);
  mockRefreshTokens.mockResolvedValue({ success: false, isNetworkError: false });
});

afterEach(() => {
  mock.restore();
  setSessionExpiredHandler(() => {});
});

// ---------------------------------------------------------------------------
// Request interceptor — Bearer token
// ---------------------------------------------------------------------------

describe('request interceptor', () => {
  it('attaches Bearer token to requests when token exists', async () => {
    mockGetAccessToken.mockResolvedValue('my-access-token');
    mock.onGet('/test').reply(200, { ok: true });

    const res = await apiClient.get('/test');

    expect(res.status).toBe(200);
    // Verify the Authorization header was sent
    expect(mock.history.get[0].headers?.Authorization).toBe(
      'Bearer my-access-token',
    );
  });

  it('sends request without auth header when no token stored', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    mock.onGet('/test').reply(200, { ok: true });

    const res = await apiClient.get('/test');

    expect(res.status).toBe(200);
    // Authorization should not be set (or be undefined)
    expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
  });

  it('proactively refreshes token when isTokenExpiringSoon returns true', async () => {
    mockIsTokenExpiringSoon.mockResolvedValue(true);
    mockRefreshTokens.mockResolvedValue({
      success: true,
      isNetworkError: false,
    });
    mockGetAccessToken.mockResolvedValue('refreshed-token');
    mock.onGet('/test').reply(200, { ok: true });

    await apiClient.get('/test');

    // Verify refresh was called
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
    // Verify the refreshed token was used
    expect(mock.history.get[0].headers?.Authorization).toBe(
      'Bearer refreshed-token',
    );
  });
});

// ---------------------------------------------------------------------------
// Response error interceptor — 401 retry
// ---------------------------------------------------------------------------

describe('response error interceptor (401 retry)', () => {
  it('retries once on 401 with refreshed token', async () => {
    mockGetAccessToken.mockResolvedValue('initial-token');
    // First request returns 401, then after refresh the retry succeeds
    mock.onGet('/protected').replyOnce(401).onGet('/protected').replyOnce(200, { data: 'ok' });
    mockRefreshTokens.mockResolvedValue({
      success: true,
      isNetworkError: false,
    });
    // After refresh, return new token
    mockGetAccessToken
      .mockResolvedValueOnce('initial-token') // first request's interceptor
      .mockResolvedValueOnce('refreshed-token'); // retry's interceptor gets new token

    const res = await apiClient.get('/protected');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ data: 'ok' });
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
  });

  it('does not retry the same request twice (prevents infinite loop)', async () => {
    mockGetAccessToken.mockResolvedValue('some-token');
    // Both attempts return 401
    mock.onGet('/protected').reply(401);
    mockRefreshTokens.mockResolvedValue({
      success: true,
      isNetworkError: false,
    });

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });
    // Only one refresh attempt (the retry also fails with 401 but __retried prevents another)
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
  });

  it('calls sessionExpiredHandler when refresh fails on auth rejection', async () => {
    const sessionExpiredSpy = jest.fn();
    setSessionExpiredHandler(sessionExpiredSpy);

    mockGetAccessToken.mockResolvedValue('some-token');
    mock.onGet('/protected').reply(401);
    mockRefreshTokens.mockResolvedValue({
      success: false,
      isNetworkError: false,
    });

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(sessionExpiredSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call sessionExpiredHandler on network errors', async () => {
    const sessionExpiredSpy = jest.fn();
    setSessionExpiredHandler(sessionExpiredSpy);

    mockGetAccessToken.mockResolvedValue('some-token');
    mock.onGet('/protected').reply(401);
    mockRefreshTokens.mockResolvedValue({
      success: false,
      isNetworkError: true,
    });

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(sessionExpiredSpy).not.toHaveBeenCalled();
  });

  it('passes through non-401 errors without retry', async () => {
    mockGetAccessToken.mockResolvedValue('some-token');
    mock.onGet('/not-found').reply(404, { error: 'not found' });

    await expect(apiClient.get('/not-found')).rejects.toMatchObject({
      response: { status: 404 },
    });
    // refreshTokens should NOT have been called for a 404
    expect(mockRefreshTokens).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Refresh deduplication — concurrent 401s
// ---------------------------------------------------------------------------

describe('refresh deduplication', () => {
  it('concurrent 401s produce only one refresh call', async () => {
    mockGetAccessToken.mockResolvedValue('some-token');

    // Both requests get 401 on first try, succeed on retry
    mock
      .onGet('/resource-a')
      .replyOnce(401)
      .onGet('/resource-a')
      .replyOnce(200, { a: true });
    mock
      .onGet('/resource-b')
      .replyOnce(401)
      .onGet('/resource-b')
      .replyOnce(200, { b: true });

    // Slow refresh so both 401s arrive before refresh resolves
    let resolveRefresh!: () => void;
    mockRefreshTokens.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = () =>
            resolve({ success: true, isNetworkError: false });
        }),
    );

    const promiseA = apiClient.get('/resource-a');
    const promiseB = apiClient.get('/resource-b');

    // Wait a tick for both 401s to trigger the refresh
    await new Promise((r) => setTimeout(r, 10));
    resolveRefresh();

    const [resA, resB] = await Promise.all([promiseA, promiseB]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    // createDeduplicatedRefresh ensures only one actual refresh call
    expect(mockRefreshTokens).toHaveBeenCalledTimes(1);
  });
});
