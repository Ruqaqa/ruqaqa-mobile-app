import axios from 'axios';
import { TokenResponse } from '../types/auth';
import { Employee, UserPermissions } from '../types/permissions';
import { keycloakEndpoints, keycloakConfig } from './keycloakDiscovery';
import { tokenStorage } from './tokenStorage';
import { extractPermissions } from './permissionService';
import { withRetry, isRetryableError } from '../utils/retry';
// Lazy-imported to break require cycle: apiClient → authService → employeeService → apiClient
let _validateEmployee: typeof import('./employeeService').validateEmployee;
function getValidateEmployee() {
  if (!_validateEmployee) {
    _validateEmployee = require('./employeeService').validateEmployee;
  }
  return _validateEmployee;
}

// ---------------------------------------------------------------------------
// Token exchange — Authorization Code Grant
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await withRetry(
    () =>
      axios.post<TokenResponse>(
        keycloakEndpoints.token,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: keycloakConfig.clientId,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    { maxAttempts: 3, baseDelayMs: 1000, shouldRetry: isRetryableError },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Mobile signin role check
// ---------------------------------------------------------------------------

/**
 * Check that the JWT payload contains the `mobile_signin` role.
 * Checks both realm-level and client-level roles.
 */
export function hasMobileSigninRole(
  jwtPayload: Record<string, unknown>,
): boolean {
  const realmRoles =
    (jwtPayload?.realm_access as { roles?: string[] })?.roles ?? [];
  const clientRoles =
    (jwtPayload?.resource_access as Record<string, { roles?: string[] }>)?.[
      keycloakConfig.clientId
    ]?.roles ?? [];

  return (
    realmRoles.includes('mobile_signin') ||
    clientRoles.includes('mobile_signin')
  );
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Refresh the access token. Returns true on success.
 * Distinguishes network errors from auth rejection.
 */
export async function refreshTokens(): Promise<{
  success: boolean;
  isNetworkError: boolean;
}> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) return { success: false, isNetworkError: false };

  try {
    const res = await axios.post<TokenResponse>(
      keycloakEndpoints.token,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: keycloakConfig.clientId,
        refresh_token: refreshToken,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    await tokenStorage.saveTokens({
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      idToken: res.data.id_token,
      expiresIn: res.data.expires_in,
    });

    return { success: true, isNetworkError: false };
  } catch (err) {
    const isNetwork = axios.isAxiosError(err) && !err.response;
    return { success: false, isNetworkError: isNetwork };
  }
}

// ---------------------------------------------------------------------------
// Server-side logout
// ---------------------------------------------------------------------------

/**
 * Revoke the session on Keycloak and clear all local tokens.
 * Awaits the revocation and retries once on failure.
 * Local tokens are always cleared regardless of server result.
 */
export async function logoutServer(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();

  if (refreshToken) {
    const revokeOnce = () =>
      axios.post(
        keycloakEndpoints.endSession,
        new URLSearchParams({
          client_id: keycloakConfig.clientId,
          refresh_token: refreshToken,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

    try {
      await revokeOnce();
    } catch {
      // Retry once
      try {
        await revokeOnce();
      } catch {
        // Revocation definitively failed — log warning but don't block logout
        console.warn('Server token revocation failed after retry');
      }
    }
  }

  await tokenStorage.clearAll();
}

// ---------------------------------------------------------------------------
// Post-login flow: validate tokens, check role, fetch employee
// ---------------------------------------------------------------------------

export interface PostLoginResult {
  success: boolean;
  employee: Employee | null;
  permissions: UserPermissions | null;
  error?: 'no_mobile_signin' | 'validation_failed' | 'no_token';
}

/**
 * After tokens are saved, run the post-login validation:
 * 1. Decode JWT and check mobile_signin role
 * 2. Extract permissions
 * 3. Validate employee against backend
 */
export async function postLoginValidation(): Promise<PostLoginResult> {
  const payload = await tokenStorage.getAccessTokenPayload();
  if (!payload) {
    return { success: false, employee: null, permissions: null, error: 'no_token' };
  }

  if (!hasMobileSigninRole(payload)) {
    await tokenStorage.clearAll();
    return {
      success: false,
      employee: null,
      permissions: null,
      error: 'no_mobile_signin',
    };
  }

  const permissions = extractPermissions(payload as Record<string, any>);

  const employee = await getValidateEmployee()();

  if (!employee) {
    await tokenStorage.clearAll();
    return {
      success: false,
      employee: null,
      permissions,
      error: 'validation_failed',
    };
  }

  return { success: true, employee, permissions };
}
