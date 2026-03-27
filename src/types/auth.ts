import { Employee } from './permissions';

/**
 * Result of a credential-based (username/password) login attempt.
 */
export enum CredentialLoginStatus {
  Success = 'success',
  InvalidCredentials = 'invalid_credentials',
  TotpRequired = 'totp_required',
  TotpInvalid = 'totp_invalid',
  AccountDisabled = 'account_disabled',
  AccountTemporarilyDisabled = 'account_temporarily_disabled',
  RequiredAction = 'required_action',
  NetworkError = 'network_error',
  UnknownError = 'unknown_error',
}

export interface CredentialLoginResult {
  status: CredentialLoginStatus;
  /** Error message for display (already i18n key or raw message). */
  message?: string;
}

/**
 * Login method selection for the AuthProvider.
 */
export type LoginRequest =
  | { method: 'sso'; idpHint?: 'microsoft' }
  | { method: 'credentials'; username: string; password: string; totp?: string };

/**
 * Keycloak token endpoint response.
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
}

/**
 * Version check result from the backend.
 */
export interface VersionCheckResult {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  updateRequired: boolean;
  updateAvailable: boolean;
  downloadUrl?: string;
  updateTitle?: string;
  updateMessage?: string;
  releaseNotes?: string;
}

/**
 * Employee validation response from POST /api/mobile/auth/validate.
 */
export interface ValidateResponse {
  success: boolean;
  employee?: Employee;
}

/**
 * Auth state exposed by the AuthProvider.
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  employee: Employee | null;
  logoutMessage: string | null;
}

/**
 * Result from the SSO browser flow.
 */
export interface SSOResult {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}
