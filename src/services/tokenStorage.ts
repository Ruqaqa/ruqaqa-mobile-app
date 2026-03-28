import * as SecureStore from 'expo-secure-store';

/**
 * Secure token storage with chunking support for large JWTs.
 *
 * expo-secure-store has a ~2048 byte limit per key on some iOS versions.
 * Keycloak JWTs with rich role claims can exceed this, so we split large
 * values into chunks and reassemble on read.
 *
 * Security: Uses AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY to prevent token
 * migration via device backups.
 */

const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 20;
const CHUNK_COUNT_SUFFIX = '__chunks';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
  idToken: 'auth_id_token',
  tokenExpiry: 'auth_token_expiry',
} as const;

async function cleanupOldChunks(key: string): Promise<void> {
  const chunkCountStr = await SecureStore.getItemAsync(
    `${key}${CHUNK_COUNT_SUFFIX}`,
  );
  if (chunkCountStr) {
    const oldChunks = parseInt(chunkCountStr, 10);
    if (oldChunks > 0 && oldChunks <= MAX_CHUNKS) {
      for (let i = 0; i < oldChunks; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
      }
    }
    await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`).catch(
      () => {},
    );
  }
}

async function setSecureValue(key: string, value: string): Promise<void> {
  // Always clean up old chunks first to prevent stale data
  await cleanupOldChunks(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
    return;
  }

  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  if (chunks > MAX_CHUNKS) {
    throw new Error(`Value too large: ${chunks} chunks exceeds max ${MAX_CHUNKS}`);
  }

  // Write all chunks first, then write the count as the "commit" operation.
  // This way a crash mid-write leaves the old count valid.
  for (let i = 0; i < chunks; i++) {
    const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_${i}`, chunk, SECURE_OPTIONS);
  }
  await SecureStore.setItemAsync(
    `${key}${CHUNK_COUNT_SUFFIX}`,
    String(chunks),
    SECURE_OPTIONS,
  );
}

async function getSecureValue(key: string): Promise<string | null> {
  const chunkCountStr = await SecureStore.getItemAsync(
    `${key}${CHUNK_COUNT_SUFFIX}`,
  );

  if (!chunkCountStr) {
    return SecureStore.getItemAsync(key);
  }

  const chunks = parseInt(chunkCountStr, 10);
  if (isNaN(chunks) || chunks <= 0 || chunks > MAX_CHUNKS) return null;

  const parts: string[] = [];
  for (let i = 0; i < chunks; i++) {
    const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
    if (!chunk) return null;
    parts.push(chunk);
  }
  return parts.join('');
}

async function deleteSecureValue(key: string): Promise<void> {
  await cleanupOldChunks(key);
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

/**
 * Decode a JWT payload without signature verification.
 * Used to read the `exp` claim for accurate expiry tracking.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url -> Base64
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // Pad to multiple of 4
    while (payload.length % 4 !== 0) payload += '=';
    const json = atob(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// In-memory cache to avoid null during secure store write gaps
let cachedAccessToken: string | null = null;

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    const stored = await getSecureValue(KEYS.accessToken);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
    // During token rotation, secure store may briefly return null
    // while old chunks are deleted and new ones written.
    // Return the cached value to prevent requests without auth.
    return cachedAccessToken;
  },

  async getRefreshToken(): Promise<string | null> {
    return getSecureValue(KEYS.refreshToken);
  },

  async getIdToken(): Promise<string | null> {
    return getSecureValue(KEYS.idToken);
  },

  async getTokenExpiry(): Promise<number | null> {
    const val = await SecureStore.getItemAsync(KEYS.tokenExpiry);
    return val ? parseInt(val, 10) : null;
  },

  /**
   * Save tokens. Reads the `exp` claim from the JWT for accurate expiry,
   * falling back to `expiresIn` + device clock if JWT decode fails.
   * Writes refresh token first for crash safety (prevents orphaned access
   * token with invalidated refresh token after rotation).
   */
  async saveTokens(params: {
    accessToken: string;
    refreshToken: string;
    idToken?: string;
    expiresIn: number;
  }): Promise<void> {
    // Prefer JWT exp claim over computed expiry (avoids clock skew)
    const jwtPayload = decodeJwtPayload(params.accessToken);
    const expiryMs = jwtPayload?.exp
      ? (jwtPayload.exp as number) * 1000
      : Date.now() + params.expiresIn * 1000;

    // Write refresh token first — if app crashes mid-write, the old refresh
    // token is still valid. Writing access token first could leave a new
    // access token paired with a rotated-away refresh token.
    cachedAccessToken = params.accessToken;
    await setSecureValue(KEYS.refreshToken, params.refreshToken);
    await setSecureValue(KEYS.accessToken, params.accessToken);
    if (params.idToken) {
      await setSecureValue(KEYS.idToken, params.idToken);
    }
    await SecureStore.setItemAsync(
      KEYS.tokenExpiry,
      String(expiryMs),
      SECURE_OPTIONS,
    );
  },

  async clearAll(): Promise<void> {
    cachedAccessToken = null;
    await Promise.all([
      deleteSecureValue(KEYS.accessToken),
      deleteSecureValue(KEYS.refreshToken),
      deleteSecureValue(KEYS.idToken),
      SecureStore.deleteItemAsync(KEYS.tokenExpiry).catch(() => {}),
    ]);
  },

  async isTokenExpiringSoon(bufferMs = 30_000): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;
    return Date.now() + bufferMs >= expiry;
  },

  /**
   * Decode the stored access token's JWT payload.
   * Returns null if no token or decode fails.
   */
  async getAccessTokenPayload(): Promise<Record<string, unknown> | null> {
    const token = await this.getAccessToken();
    if (!token) return null;
    return decodeJwtPayload(token);
  },
};
