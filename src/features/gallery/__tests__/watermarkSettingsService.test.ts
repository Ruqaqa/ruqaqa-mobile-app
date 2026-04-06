import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { DEFAULT_WATERMARK_DRAFT } from '../types';

// --- Mocks ---

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

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
  },
}));

// Import after mocks
import { apiClient } from '@/services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchWatermarkDefaults,
  saveLastUsedSettings,
  getLastUsedSettings,
  invalidateCache,
} from '../services/watermarkSettingsService';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
  jest.clearAllMocks();
  Object.keys(store).forEach((k) => delete store[k]);
  // Reset in-memory cache between tests
  invalidateCache();
});

afterEach(() => {
  mock.restore();
});

// --- Helpers ---

const API_RESPONSE = {
  x: 30,
  y: 70,
  width: 25,
  opacity: 80,
};

// --- Tests ---

describe('fetchWatermarkDefaults', () => {
  it('returns settings from API on success', async () => {
    mock.onGet(/watermark-settings/).reply(200, API_RESPONSE);

    const result = await fetchWatermarkDefaults();

    expect(result.xPct).toBe(30);
    expect(result.yPct).toBe(70);
    expect(result.widthPct).toBe(25);
    expect(result.opacityPct).toBe(80);
  });

  it('persists settings to AsyncStorage on successful fetch', async () => {
    mock.onGet(/watermark-settings/).reply(200, API_RESPONSE);

    await fetchWatermarkDefaults();

    // Give fire-and-forget time to run
    await new Promise((r) => setTimeout(r, 10));

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('returns AsyncStorage settings when API fails', async () => {
    // Pre-populate storage (uses the persisted field names: x, y, width, opacity)
    store['gallery_watermark_settings'] = JSON.stringify(API_RESPONSE);
    mock.onGet(/watermark-settings/).reply(500);

    const result = await fetchWatermarkDefaults();

    expect(result.xPct).toBe(30);
    expect(result.yPct).toBe(70);
  });

  it('returns defaults when both API and storage fail', async () => {
    mock.onGet(/watermark-settings/).reply(500);

    const result = await fetchWatermarkDefaults();

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    expect(result.yPct).toBe(DEFAULT_WATERMARK_DRAFT.yPct);
    expect(result.widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
    expect(result.opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
  });

  it('returns defaults when API times out and storage is empty', async () => {
    mock.onGet(/watermark-settings/).timeout();

    const result = await fetchWatermarkDefaults();

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
  });

  it('clamps API values to valid ranges', async () => {
    mock.onGet(/watermark-settings/).reply(200, {
      x: -10,
      y: 200,
      width: 1,   // below min of 5
      opacity: 5, // below min of 10
    });

    const result = await fetchWatermarkDefaults();

    expect(result.xPct).toBe(0);
    expect(result.yPct).toBe(100);
    expect(result.widthPct).toBe(5);
    expect(result.opacityPct).toBe(10);
  });

  it('uses in-memory cache on second call within TTL', async () => {
    mock.onGet(/watermark-settings/).reply(200, API_RESPONSE);

    await fetchWatermarkDefaults();
    const result = await fetchWatermarkDefaults();

    // API should only be called once (cached on second call)
    expect(mock.history.get).toHaveLength(1);
    expect(result.xPct).toBe(30);
  });

  it('re-fetches from API after cache invalidation', async () => {
    mock.onGet(/watermark-settings/).reply(200, API_RESPONSE);

    await fetchWatermarkDefaults();
    invalidateCache();

    mock.onGet(/watermark-settings/).reply(200, { x: 50, y: 50, width: 30, opacity: 90 });
    const result = await fetchWatermarkDefaults();

    expect(result.xPct).toBe(50);
  });
});

describe('saveLastUsedSettings', () => {
  it('saves clamped settings to AsyncStorage', async () => {
    await saveLastUsedSettings({
      xPct: 45,
      yPct: 55,
      widthPct: 30,
      opacityPct: 70,
      noWatermarkNeeded: false,
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'gallery_watermark_settings',
      expect.any(String),
    );

    const savedData = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
    );
    expect(savedData.x).toBe(45);
    expect(savedData.y).toBe(55);
    expect(savedData.width).toBe(30);
    expect(savedData.opacity).toBe(70);
  });

  it('clamps values before saving', async () => {
    await saveLastUsedSettings({
      xPct: -10,
      yPct: 200,
      widthPct: 100,
      opacityPct: 0,
      noWatermarkNeeded: false,
    });

    const savedData = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
    );
    expect(savedData.x).toBe(0);
    expect(savedData.y).toBe(100);
    expect(savedData.width).toBe(80);
    expect(savedData.opacity).toBe(10);
  });
});

describe('getLastUsedSettings', () => {
  it('returns stored settings', async () => {
    store['gallery_watermark_settings'] = JSON.stringify(API_RESPONSE);

    const result = await getLastUsedSettings();

    expect(result).not.toBeNull();
    expect(result!.xPct).toBe(30);
    expect(result!.yPct).toBe(70);
  });

  it('returns null when no storage exists', async () => {
    const result = await getLastUsedSettings();

    expect(result).toBeNull();
  });

  it('returns null when storage contains invalid JSON', async () => {
    store['gallery_watermark_settings'] = 'not-json{{{';

    const result = await getLastUsedSettings();

    expect(result).toBeNull();
  });
});
