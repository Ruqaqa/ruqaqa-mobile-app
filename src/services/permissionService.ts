import { UserPermissions, AppModule } from '../types/permissions';
import { keycloakConfig } from './keycloakDiscovery';

/**
 * Parse a Keycloak JWT payload and extract user permissions.
 * The JWT is expected to have roles in `realm_access.roles` and/or
 * `resource_access.<clientId>.roles`.
 */
export function extractPermissions(
  jwtPayload: Record<string, any>,
): UserPermissions {
  const realmRoles: string[] = jwtPayload?.realm_access?.roles ?? [];
  const clientRoles: string[] =
    jwtPayload?.resource_access?.[keycloakConfig.clientId]?.roles ?? [];
  const allRoles = new Set([...realmRoles, ...clientRoles]);

  const has = (role: string) => allRoles.has(role);

  return {
    canAccessFinance:
      has('transactions_create') ||
      has('transactions_read_own') ||
      has('transactions_read_all') ||
      has('reconciliation_create') ||
      has('reconciliation_read_own') ||
      has('reconciliation_read_all'),

    canAccessGallery:
      has('gallery_cms_read') ||
      has('gallery_cms_create') ||
      has('gallery_cms_update') ||
      has('gallery_cms_delete') ||
      has('cms_admin') ||
      has('cms_editor') ||
      has('cms_viewer'),

    canCreateTransactions: has('transactions_create'),
    canViewTransactionHistory:
      has('transactions_read_own') || has('transactions_read_all'),
    canViewAllTransactions: has('transactions_read_all'),
    canUpdateTransactions: has('transactions_update'),
    canSelectPartner: has('mobile_select_partner_in_transactions'),
    canAddReceiptsToSubmitted: has('transactions_add_receipts'),

    canCreateReconciliation: has('reconciliation_create'),
    canViewReconciliationHistory:
      has('reconciliation_read_own') || has('reconciliation_read_all'),
    canViewAllReconciliations: has('reconciliation_read_all'),
    canUpdateReconciliation: has('reconciliation_update'),

    canViewGallery:
      has('gallery_cms_read') ||
      has('gallery_cms_create') ||
      has('gallery_cms_update') ||
      has('gallery_cms_delete') ||
      has('cms_admin') ||
      has('cms_editor') ||
      has('cms_viewer'),
    canCreateGallery:
      has('gallery_cms_create') ||
      has('cms_admin') ||
      has('cms_editor'),
    canUpdateGallery:
      has('gallery_cms_update') ||
      has('cms_admin') ||
      has('cms_editor'),
    canDeleteGallery: has('gallery_cms_delete'),
  };
}

/**
 * Get the list of modules the user can access based on permissions.
 */
export function getAvailableModules(
  permissions: UserPermissions,
): AppModule[] {
  const modules: AppModule[] = [];
  if (permissions.canAccessFinance) modules.push('finance');
  if (permissions.canAccessGallery) modules.push('gallery');
  return modules;
}

/**
 * Get the finance tabs the user can see.
 */
export type FinanceTab = 'operations' | 'reconciliation';

export function getAvailableFinanceTabs(
  permissions: UserPermissions,
): FinanceTab[] {
  const tabs: FinanceTab[] = [];
  if (permissions.canCreateTransactions || permissions.canViewTransactionHistory) {
    tabs.push('operations');
  }
  if (
    permissions.canCreateReconciliation ||
    permissions.canViewReconciliationHistory
  ) {
    tabs.push('reconciliation');
  }
  return tabs;
}
