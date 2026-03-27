import { config } from './config';

/**
 * Keycloak OIDC endpoint discovery.
 * Constructs all necessary endpoints from the Keycloak base URL and realm.
 */

const realmUrl = `${config.keycloakUrl}/realms/${config.keycloakRealm}`;
const oidcBase = `${realmUrl}/protocol/openid-connect`;

export const keycloakEndpoints = {
  authorization: `${oidcBase}/auth`,
  token: `${oidcBase}/token`,
  endSession: `${oidcBase}/logout`,
  userinfo: `${oidcBase}/userinfo`,
} as const;

export const keycloakConfig = {
  clientId: config.keycloakClientId,
  scopes: ['openid', 'profile', 'email'],
} as const;
