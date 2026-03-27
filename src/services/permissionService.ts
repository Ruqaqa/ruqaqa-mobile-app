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
      has('reconciliation_read_own') ||
      has('reconciliation_read_all') ||
      has('payroll_read_own') ||
      has('payroll_read_all'),

    canAccessGallery: has('gallery_read_all') || has('gallery_read_own'),

    canCreateTransactions: has('transactions_create'),
    canViewTransactionHistory:
      has('transactions_read_own') || has('transactions_read_all'),
    canViewAllTransactions: has('transactions_read_all'),
    canUpdateTransactions: has('transactions_update'),
    canSelectPartner: has('transactions_select_partner'),
    canAddReceiptsToSubmitted: has('transactions_add_receipts'),

    canCreateReconciliation: has('reconciliation_create'),
    canViewReconciliationHistory:
      has('reconciliation_read_own') || has('reconciliation_read_all'),
    canViewAllReconciliations: has('reconciliation_read_all'),

    canViewPayrollHistory: has('payroll_read_own') || has('payroll_read_all'),
    canViewAllPayroll: has('payroll_read_all'),

    canViewGallery: has('gallery_read_all') || has('gallery_read_own'),
    canCreateGallery: has('gallery_create'),
    canDeleteGallery: has('gallery_delete'),
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
export type FinanceTab = 'operations' | 'reconciliation' | 'payroll';

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
  if (permissions.canViewPayrollHistory) {
    tabs.push('payroll');
  }
  return tabs;
}
