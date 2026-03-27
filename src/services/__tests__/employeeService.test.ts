/**
 * Tests for employeeService — validates employee against backend via apiClient.
 */

// ---------------------------------------------------------------------------
// Mocks — must come before imports
// ---------------------------------------------------------------------------

// Mock expo-secure-store (required by tokenStorage, which apiClient imports)
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
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

// Mock retry to pass through (no delays in tests)
jest.mock('../../utils/retry', () => ({
  withRetry: jest.fn((fn: () => Promise<any>) => fn()),
  isRetryableError: jest.fn(),
}));

// Mock axios to intercept all HTTP calls (apiClient uses axios.create internally)
jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  // Create a mock instance
  const mockInstance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    ...actualAxios,
    default: {
      ...actualAxios.default,
      create: jest.fn(() => mockInstance),
      isAxiosError: actualAxios.isAxiosError,
    },
    create: jest.fn(() => mockInstance),
    isAxiosError: actualAxios.isAxiosError,
  };
});

import axios from 'axios';
import { validateEmployee } from '../employeeService';
import { apiClient } from '../apiClient';

// Get the mock instance that apiClient.create() returns
const mockAxiosInstance = (axios.create as jest.Mock).mock.results[0]?.value;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// validateEmployee
// ---------------------------------------------------------------------------

describe('validateEmployee', () => {
  it('returns employee on successful validation', async () => {
    const mockEmployee = {
      id: 'emp1',
      name: 'Test User',
      email: 'test@ruqaqa.sa',
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, employee: mockEmployee },
    });

    const result = await validateEmployee();
    expect(result).toEqual(mockEmployee);
    expect(apiClient.post).toHaveBeenCalledWith('/auth/validate', {});
  });

  it('returns null when backend returns success false', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: false },
    });

    const result = await validateEmployee();
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    const result = await validateEmployee();
    expect(result).toBeNull();
  });

});
