import * as Notifications from 'expo-notifications';

// Configure foreground notification display (e.g., download progress).
// Uses shouldShowBanner + shouldShowList (not the deprecated shouldShowAlert).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
