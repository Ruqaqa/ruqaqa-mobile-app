import AsyncStorage from '@react-native-async-storage/async-storage';
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
  getFinanceChannels,
  clearFinanceChannelCache,
} from '../financeChannelService';

let mock: MockAdapter;

const mockChannels = [
  { id: 'ch-1', name: 'Bank Transfer' },
  { id: 'ch-2', name: 'Cash' },
];

beforeEach(async () => {
  mock = new MockAdapter(apiClient as any);
  jest.clearAllMocks();
  Object.keys(store).forEach((k) => delete store[k]);
  clearFinanceChannelCache();
});

afterEach(() => {
  mock.restore();
});

describe('financeChannelService', () => {
  describe('getFinanceChannels', () => {
    it('fetches fresh data when no cache exists', async () => {
      mock.onGet('/finance-channels').reply(200, mockChannels);

      const result = await getFinanceChannels();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ch-1');
      expect(mock.history.get).toHaveLength(1);
    });

    it('returns memory cache on subsequent calls without hitting API', async () => {
      mock.onGet('/finance-channels').reply(200, mockChannels);

      await getFinanceChannels();

      mock.resetHistory();
      const result = await getFinanceChannels();

      expect(result).toHaveLength(2);
      expect(mock.history.get).toHaveLength(0);
    });

    it('returns disk cache when memory cache is empty but disk has data', async () => {
      // Pre-populate disk cache with fresh timestamp
      store['cached_finance_channels'] = JSON.stringify(mockChannels);
      store['cached_finance_channels_timestamp'] = String(Date.now());

      mock.onGet('/finance-channels').networkError();

      const result = await getFinanceChannels();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Bank Transfer');
      // Should not have needed the API since disk cache is fresh
      expect(mock.history.get).toHaveLength(0);
    });

    it('triggers background refresh when disk cache is stale', async () => {
      // Pre-populate with stale timestamp (25 hours ago)
      store['cached_finance_channels'] = JSON.stringify(mockChannels);
      store['cached_finance_channels_timestamp'] = String(
        Date.now() - 25 * 60 * 60 * 1000,
      );

      const updatedChannels = [...mockChannels, { id: 'ch-3', name: 'Credit Card' }];
      mock.onGet('/finance-channels').reply(200, updatedChannels);

      // Should return stale data immediately
      const result = await getFinanceChannels();
      expect(result).toHaveLength(2);

      // Wait for background refresh
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Memory cache should now be updated
      const refreshed = await getFinanceChannels();
      expect(refreshed).toHaveLength(3);
    });

    it('returns empty array when no cache and network fails', async () => {
      mock.onGet('/finance-channels').networkError();

      const result = await getFinanceChannels();
      expect(result).toEqual([]);
    });

    it('persists fetched data to AsyncStorage', async () => {
      mock.onGet('/finance-channels').reply(200, mockChannels);

      await getFinanceChannels();

      expect(store['cached_finance_channels']).toBe(JSON.stringify(mockChannels));
      expect(store['cached_finance_channels_timestamp']).toBeDefined();
    });
  });

  describe('clearFinanceChannelCache', () => {
    it('clears memory and storage so next call hits API', async () => {
      mock.onGet('/finance-channels').reply(200, mockChannels);
      await getFinanceChannels();

      clearFinanceChannelCache();

      mock.resetHistory();
      mock.onGet('/finance-channels').reply(200, []);

      await getFinanceChannels();
      expect(mock.history.get).toHaveLength(1);
    });
  });
});
