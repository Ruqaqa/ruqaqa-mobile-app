import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { UserPermissions, Employee } from '../types/permissions';
import {
  LoginRequest,
  LoginStatus,
  LoginResult,
} from '../types/auth';
import { tokenStorage } from './tokenStorage';
import { setSessionExpiredHandler } from './apiClient';
import { keycloakEndpoints, keycloakConfig } from './keycloakDiscovery';
import {
  exchangeCodeForTokens,
  logoutServer,
  postLoginValidation,
  refreshTokens,
} from './authService';
import { createDeduplicatedRefresh } from '../utils/deduplicatedRefresh';
import { initializeEmployeeCache, clearEmployeeCache } from './employeeCacheService';
import { initializeFinanceChannelCache, clearFinanceChannelCache } from './financeChannelService';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  employee: Employee | null;
  permissions: UserPermissions | null;
  logoutMessage: string | null;
  sessionExpired: boolean;
  login: (req: LoginRequest) => Promise<LoginResult>;
  logout: (message?: string) => Promise<void>;
  clearLogoutMessage: () => void;
  acknowledgeSessionExpired: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  employee: null,
  permissions: null,
  logoutMessage: null,
  sessionExpired: false,
  login: async () => ({ status: LoginStatus.UnknownError }),
  logout: async () => {},
  clearLogoutMessage: () => {},
  acknowledgeSessionExpired: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function usePermissions(): UserPermissions | null {
  const { permissions } = useAuth();
  return permissions;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Redirect URI for expo-auth-session (uses scheme from app.json + path for Keycloak compatibility)
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'ruqaqa',
  path: 'auth/callback',
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefreshRef = useRef<() => Promise<void>>(async () => {});

  // Shared deduplicated refresh — ensures the timer and foreground handler
  // cannot trigger concurrent refresh requests.
  const deduplicatedRefresh = useMemo(
    () => createDeduplicatedRefresh(refreshTokens),
    [],
  );

  // -----------------------------------------------------------------------
  // Cleanup helper
  // -----------------------------------------------------------------------
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Schedule proactive token refresh (60s before expiry as safety net)
  // -----------------------------------------------------------------------
  const scheduleRefresh = useCallback(async () => {
    clearRefreshTimer();
    const expiry = await tokenStorage.getTokenExpiry();
    if (!expiry) return;

    const msUntilRefresh = expiry - Date.now() - 60_000;
    if (msUntilRefresh <= 0) {
      // Already needs refresh
      const result = await deduplicatedRefresh();
      if (result.success) {
        scheduleRefresh();
      }
      return;
    }

    refreshTimerRef.current = setTimeout(async () => {
      const result = await deduplicatedRefresh();
      if (result.success) {
        scheduleRefresh();
      } else if (!result.isNetworkError) {
        // Auth rejected — session expired
        handleSessionExpired();
      }
    }, msUntilRefresh);
  }, [clearRefreshTimer, deduplicatedRefresh]);

  // Keep ref in sync so non-hook code (handleSSOLogin) always reads latest
  scheduleRefreshRef.current = scheduleRefresh;

  // -----------------------------------------------------------------------
  // Session expired handler
  // -----------------------------------------------------------------------
  const handleSessionExpired = useCallback(async () => {
    clearRefreshTimer();
    // Show the modal first — auth state cleared when user acknowledges
    setSessionExpired(true);
  }, [clearRefreshTimer]);

  const acknowledgeSessionExpired = useCallback(async () => {
    setSessionExpired(false);
    await tokenStorage.clearAll();
    WebBrowser.dismissBrowser();
    setEmployee(null);
    setPermissions(null);
    setIsAuthenticated(false);
    setLogoutMessage('sessionExpired');
  }, []);

  // -----------------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------------
  const handleSSOLogin = useCallback(
    async (idpHint?: string): Promise<LoginResult> => {
      try {
        if (__DEV__) console.log('[Auth] Redirect URI:', redirectUri);

        // Build the auth request with PKCE
        const request = new AuthSession.AuthRequest({
          clientId: keycloakConfig.clientId,
          redirectUri,
          scopes: [...keycloakConfig.scopes],
          usePKCE: true,
          extraParams: {
            ...(idpHint ? { kc_idp_hint: idpHint } : {}),
          },
        });

        // Open the system browser for Keycloak login
        const result = await request.promptAsync({
          authorizationEndpoint: keycloakEndpoints.authorization,
        });

        if (__DEV__) console.log('[Auth] SSO result:', result.type, JSON.stringify(result.type === 'success' ? { code: !!result.params?.code } : result));

        if (result.type !== 'success' || !result.params?.code) {
          return {
            status:
              result.type === 'cancel' || result.type === 'dismiss'
                ? LoginStatus.UnknownError
                : LoginStatus.NetworkError,
            message: result.type === 'cancel' || result.type === 'dismiss' ? undefined : 'loginFailed',
          };
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(
          result.params.code,
          request.codeVerifier!,
          redirectUri,
        );

        await tokenStorage.saveTokens({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          expiresIn: tokens.expires_in,
        });

        // Post-login validation
        const validation = await postLoginValidation();
        if (!validation.success) {
          return {
            status: LoginStatus.UnknownError,
            message:
              validation.error === 'no_mobile_signin'
                ? 'notAuthorized'
                : 'loginFailed',
          };
        }

        setEmployee(validation.employee);
        setPermissions(validation.permissions);
        setIsAuthenticated(true);
        scheduleRefreshRef.current();

        // Non-blocking cache warm-up
        initializeEmployeeCache().catch(() => {});
        initializeFinanceChannelCache().catch(() => {});

        return { status: LoginStatus.Success };
      } catch {
        return {
          status: LoginStatus.NetworkError,
          message: 'loginError',
        };
      }
    },
    [],
  );

  const login = useCallback(
    async (req: LoginRequest): Promise<LoginResult> => {
      setIsLoading(true);

      try {
        return await handleSSOLogin(req.idpHint);
      } finally {
        setIsLoading(false);
      }
    },
    [handleSSOLogin],
  );

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  const logout = useCallback(
    async (message?: string) => {
      clearRefreshTimer();
      await logoutServer();
      // Dismiss any open browser session
      WebBrowser.dismissBrowser();
      clearEmployeeCache();
      clearFinanceChannelCache();
      setEmployee(null);
      setPermissions(null);
      setIsAuthenticated(false);
      if (message) setLogoutMessage(message);
    },
    [clearRefreshTimer],
  );

  const clearLogoutMessage = useCallback(() => setLogoutMessage(null), []);

  // -----------------------------------------------------------------------
  // Initialization: try to restore session from stored tokens
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const token = await tokenStorage.getAccessToken();
        if (!token) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Check if token needs refresh
        const expiringSoon = await tokenStorage.isTokenExpiringSoon();
        if (expiringSoon) {
          const result = await refreshTokens();
          if (!result.success) {
            await tokenStorage.clearAll();
            if (!cancelled) setIsLoading(false);
            return;
          }
        }

        // Validate and set up session
        const validation = await postLoginValidation();
        if (!cancelled) {
          if (validation.success) {
            setEmployee(validation.employee);
            setPermissions(validation.permissions);
            setIsAuthenticated(true);
            scheduleRefresh();
            // Non-blocking cache warm-up on session restore
            initializeEmployeeCache().catch(() => {});
            initializeFinanceChannelCache().catch(() => {});
          } else {
            await tokenStorage.clearAll();
          }
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          await tokenStorage.clearAll();
          setIsLoading(false);
        }
      }
    }

    // Register session expired handler with apiClient
    setSessionExpiredHandler(() => handleSessionExpired());

    init();

    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Foreground refresh: when app returns from background, check token
  // -----------------------------------------------------------------------
  useEffect(() => {
    function handleAppState(state: AppStateStatus) {
      if (state === 'active' && isAuthenticated) {
        tokenStorage.isTokenExpiringSoon().then((expiring) => {
          if (expiring) {
            deduplicatedRefresh().then((result) => {
              if (result.success) {
                scheduleRefresh();
              } else if (!result.isNetworkError) {
                handleSessionExpired();
              }
            });
          }
        });
      }
    }

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isAuthenticated, scheduleRefresh, handleSessionExpired, deduplicatedRefresh]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------
  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      employee,
      permissions,
      logoutMessage,
      sessionExpired,
      login,
      logout,
      clearLogoutMessage,
      acknowledgeSessionExpired,
    }),
    [
      isAuthenticated,
      isLoading,
      employee,
      permissions,
      logoutMessage,
      sessionExpired,
      login,
      logout,
      clearLogoutMessage,
      acknowledgeSessionExpired,
    ],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}
