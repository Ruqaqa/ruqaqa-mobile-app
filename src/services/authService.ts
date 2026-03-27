import axios, { AxiosError } from 'axios';
import {
  CredentialLoginStatus,
  CredentialLoginResult,
  TokenResponse,
  ValidateResponse,
} from '../types/auth';
import { Employee, UserPermissions } from '../types/permissions';
import { keycloakEndpoints, keycloakConfig } from './keycloakDiscovery';
import { tokenStorage } from './tokenStorage';
import { extractPermissions } from './permissionService';
import { config } from './config';

// ---------------------------------------------------------------------------
// Retry utility
// ---------------------------------------------------------------------------

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === opts.maxAttempts || !opts.shouldRetry(err)) throw err;
      const delay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

function isRetryableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const e = err as AxiosError;
  // Retry on network errors and 5xx
  if (!e.response) return true;
  return e.response.status >= 500;
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
// Token exchange — Password Grant (Direct Login)
// ---------------------------------------------------------------------------

export async function loginWithCredentials(
  username: string,
  password: string,
  totp?: string,
): Promise<{ status: CredentialLoginStatus; tokens?: TokenResponse }> {
  const params: Record<string, string> = {
    grant_type: 'password',
    client_id: keycloakConfig.clientId,
    username,
    password,
    scope: keycloakConfig.scopes.join(' '),
  };
  if (totp) params.totp = totp;

  try {
    const res = await axios.post<TokenResponse>(
      keycloakEndpoints.token,
      new URLSearchParams(params).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    return { status: CredentialLoginStatus.Success, tokens: res.data };
  } catch (err) {
    return { status: classifyPasswordGrantError(err) };
  }
}

/**
 * Classify Keycloak password grant errors.
 * Preserves the exact error patterns from the Flutter implementation.
 */
function classifyPasswordGrantError(err: unknown): CredentialLoginStatus {
  if (!axios.isAxiosError(err) || !err.response?.data) {
    return isRetryableError(err)
      ? CredentialLoginStatus.NetworkError
      : CredentialLoginStatus.UnknownError;
  }

  const data = err.response.data as { error?: string; error_description?: string };
  const desc = (data.error_description ?? '').toLowerCase();

  // TOTP/OTP checks
  if (desc.includes('otp') || desc.includes('totp')) {
    if (desc.includes('invalid')) return CredentialLoginStatus.TotpInvalid;
    return CredentialLoginStatus.TotpRequired;
  }

  // Account disabled
  if (desc.includes('account disabled') || desc.includes('user disabled')) {
    return CredentialLoginStatus.AccountDisabled;
  }

  // Temporary lockout
  if (desc.includes('temporarily disabled') || desc.includes('too many failed')) {
    return CredentialLoginStatus.AccountTemporarilyDisabled;
  }

  // Required action (MFA setup, etc.)
  if (
    desc.includes('required action') ||
    desc.includes('action required') ||
    desc.includes('configure totp') ||
    desc.includes('configure otp') ||
    desc.includes('set up totp') ||
    desc.includes('setup totp') ||
    desc.includes('two-factor') ||
    desc.includes('not fully set up')
  ) {
    return CredentialLoginStatus.RequiredAction;
  }

  // Invalid credentials
  if (desc.includes('invalid user credentials') || data.error === 'invalid_grant') {
    return CredentialLoginStatus.InvalidCredentials;
  }

  return CredentialLoginStatus.UnknownError;
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
// Employee validation
// ---------------------------------------------------------------------------

export async function validateEmployee(
  accessToken: string,
): Promise<Employee | null> {
  try {
    const res = await withRetry(
      () =>
        axios.post<ValidateResponse>(
          `${config.apiBaseUrl}/api/mobile/auth/validate`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10_000,
          },
        ),
      { maxAttempts: 2, baseDelayMs: 1000, shouldRetry: isRetryableError },
    );

    if (res.data.success && res.data.employee) {
      return res.data.employee;
    }
    return null;
  } catch {
    return null;
  }
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
// Permissions extraction
// ---------------------------------------------------------------------------

export async function getPermissionsFromToken(): Promise<UserPermissions | null> {
  const payload = await tokenStorage.getAccessTokenPayload();
  if (!payload) return null;
  return extractPermissions(payload as Record<string, any>);
}

// ---------------------------------------------------------------------------
// Server-side logout
// ---------------------------------------------------------------------------

/**
 * Revoke the session on Keycloak and clear all local tokens.
 */
export async function logoutServer(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();

  // Best-effort server revocation (non-blocking)
  if (refreshToken) {
    axios
      .post(
        keycloakEndpoints.endSession,
        new URLSearchParams({
          client_id: keycloakConfig.clientId,
          refresh_token: refreshToken,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      .catch(() => {
        // Server logout failed — local cleanup still proceeds
      });
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

  const accessToken = await tokenStorage.getAccessToken();
  const employee = accessToken ? await validateEmployee(accessToken) : null;

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
