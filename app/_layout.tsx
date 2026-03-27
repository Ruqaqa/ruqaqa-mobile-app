import React, { useEffect, useState } from 'react';
import { Slot, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme';
import { initI18n } from '../src/i18n';
import { AuthProvider } from '../src/services/authContext';
import { VersionGate } from '../src/components/version/VersionGate';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      await initI18n();
      setReady(true);
      SplashScreen.hideAsync();
    }
    bootstrap();
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <VersionGate>
          <StatusBar style="auto" />
          <Slot />
        </VersionGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
