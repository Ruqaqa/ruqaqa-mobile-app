import React, { useEffect, useState } from 'react';
import { Slot, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from '../src/theme';
import { initI18n } from '../src/i18n';
import { DirectionProvider } from '../src/i18n/DirectionProvider';
import { AuthProvider, useAuth } from '../src/services/authContext';
import { VersionGate } from '../src/components/version/VersionGate';
import { SessionExpiredModal } from '../src/components/auth/SessionExpiredModal';
import { ShareIntentBridge } from '../src/components/share/ShareIntentBridge';

SplashScreen.preventAutoHideAsync();

// Show download progress notifications even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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
    <DirectionProvider>
      <ThemeProvider>
        <AuthProvider>
          <ShareIntentBridge />
          <VersionGate>
            <StatusBar style="auto" />
            <Slot />
          </VersionGate>
          <SessionExpiredOverlay />
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
