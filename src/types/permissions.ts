/**
 * Permissions extracted from Keycloak JWT.
 * Controls which modules, tabs, and actions are visible.
 */
export interface UserPermissions {
  // Module access
  canAccessFinance: boolean;
  canAccessGallery: boolean;

  // Transactions
  canCreateTransactions: boolean;
  canViewTransactionHistory: boolean;
  canViewAllTransactions: boolean;
  canUpdateTransactions: boolean;
  canSelectPartner: boolean;
  canAddReceiptsToSubmitted: boolean;

  // Reconciliation
  canCreateReconciliation: boolean;
  canViewReconciliationHistory: boolean;
  canViewAllReconciliations: boolean;
  canUpdateReconciliation: boolean;

  // Gallery
  canViewGallery: boolean;
  canCreateGallery: boolean;
  canUpdateGallery: boolean;
  canDeleteGallery: boolean;
}

export type AppModule = 'finance' | 'gallery';

export interface Employee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}
