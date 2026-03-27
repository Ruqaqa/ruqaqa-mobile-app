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
  CredentialLoginStatus,
  CredentialLoginResult,
} from '../types/auth';
import { tokenStorage } from './tokenStorage';
import { setSessionExpiredHandler } from './apiClient';
import { keycloakEndpoints, keycloakConfig } from './keycloakDiscovery';
import {
  exchangeCodeForTokens,
  loginWithCredentials,
  logoutServer,
  postLoginValidation,
  refreshTokens,
} from './authService';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  employee: Employee | null;
  permissions: UserPermissions | null;
  logoutMessage: string | null;
  login: (req: LoginRequest) => Promise<CredentialLoginResult>;
  logout: (message?: string) => Promise<void>;
  clearLogoutMessage: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  employee: null,
  permissions: null,
  logoutMessage: null,
  login: async () => ({ status: CredentialLoginStatus.UnknownError }),
  logout: async () => {},
  clearLogoutMessage: () => {},
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

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const result = await refreshTokens();
      if (result.success) {
        scheduleRefresh();
      }
      return;
    }

    refreshTimerRef.current = setTimeout(async () => {
      const result = await refreshTokens();
      if (result.success) {
        scheduleRefresh();
      } else if (!result.isNetworkError) {
        // Auth rejected — session expired
        handleSessionExpired();
      }
    }, msUntilRefresh);
  }, [clearRefreshTimer]);

  // -----------------------------------------------------------------------
  // Session expired handler
  // -----------------------------------------------------------------------
  const handleSessionExpired = useCallback(async () => {
    clearRefreshTimer();
    await tokenStorage.clearAll();
    setEmployee(null);
    setPermissions(null);
    setIsAuthenticated(false);
    setLogoutMessage('sessionExpired');
  }, [clearRefreshTimer]);

  // -----------------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------------
  const login = useCallback(
    async (req: LoginRequest): Promise<CredentialLoginResult> => {
      setIsLoading(true);

      try {
        if (req.method === 'sso') {
          return await handleSSOLogin(req.idpHint);
        } else {
          return await handleCredentialLogin(
            req.username,
            req.password,
            req.totp,
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleSSOLogin = async (
    idpHint?: string,
  ): Promise<CredentialLoginResult> => {
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
              ? CredentialLoginStatus.UnknownError
              : CredentialLoginStatus.NetworkError,
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
          status: CredentialLoginStatus.UnknownError,
          message:
            validation.error === 'no_mobile_signin'
              ? 'notAuthorized'
              : 'loginFailed',
        };
      }

      setEmployee(validation.employee);
      setPermissions(validation.permissions);
      setIsAuthenticated(true);
      scheduleRefresh();

      return { status: CredentialLoginStatus.Success };
    } catch {
      return {
        status: CredentialLoginStatus.NetworkError,
        message: 'loginError',
      };
    }
  };

  const handleCredentialLogin = async (
    username: string,
    password: string,
    totp?: string,
  ): Promise<CredentialLoginResult> => {
    const result = await loginWithCredentials(username, password, totp);

    if (result.status !== CredentialLoginStatus.Success || !result.tokens) {
      return { status: result.status };
    }

    await tokenStorage.saveTokens({
      accessToken: result.tokens.access_token,
      refreshToken: result.tokens.refresh_token,
      idToken: result.tokens.id_token,
      expiresIn: result.tokens.expires_in,
    });

    const validation = await postLoginValidation();
    if (!validation.success) {
      return {
        status: CredentialLoginStatus.UnknownError,
        message:
          validation.error === 'no_mobile_signin'
            ? 'notAuthorized'
            : 'loginFailed',
      };
    }

    setEmployee(validation.employee);
    setPermissions(validation.permissions);
    setIsAuthenticated(true);
    scheduleRefresh();

    return { status: CredentialLoginStatus.Success };
  };

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  const logout = useCallback(
    async (message?: string) => {
      clearRefreshTimer();
      await logoutServer();
      // Dismiss any open browser session
      WebBrowser.dismissBrowser();
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
            refreshTokens().then((result) => {
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
  }, [isAuthenticated, scheduleRefresh, handleSessionExpired]);

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
      login,
      logout,
      clearLogoutMessage,
    }),
    [
      isAuthenticated,
      isLoading,
      employee,
      permissions,
      logoutMessage,
      login,
      logout,
      clearLogoutMessage,
    ],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}
