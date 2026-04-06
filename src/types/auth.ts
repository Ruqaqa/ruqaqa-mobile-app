import { Employee } from './permissions';

/**
 * Result status for an SSO login attempt.
 */
export enum LoginStatus {
  Success = 'success',
  NetworkError = 'network_error',
  UnknownError = 'unknown_error',
}

export interface LoginResult {
  status: LoginStatus;
  /** Error message for display (i18n key). */
  message?: string;
}

/**
 * Login request for the AuthProvider (SSO only).
 */
export interface LoginRequest {
  idpHint?: 'microsoft';
}

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
 * Raw employee shape from the validate endpoint.
 * The backend sends firstName/lastName separately; employeeService combines them into `name`.
 */
export interface ValidateEmployeeResponse {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  professionalPictureUrl?: string;
  avatarUrl?: string;
}

/**
 * Employee validation response from POST /api/mobile/auth/validate.
 */
export interface ValidateResponse {
  success: boolean;
  employee?: ValidateEmployeeResponse;
}
