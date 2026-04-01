import { useState, useEffect, useRef } from 'react';
import { tokenStorage } from '@/services/tokenStorage';

const REFRESH_INTERVAL_MS = 30_000;

type AuthHeaders = { Authorization: string } | undefined;

/**
 * Provides auto-refreshing auth headers for Image components and other
 * consumers that need Bearer tokens outside the Axios interceptor.
 *
 * Reads the token on mount and refreshes every 30 seconds to keep it fresh.
 * Returns `{ Authorization: 'Bearer ...' }` or `undefined` if no token.
 */
export function useAuthHeaders(): AuthHeaders {
  const [headers, setHeaders] = useState<AuthHeaders>(undefined);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const loadToken = async () => {
      const token = await tokenStorage.getAccessToken();
      if (!isMountedRef.current) return;
      if (token) {
        setHeaders({ Authorization: `Bearer ${token}` });
      } else {
        setHeaders(undefined);
      }
    };

    loadToken();

    const intervalId = setInterval(loadToken, REFRESH_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, []);

  return headers;
}
