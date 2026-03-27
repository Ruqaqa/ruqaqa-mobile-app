import { TextStyle } from 'react-native';

/**
 * Typography scale — see docs/design-system.md
 * Uses system fonts (SF Pro on iOS, Roboto on Android).
 */
export const typography = {
  displayLarge: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  displayMedium: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  headingLarge: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  headingMedium: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  headingSmall: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  button: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
