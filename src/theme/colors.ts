/**
 * Ruqaqa brand color palette — derived from ruqaqa-website design system.
 * See docs/design-system.md for full documentation.
 */

export const brand = {
  primary: '#1428a0',
  secondary: '#00a9e0',
  accent: '#20858f',
  green: '#208f5a',
} as const;

export const light = {
  ...brand,
  background: '#f6f8fd',
  surface: '#ffffff',
  foreground: '#0c0e14',
  foregroundSecondary: '#64748b',
  border: '#d1ddf7',
  input: '#e2e8f0',
  muted: '#f1f5f9',
  // On-color text
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onError: '#ffffff',
  // Semantic
  success: '#208f5a',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#00a9e0',
  // Status chips
  pendingBg: '#fef3c7',
  pendingText: '#92400e',
  approvedBg: '#d1fae5',
  approvedText: '#065f46',
  rejectedBg: '#fee2e2',
  rejectedText: '#991b1b',
} as const;

export const dark = {
  ...brand,
  primary: '#3b5ee6',
  secondary: '#00c3ff',
  accent: '#29acb9',
  green: '#29b974',
  background: '#0f172a',
  surface: '#1e293b',
  foreground: '#f8fafc',
  foregroundSecondary: '#94a3b8',
  border: '#334155',
  input: '#475569',
  muted: '#1e293b',
  // On-color text
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onError: '#ffffff',
  // Semantic
  success: '#29b974',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#00c3ff',
  // Status chips
  pendingBg: '#422006',
  pendingText: '#fde68a',
  approvedBg: '#064e3b',
  approvedText: '#a7f3d0',
  rejectedBg: '#450a0a',
  rejectedText: '#fecaca',
} as const;

/**
 * ThemeColors uses string for each color so light & dark are assignable
 * to the same type despite having different literal hex values.
 */
export type ThemeColors = { [K in keyof typeof light]: string };
