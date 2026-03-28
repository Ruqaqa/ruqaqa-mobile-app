/**
 * Tests for the partner permission key in permissionService.
 *
 * The canSelectPartner permission was changed from the old role name to
 * 'mobile_select_partner_in_transactions'. This test ensures the correct
 * Keycloak role is mapped.
 */

jest.mock('../keycloakDiscovery', () => ({
  keycloakConfig: {
    clientId: 'ruqaqa-mobile-app',
    scopes: ['openid', 'profile', 'email'],
  },
}));

import { extractPermissions } from '../permissionService';

function buildPayload(opts?: {
  realmRoles?: string[];
  clientRoles?: string[];
}): Record<string, any> {
  const payload: Record<string, any> = {};
  if (opts?.realmRoles) {
    payload.realm_access = { roles: opts.realmRoles };
  }
  if (opts?.clientRoles) {
    payload.resource_access = {
      'ruqaqa-mobile-app': { roles: opts.clientRoles },
    };
  }
  return payload;
}

describe('canSelectPartner permission key', () => {
  it('grants canSelectPartner when mobile_select_partner_in_transactions is in realm roles', () => {
    const perms = extractPermissions(
      buildPayload({ realmRoles: ['mobile_select_partner_in_transactions'] }),
    );
    expect(perms.canSelectPartner).toBe(true);
  });

  it('grants canSelectPartner when mobile_select_partner_in_transactions is in client roles', () => {
    const perms = extractPermissions(
      buildPayload({ clientRoles: ['mobile_select_partner_in_transactions'] }),
    );
    expect(perms.canSelectPartner).toBe(true);
  });

  it('does not grant canSelectPartner with old/wrong role name', () => {
    const perms = extractPermissions(
      buildPayload({ realmRoles: ['select_partner'] }),
    );
    expect(perms.canSelectPartner).toBe(false);
  });

  it('does not grant canSelectPartner with partial role name', () => {
    const perms = extractPermissions(
      buildPayload({ realmRoles: ['mobile_select_partner'] }),
    );
    expect(perms.canSelectPartner).toBe(false);
  });

  it('does not grant canSelectPartner when no roles are present', () => {
    const perms = extractPermissions(buildPayload());
    expect(perms.canSelectPartner).toBe(false);
  });

  it('canSelectPartner is independent of canAccessFinance', () => {
    // Partner selection requires its own specific role, not just finance access
    const perms = extractPermissions(
      buildPayload({ realmRoles: ['transactions_create'] }),
    );
    expect(perms.canAccessFinance).toBe(true);
    expect(perms.canSelectPartner).toBe(false);
  });
});
