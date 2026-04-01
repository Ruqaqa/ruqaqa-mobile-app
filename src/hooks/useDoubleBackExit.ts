import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

const DOUBLE_BACK_THRESHOLD_MS = 2000;

/**
 * Android double-back-to-exit behavior.
 * First back press shows a toast; second press within 2 seconds exits the app.
 * Always returns true from the handler to prevent default back navigation (e.g. to login).
 *
 * @param toastMessage - Message to show on first back press
 */
export function useDoubleBackExit(toastMessage: string) {
  const lastBackPress = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();
      if (now - lastBackPress.current < DOUBLE_BACK_THRESHOLD_MS) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress.current = now;
      ToastAndroid.show(toastMessage, ToastAndroid.SHORT);
      return true;
    });

    return () => handler.remove();
  }, [toastMessage]);
}

export { DOUBLE_BACK_THRESHOLD_MS };
