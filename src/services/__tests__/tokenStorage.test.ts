/**
 * Tests for tokenStorage — chunked secure storage, JWT decode, expiry check.
 *
 * Mocks expo-secure-store with an in-memory Map.
 */

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

import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from '../tokenStorage';

beforeEach(async () => {
  mockStore.clear();
  jest.clearAllMocks();
  // Clear in-memory cache to prevent cross-test leakage
  await tokenStorage.clearAll();
});

// ---------------------------------------------------------------------------
// Helper: build a minimal JWT string with a given payload
// ---------------------------------------------------------------------------
function buildJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const sig = 'fake-signature';
  return `${header}.${body}.${sig}`;
}

// ---------------------------------------------------------------------------
// Save and retrieve — no chunking
// ---------------------------------------------------------------------------

describe('save and retrieve short token (no chunking)', () => {
  it('round-trips a short access token', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'short-refresh',
      expiresIn: 3600,
    });

    expect(await tokenStorage.getAccessToken()).toBe(jwt);
    expect(await tokenStorage.getRefreshToken()).toBe('short-refresh');
  });
});

// ---------------------------------------------------------------------------
// Save and retrieve — chunking
// ---------------------------------------------------------------------------

describe('save and retrieve long token (chunking)', () => {
  it('stores and reassembles a token longer than 1800 bytes', async () => {
    const longPayload = { sub: 'user1', data: 'x'.repeat(3000) };
    const jwt = buildJwt(longPayload);
    expect(jwt.length).toBeGreaterThan(1800);

    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'r'.repeat(2000), // also chunked
      expiresIn: 3600,
    });

    expect(await tokenStorage.getAccessToken()).toBe(jwt);
    expect(await tokenStorage.getRefreshToken()).toBe('r'.repeat(2000));
  });
});

// ---------------------------------------------------------------------------
// Exact chunk boundary
// ---------------------------------------------------------------------------

