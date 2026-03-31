/**
 * Tests for permissionService — pure functions that extract permissions
 * from JWT payloads and derive module/tab visibility.
 */

// Mock keycloakDiscovery to avoid pulling in expo-constants
jest.mock('../keycloakDiscovery', () => ({
  keycloakConfig: {
    clientId: 'ruqaqa-mobile-app',
    scopes: ['openid', 'profile', 'email'],
  },
}));

import {
  extractPermissions,
  getAvailableModules,
  getAvailableFinanceTabs,
} from '../permissionService';
import { UserPermissions } from '../../types/permissions';

// ---------------------------------------------------------------------------
// Helper: build a JWT payload with the given roles
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// extractPermissions
// ---------------------------------------------------------------------------

describe('extractPermissions', () => {
  it('returns all false for empty roles', () => {
    const perms = extractPermissions(buildPayload());
    const allFalse = Object.values(perms).every((v) => v === false);
    expect(allFalse).toBe(true);
  });

  it('extracts permissions from realm roles only', () => {
    const perms = extractPermissions(
      buildPayload({ realmRoles: ['transactions_create', 'gallery_read_all'] }),
    );
    expect(perms.canCreateTransactions).toBe(true);
    expect(perms.canAccessFinance).toBe(true);
    expect(perms.canViewGallery).toBe(true);
    expect(perms.canAccessGallery).toBe(true);
  });

  it('extracts permissions from client roles only', () => {
    const perms = extractPermissions(
      buildPayload({ clientRoles: ['reconciliation_create'] }),
    );
    expect(perms.canCreateReconciliation).toBe(true);
    expect(perms.canAccessFinance).toBe(true);
  });

  it('merges realm and client roles', () => {
    const perms = extractPermissions(
      buildPayload({
        realmRoles: ['transactions_create'],
        clientRoles: ['gallery_create'],
      }),
    );
    expect(perms.canCreateTransactions).toBe(true);
    expect(perms.canCreateGallery).toBe(true);
  });

  it('maintains cross-module isolation', () => {
    const perms = extractPermissions(
      buildPayload({ realmRoles: ['gallery_read_all'] }),
    );
    // Gallery access should be granted
    expect(perms.canAccessGallery).toBe(true);
    expect(perms.canViewGallery).toBe(true);
    // Finance access should NOT be granted
    expect(perms.canAccessFinance).toBe(false);
    expect(perms.canCreateTransactions).toBe(false);
  });

  it('handles missing realm_access gracefully', () => {
    const perms = extractPermissions({ resource_access: { 'ruqaqa-mobile-app': { roles: ['transactions_read_own'] } } });
    expect(perms.canViewTransactionHistory).toBe(true);
  });

  it('handles missing resource_access gracefully', () => {
    const perms = extractPermissions({ realm_access: { roles: ['transactions_read_own'] } });
    expect(perms.canViewTransactionHistory).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Shared baseline permissions object — all flags false
// ---------------------------------------------------------------------------

const NO_ACCESS: UserPermissions = {
  canAccessFinance: false,
  canAccessGallery: false,
  canCreateTransactions: false,
  canViewTransactionHistory: false,
  canViewAllTransactions: false,
  canUpdateTransactions: false,
  canSelectPartner: false,
  canAddReceiptsToSubmitted: false,
  canCreateReconciliation: false,
  canViewReconciliationHistory: false,
  canViewAllReconciliations: false,
  canUpdateReconciliation: false,
  canViewGallery: false,
  canCreateGallery: false,
  canDeleteGallery: false,
};

// ---------------------------------------------------------------------------
// getAvailableModules
// ---------------------------------------------------------------------------

describe('getAvailableModules', () => {

  it('returns empty when no access', () => {
    expect(getAvailableModules(NO_ACCESS)).toEqual([]);
  });

  it('returns only finance when gallery not accessible', () => {
    expect(
      getAvailableModules({ ...NO_ACCESS, canAccessFinance: true }),
    ).toEqual(['finance']);
  });

  it('returns only gallery when finance not accessible', () => {
    expect(
      getAvailableModules({ ...NO_ACCESS, canAccessGallery: true }),
    ).toEqual(['gallery']);
  });

  it('returns both modules in correct order', () => {
    expect(
      getAvailableModules({
        ...NO_ACCESS,
        canAccessFinance: true,
        canAccessGallery: true,
      }),
    ).toEqual(['finance', 'gallery']);
  });
});

// ---------------------------------------------------------------------------
// getAvailableFinanceTabs
// ---------------------------------------------------------------------------

describe('getAvailableFinanceTabs', () => {
  it('returns empty when no permissions', () => {
    expect(getAvailableFinanceTabs(NO_ACCESS)).toEqual([]);
  });

  it('includes operations for canCreateTransactions', () => {
    const tabs = getAvailableFinanceTabs({
      ...NO_ACCESS,
      canCreateTransactions: true,
    });
    expect(tabs).toContain('operations');
  });

  it('includes operations for canViewTransactionHistory', () => {
    const tabs = getAvailableFinanceTabs({
      ...NO_ACCESS,
      canViewTransactionHistory: true,
    });
    expect(tabs).toContain('operations');
  });

  it('includes reconciliation for canCreateReconciliation', () => {
    const tabs = getAvailableFinanceTabs({
      ...NO_ACCESS,
      canCreateReconciliation: true,
    });
    expect(tabs).toContain('reconciliation');
  });

  it('includes reconciliation for canViewReconciliationHistory', () => {
    const tabs = getAvailableFinanceTabs({
      ...NO_ACCESS,
      canViewReconciliationHistory: true,
    });
    expect(tabs).toContain('reconciliation');
  });

  it('returns all tabs for full access in correct order', () => {
    const tabs = getAvailableFinanceTabs({
      ...NO_ACCESS,
      canCreateTransactions: true,
      canViewTransactionHistory: true,
      canCreateReconciliation: true,
      canViewReconciliationHistory: true,
    });
    expect(tabs).toEqual(['operations', 'reconciliation']);
  });
});
