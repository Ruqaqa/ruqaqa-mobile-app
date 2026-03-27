import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { light, dark, ThemeColors } from './colors';
import { typography, TypographyVariant } from './typography';
import { spacing, radius, shadows } from './spacing';

export type ColorScheme = 'light' | 'dark';

export interface Theme {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  colorScheme: ColorScheme;
}

function buildTheme(colorScheme: ColorScheme): Theme {
  return {
    colors: colorScheme === 'dark' ? dark : light,
    typography,
    spacing,
    radius,
    shadows,
    colorScheme,
  };
}

interface ThemeContextValue {
  theme: Theme;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme | 'system') => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme: ColorScheme =
    (useColorScheme() as ColorScheme) ?? 'light';
  const [override, setOverride] = useState<ColorScheme | 'system'>('system');

  const colorScheme: ColorScheme =
    override === 'system' ? systemScheme : override;
  const theme = useMemo(() => buildTheme(colorScheme), [colorScheme]);

  const value: ThemeContextValue = useMemo(
    () => ({ theme, colorScheme, setColorScheme: setOverride }),
    [theme, colorScheme],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx.theme;
}

export function useThemeControl() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeControl must be used within ThemeProvider');
  return ctx;
}

export { typography, spacing, radius, shadows };
export type { ThemeColors, TypographyVariant };
