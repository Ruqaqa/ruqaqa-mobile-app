import React, { useEffect, useState } from 'react';
import { Slot, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../src/services/notificationConfig';
import { ThemeProvider } from '../src/theme';
import { initI18n } from '../src/i18n';
import { DirectionProvider } from '../src/i18n/DirectionProvider';
import { AuthProvider, useAuth } from '../src/services/authContext';
import { VersionGate } from '../src/components/version/VersionGate';
import { SessionExpiredModal } from '../src/components/auth/SessionExpiredModal';
import { ShareIntentBridge } from '../src/components/share/ShareIntentBridge';

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

  // Always render Slot — expo-router requires a navigator on the first render.
  // Splash screen covers the UI until i18n is ready.
  return (
    <DirectionProvider>
      <ThemeProvider>
        <AuthProvider>
          {ready && <ShareIntentBridge />}
          <VersionGate>
            <StatusBar style="auto" />
            <Slot />
          </VersionGate>
          {ready && <SessionExpiredOverlay />}
        </AuthProvider>
      </ThemeProvider>
    </DirectionProvider>
  );
}

function SessionExpiredOverlay() {
  const { sessionExpired, acknowledgeSessionExpired } = useAuth();
  return (
    <SessionExpiredModal
      visible={sessionExpired}
      onSignIn={acknowledgeSessionExpired}
    />
  );
}
