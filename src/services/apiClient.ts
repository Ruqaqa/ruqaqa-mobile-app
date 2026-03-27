import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { config } from './config';
import { tokenStorage } from './tokenStorage';
import { refreshTokens } from './authService';

let refreshPromise: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

/**
 * Register a callback invoked when token refresh fails due to auth rejection
 * (not network errors). Typically triggers logout + redirect to login screen.
 */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns true if successful, false otherwise.
 * De-duplicated: concurrent calls share a single refresh request.
 * Only signals session expiration on auth rejection, NOT network errors.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const result = await refreshTokens();
      if (result.success) return true;

      // Only signal session expired on auth rejection, not network errors.
      // On network errors, let the original request fail naturally.
      if (!result.isNetworkError) {
        onSessionExpired?.();
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Attach the Bearer token and proactively refresh if expiring soon.
 */
async function requestInterceptor(
  cfg: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  // Proactive refresh: if token expires within 30s, refresh before request
  const expiringSoon = await tokenStorage.isTokenExpiringSoon();
  if (expiringSoon) {
    await refreshAccessToken();
  }

  const token = await tokenStorage.getAccessToken();
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
}

/**
 * On 401, attempt one token refresh and retry the original request.
 */
async function responseErrorInterceptor(
  error: AxiosError,
): Promise<unknown> {
  const original = error.config;
  if (
    error.response?.status === 401 &&
    original &&
    !(original as any).__retried
  ) {
    (original as any).__retried = true;
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
      }
      return apiClient(original);
    }
    // Session expiration already signaled inside refreshAccessToken
  }
  return Promise.reject(error);
}

/**
 * Pre-configured Axios instance that:
 * - Auto-attaches Bearer token
 * - Proactively refreshes before expiry (30s buffer)
 * - Handles 401 → refresh → retry once
 * - Calls sessionExpiredHandler when refresh fails
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${config.apiBaseUrl}/api/mobile`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(requestInterceptor);
apiClient.interceptors.response.use(
  (response) => response,
  responseErrorInterceptor,
);

/**
 * Upload files via multipart/form-data.
 * Handles Bearer token and 401 refresh like regular requests.
 */
export async function uploadMultipart(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
) {
  return apiClient.post(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (e) => {
          const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
          onProgress(percent);
        }
      : undefined,
  });
}
