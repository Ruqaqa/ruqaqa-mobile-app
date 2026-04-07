/**
 * Tests for versionCheckService — URL normalization, localized string extraction,
 * version check integration (with mocked axios), and first launch tracking.
 */

// ---------------------------------------------------------------------------
// Mocks — must come before imports
// ---------------------------------------------------------------------------

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

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.2.1',
    extra: { releaseChannel: 'development' },
  },
}));

// Mock config
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'https://ruqaqa.sa',
  },
}));

// Mock axios
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      get: jest.fn(),
    },
    get: jest.fn(),
  };
});

import axios from 'axios';
import {
  normalizeDownloadUrl,
  stringOrNull,
  checkAppVersion,
} from '../versionCheckService';

const mockedAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

beforeEach(() => {
  jest.clearAllMocks();
  mockAsyncStore.clear();
});

// ---------------------------------------------------------------------------
// normalizeDownloadUrl
// ---------------------------------------------------------------------------

describe('normalizeDownloadUrl', () => {
  it('returns undefined for falsy input', () => {
    expect(normalizeDownloadUrl(null)).toBeUndefined();
    expect(normalizeDownloadUrl(undefined)).toBeUndefined();
    expect(normalizeDownloadUrl(0)).toBeUndefined();
    expect(normalizeDownloadUrl(false)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(normalizeDownloadUrl('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(normalizeDownloadUrl('   ')).toBeUndefined();
  });

  it('prepends https:// when protocol missing', () => {
    expect(normalizeDownloadUrl('ruqaqa.sa/download')).toBe(
      'https://ruqaqa.sa/download',
    );
  });

  it('preserves existing https://', () => {
    expect(normalizeDownloadUrl('https://ruqaqa.sa/download')).toBe(
      'https://ruqaqa.sa/download',
    );
  });

  it('preserves existing http://', () => {
    expect(normalizeDownloadUrl('http://ruqaqa.sa/download')).toBe(
      'http://ruqaqa.sa/download',
    );
  });

  it('trims whitespace', () => {
    expect(normalizeDownloadUrl('  https://ruqaqa.sa/download  ')).toBe(
      'https://ruqaqa.sa/download',
    );
  });


  it('accepts URLs on play.google.com domain', () => {
    expect(
      normalizeDownloadUrl(
        'https://play.google.com/store/apps/details?id=sa.ruqaqa.app',
      ),
    ).toBe('https://play.google.com/store/apps/details?id=sa.ruqaqa.app');
  });

  it('accepts URLs on apps.apple.com domain', () => {
    expect(
      normalizeDownloadUrl('https://apps.apple.com/app/ruqaqa/id123456'),
    ).toBe('https://apps.apple.com/app/ruqaqa/id123456');
  });

  it('rejects URLs on untrusted domains', () => {
    expect(normalizeDownloadUrl('https://evil.com/ruqaqa.apk')).toBeUndefined();
  });

  it('rejects subdomain spoofing (ruqaqa.sa.evil.com)', () => {
    expect(
      normalizeDownloadUrl('https://ruqaqa.sa.evil.com/app.apk'),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// stringOrNull
// ---------------------------------------------------------------------------

describe('stringOrNull', () => {
  it('returns null for falsy values', () => {
    expect(stringOrNull(null)).toBeNull();
    expect(stringOrNull(undefined)).toBeNull();
    expect(stringOrNull(0)).toBeNull();
    expect(stringOrNull('')).toBeNull();
    expect(stringOrNull(false)).toBeNull();
  });

  it('returns string values directly', () => {
    expect(stringOrNull('hello')).toBe('hello');
    expect(stringOrNull('maintenance in progress')).toBe(
      'maintenance in progress',
    );
  });

  it('extracts ar from localized object', () => {
    expect(stringOrNull({ ar: 'صيانة', en: 'Maintenance' })).toBe('صيانة');
  });

  it('falls back to en when ar missing', () => {
    expect(stringOrNull({ en: 'Maintenance' })).toBe('Maintenance');
  });

  it('falls back to first value when both ar and en missing', () => {
    expect(stringOrNull({ fr: 'Entretien' })).toBe('Entretien');
  });

  it('returns String() for numeric values', () => {
    expect(stringOrNull(42)).toBe('42');
    expect(stringOrNull(3.14)).toBe('3.14');
  });
});

// ---------------------------------------------------------------------------
// checkAppVersion — integration tests with mocked axios
// ---------------------------------------------------------------------------

describe('checkAppVersion', () => {
  it('returns null on network error', async () => {
    mockedAxiosGet.mockRejectedValue(new Error('Network Error'));

    const result = await checkAppVersion();
    expect(result).toBeNull();
  });

  it('returns normalized result with correct boolean fields', async () => {
    mockedAxiosGet.mockResolvedValue({
      data: {
        maintenanceMode: false,
        updateRequired: false,
        updateAvailable: true,
        downloadUrl: 'ruqaqa.sa/download',
        updateTitle: 'New Version',
        updateMessage: 'Please update',
      },
    });

    const result = await checkAppVersion();
    expect(result).not.toBeNull();
    expect(result!.maintenanceMode).toBe(false);
    expect(result!.updateRequired).toBe(false);
    expect(result!.updateAvailable).toBe(true);
    // downloadUrl should have been normalized with https://
    expect(result!.downloadUrl).toBe('https://ruqaqa.sa/download');
    expect(result!.updateTitle).toBe('New Version');
    expect(result!.updateMessage).toBe('Please update');
  });

  it('handles maintenance mode response', async () => {
    mockedAxiosGet.mockResolvedValue({
      data: {
        maintenanceMode: true,
        maintenanceMessage: { ar: 'النظام تحت الصيانة', en: 'Under maintenance' },
        updateRequired: false,
        updateAvailable: false,
      },
    });

    const result = await checkAppVersion();
    expect(result).not.toBeNull();
    expect(result!.maintenanceMode).toBe(true);
    expect(result!.maintenanceMessage).toBe('النظام تحت الصيانة');
  });

  it('handles forced update response', async () => {
    mockedAxiosGet.mockResolvedValue({
      data: {
        maintenanceMode: false,
        updateRequired: true,
        updateAvailable: true,
        downloadUrl: 'https://play.google.com/store/apps/ruqaqa',
        updateTitle: 'Critical Update',
      },
    });

    const result = await checkAppVersion();
    expect(result).not.toBeNull();
    expect(result!.updateRequired).toBe(true);
    expect(result!.updateAvailable).toBe(true);
    expect(result!.downloadUrl).toBe(
      'https://play.google.com/store/apps/ruqaqa',
    );
  });

  it('handles optional update response', async () => {
    mockedAxiosGet.mockResolvedValue({
      data: {
        maintenanceMode: false,
        updateRequired: false,
        updateAvailable: true,
        releaseNotes: 'Bug fixes and improvements',
      },
    });

    const result = await checkAppVersion();
    expect(result).not.toBeNull();
    expect(result!.updateRequired).toBe(false);
    expect(result!.updateAvailable).toBe(true);
    expect(result!.releaseNotes).toBe('Bug fixes and improvements');
  });

  it('coerces truthy/falsy values to booleans', async () => {
    mockedAxiosGet.mockResolvedValue({
      data: {
        maintenanceMode: 0,
        updateRequired: '',
        updateAvailable: 1,
      },
    });

    const result = await checkAppVersion();
    expect(result).not.toBeNull();
    expect(result!.maintenanceMode).toBe(false);
    expect(result!.updateRequired).toBe(false);
    expect(result!.updateAvailable).toBe(true);
  });
});