describe('token at exact chunk boundary', () => {
  it('handles a token of exactly 1800 bytes (no chunking needed)', async () => {
    const token = 'a'.repeat(1800);
    // Manually build a "JWT-like" access token with exactly 1800 chars
    // For this test we care about storage, not JWT validity
    await tokenStorage.saveTokens({
      accessToken: token,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    expect(await tokenStorage.getAccessToken()).toBe(token);
  });

  it('handles a token of exactly 1801 bytes (triggers chunking)', async () => {
    const token = 'b'.repeat(1801);
    await tokenStorage.saveTokens({
      accessToken: token,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    expect(await tokenStorage.getAccessToken()).toBe(token);
  });
});

// ---------------------------------------------------------------------------
// Replace chunked with short (cleanup)
// ---------------------------------------------------------------------------

describe('replace chunked token with short token', () => {
  it('cleans up old chunks when replacing with a short value', async () => {
    // First: save a long (chunked) token
    const longToken = 'x'.repeat(4000);
    await tokenStorage.saveTokens({
      accessToken: longToken,
      refreshToken: 'ref',
      expiresIn: 3600,
    });
    expect(await tokenStorage.getAccessToken()).toBe(longToken);

    // Verify chunks exist
    expect(mockStore.has('auth_access_token__chunks')).toBe(true);

    // Second: replace with a short token
    const shortToken = buildJwt({ sub: 'user2', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: shortToken,
      refreshToken: 'ref2',
      expiresIn: 3600,
    });

    expect(await tokenStorage.getAccessToken()).toBe(shortToken);
    // Old chunk metadata should be cleaned up
    expect(mockStore.has('auth_access_token__chunks')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTokenExpiringSoon
// ---------------------------------------------------------------------------

describe('isTokenExpiringSoon', () => {
  it('returns true when no expiry is stored', async () => {
    expect(await tokenStorage.isTokenExpiringSoon()).toBe(true);
  });

  it('returns true when token expires within 30s', async () => {
    const expiryMs = Date.now() + 20_000; // 20s from now
    mockStore.set('auth_token_expiry', String(expiryMs));
    expect(await tokenStorage.isTokenExpiringSoon()).toBe(true);
  });

  it('returns false when token is far from expiry', async () => {
    const expiryMs = Date.now() + 600_000; // 10 minutes from now
    mockStore.set('auth_token_expiry', String(expiryMs));
    expect(await tokenStorage.isTokenExpiringSoon()).toBe(false);
  });

  it('returns true when token is already expired', async () => {
    const expiryMs = Date.now() - 10_000; // 10s ago
    mockStore.set('auth_token_expiry', String(expiryMs));
    expect(await tokenStorage.isTokenExpiringSoon()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAccessTokenPayload
// ---------------------------------------------------------------------------

describe('getAccessTokenPayload', () => {
  it('decodes a valid JWT payload', async () => {
    const jwt = buildJwt({ sub: 'user1', name: 'Test', exp: 1234567890 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    const payload = await tokenStorage.getAccessTokenPayload();
    expect(payload).toEqual({ sub: 'user1', name: 'Test', exp: 1234567890 });
  });

  it('returns null for invalid JWT (not 3 parts)', async () => {
    mockStore.set('auth_access_token', 'not-a-jwt');
    const payload = await tokenStorage.getAccessTokenPayload();
    expect(payload).toBeNull();
  });

  it('returns null for corrupt base64', async () => {
    mockStore.set('auth_access_token', 'header.!!!invalid!!!.sig');
    const payload = await tokenStorage.getAccessTokenPayload();
    expect(payload).toBeNull();
  });

  it('decodes base64url characters (- and _)', async () => {
    // base64url uses - instead of + and _ instead of /
    const payload = { sub: 'user1', data: '>>>???' }; // chars that produce + and / in base64
    const base64 = btoa(JSON.stringify(payload));
    // Convert standard base64 to base64url
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const jwt = `header.${base64url}.sig`;

    mockStore.set('auth_access_token', jwt);
    const decoded = await tokenStorage.getAccessTokenPayload();
    expect(decoded).toEqual(payload);
  });

  it('handles base64 padding correctly', async () => {
    // Create a payload whose base64 encoding requires padding
    const payload = { a: 'b' };
    const base64 = btoa(JSON.stringify(payload));
    // Remove padding to simulate base64url without padding
    const noPadding = base64.replace(/=+$/, '');
    const jwt = `header.${noPadding}.sig`;

    mockStore.set('auth_access_token', jwt);
    const decoded = await tokenStorage.getAccessTokenPayload();
    expect(decoded).toEqual(payload);
  });

  it('returns null when no token is stored', async () => {
    const payload = await tokenStorage.getAccessTokenPayload();
    expect(payload).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe('clearAll', () => {
  it('removes all stored tokens and metadata', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'ref',
      idToken: 'id-token',
      expiresIn: 3600,
    });

    // Verify something was stored
    expect(mockStore.size).toBeGreaterThan(0);

    await tokenStorage.clearAll();

    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(await tokenStorage.getIdToken()).toBeNull();
    expect(await tokenStorage.getTokenExpiry()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// In-memory cache — survives secure store gaps during token rotation
// ---------------------------------------------------------------------------

describe('in-memory access token cache', () => {
  it('returns cached token when secure store returns null', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    // Simulate secure store returning null (gap during token rotation)
    mockStore.delete('auth_access_token');

    const result = await tokenStorage.getAccessToken();
    expect(result).toBe(jwt);
  });

  it('updates cache immediately on saveTokens', async () => {
    const jwt1 = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    const jwt2 = buildJwt({ sub: 'user2', exp: Math.floor(Date.now() / 1000) + 3600 });

    await tokenStorage.saveTokens({
      accessToken: jwt1,
      refreshToken: 'ref1',
      expiresIn: 3600,
    });

    // Save new tokens, then wipe store to test cache has new value
    await tokenStorage.saveTokens({
      accessToken: jwt2,
      refreshToken: 'ref2',
      expiresIn: 3600,
    });

    mockStore.delete('auth_access_token');
    const result = await tokenStorage.getAccessToken();
    expect(result).toBe(jwt2);
  });

  it('clears cache on clearAll so stale tokens are not returned', async () => {
    const jwt = buildJwt({ sub: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await tokenStorage.saveTokens({
      accessToken: jwt,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    await tokenStorage.clearAll();

    const result = await tokenStorage.getAccessToken();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chunk write order — chunks written before count (crash safety)
// ---------------------------------------------------------------------------

describe('chunked write order', () => {
  it('writes all chunks before writing the chunk count key', async () => {
    const writtenKeys: string[] = [];
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      (key: string, value: string) => {
        writtenKeys.push(key);
        mockStore.set(key, value);
        return Promise.resolve();
      },
    );

    const longToken = 'x'.repeat(4000); // triggers chunking
    await tokenStorage.saveTokens({
      accessToken: longToken,
      refreshToken: 'ref',
      expiresIn: 3600,
    });

    // Find the chunk count write for the access token
    const countKey = 'auth_access_token__chunks';
    const countIndex = writtenKeys.indexOf(countKey);
    expect(countIndex).toBeGreaterThan(-1);

    // All chunk writes for access token should come before the count write
    const chunkKeys = writtenKeys.filter(
      (k) => k.startsWith('auth_access_token_') && k !== countKey,
    );
    expect(chunkKeys.length).toBeGreaterThan(0);

    for (const ck of chunkKeys) {
      const chunkIndex = writtenKeys.indexOf(ck);
      expect(chunkIndex).toBeLessThan(countIndex);
    }
  });
});
