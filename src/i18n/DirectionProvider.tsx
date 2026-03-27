import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * Wraps children in a View with `direction: 'rtl'|'ltr'` so that layout
 * direction updates instantly when the language changes — no app restart needed.
 *
 * I18nManager.forceRTL only takes effect after a native restart, but the
 * CSS `direction` style prop works immediately on the React Native layout engine.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';

  return (
    <View style={{ flex: 1, direction }}>
      {children}
    </View>
  );
}
