import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

// Mock AsyncStorage with an in-memory store
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys: string[]) => {
      keys.forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
  },
}));

// Import after mocks
import {
  getEmployees,
  clearEmployeeCache,
} from '../employeeCacheService';

let mock: MockAdapter;

// We need to clear module-level memoryCache between tests.
// Since memoryCache is module-level, we reset by calling clearEmployeeCache.
beforeEach(async () => {
  mock = new MockAdapter(apiClient as any);
  jest.clearAllMocks();
  // Clear both storage and memory cache
  Object.keys(store).forEach((k) => delete store[k]);
  await clearEmployeeCache();
});

afterEach(() => {
  mock.restore();
});

const mockEmployees = [
  { id: 'emp-1', name: 'Ahmed Ali', email: 'ahmed@ruqaqa.sa' },
  { id: 'emp-2', name: 'Sara Hassan', email: 'sara@ruqaqa.sa' },
];

describe('employeeCacheService', () => {
  describe('getEmployees', () => {
    it('fetches fresh data when no cache exists', async () => {
      mock.onGet('/employees').reply(200, {
        success: true,
        employees: mockEmployees,
      });

      const result = await getEmployees();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('emp-1');
      expect(mock.history.get).toHaveLength(1);
    });

    it('returns cached data immediately on subsequent calls', async () => {
      mock.onGet('/employees').reply(200, {
        success: true,
        employees: mockEmployees,
      });

      // First call: populate cache
      await getEmployees();

      // Second call: should use memory cache, not API
      mock.resetHistory();
      const result = await getEmployees();

      expect(result).toHaveLength(2);
      expect(mock.history.get).toHaveLength(0);
    });

    it('triggers background refresh when cache exists but is expired', async () => {
      // Populate cache via API
      mock.onGet('/employees').replyOnce(200, {
        success: true,
        employees: mockEmployees,
      });
      await getEmployees();

      // Simulate expired cache by setting timestamp to 25 hours ago
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      store['cached_employees_timestamp'] = String(expiredTimestamp);

      // Clear memory cache to force reading from storage
      await clearEmployeeCache();
      // Re-populate storage (clearEmployeeCache removes it)
      store['cached_employees'] = JSON.stringify(mockEmployees);
      store['cached_employees_timestamp'] = String(expiredTimestamp);

      // Set up fresh data for background refresh
      const updatedEmployees = [
        ...mockEmployees,
        { id: 'emp-3', name: 'New Employee', email: 'new@ruqaqa.sa' },
      ];
      mock.onGet('/employees').reply(200, {
        success: true,
        employees: updatedEmployees,
      });

      // Should return cached data immediately
      const result = await getEmployees();
      expect(result).toHaveLength(2);

      // Wait for background refresh to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Now memory cache should be updated
      const refreshed = await getEmployees();
      expect(refreshed).toHaveLength(3);
    });

    it('falls back to storage cache on network failure when no memory cache', async () => {
      // Manually populate storage with data
      store['cached_employees'] = JSON.stringify(mockEmployees);
      store['cached_employees_timestamp'] = String(Date.now());

      // Network fails
      mock.onGet('/employees').networkError();

      const result = await getEmployees();

      // Should return the stored data
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('emp-1');
    });

    it('returns empty array when no cache and network fails', async () => {
      mock.onGet('/employees').networkError();

      const result = await getEmployees();
      expect(result).toEqual([]);
    });
  });

  describe('clearEmployeeCache', () => {
    it('clears memory cache and storage so next call hits API', async () => {
      // Populate cache
      mock.onGet('/employees').reply(200, {
        success: true,
        employees: mockEmployees,
      });
      await getEmployees();

      // Clear
      await clearEmployeeCache();

      // Next call should hit API again
      mock.resetHistory();
      mock.onGet('/employees').reply(200, {
        success: true,
        employees: [],
      });

      await getEmployees();
      expect(mock.history.get).toHaveLength(1);
    });
  });
});
