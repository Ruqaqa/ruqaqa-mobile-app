import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { i18next } from '@/i18n';

// Stable notification ID so we update in-place rather than stacking
const PROGRESS_NOTIFICATION_ID = 'gallery-video-processing';

// Android notification channel for video processing
const CHANNEL_ID = 'gallery-video-processing';

let channelConfigured = false;
let permissionGranted: boolean | null = null;

// Throttle progress notifications to avoid racing/flashing
let lastProgressTime = 0;
const THROTTLE_MS = 500;

// Once result is shown, block further progress updates
let resultShown = false;

async function ensurePermissionAndChannel(): Promise<boolean> {
  if (permissionGranted === null) {
    const { status } = await Notifications.requestPermissionsAsync();
    permissionGranted = status === 'granted';
  }
  if (!permissionGranted) return false;

  if (!channelConfigured && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('videoProcessingNotificationChannelName'),
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    channelConfigured = true;
  }
  return true;
}

function t(key: string, opts?: Record<string, unknown>): string {
  return i18next.t(key, opts) as string;
}

/**
 * Show a sticky foreground notification with video processing progress.
 * Keeps the app process alive when the user briefly switches away.
 * Throttled to one update per 500ms to avoid flashing.
 *
 * @param percentage  Progress 0–100.
 */
export async function showVideoProcessingProgress(percentage: number): Promise<void> {
  // Don't update progress after result is shown
  if (resultShown) return;

  const now = Date.now();
  if (now - lastProgressTime < THROTTLE_MS) return;
  lastProgressTime = now;

  const allowed = await ensurePermissionAndChannel();
  if (!allowed) return;

  const pct = Math.round(Math.min(100, Math.max(0, percentage)));

  await Notifications.scheduleNotificationAsync({
    identifier: PROGRESS_NOTIFICATION_ID,
    content: {
      title: t('videoProcessingNotificationTitle'),
      body: t('videoProcessingNotificationProgress', { percentage: pct }),
      sticky: true,
      ...(Platform.OS === 'android' && {
        channelId: CHANNEL_ID,
      }),
    },
    trigger: null, // immediate
  });
}

/**
 * Replace the sticky progress notification with a final result notification.
 *
 * @param success  Whether the processing completed successfully.
 */
export async function showVideoProcessingResult(success: boolean): Promise<void> {
  // Block any further progress updates from racing past this
  resultShown = true;

  const allowed = await ensurePermissionAndChannel();
  if (!allowed) return;

  const body = success
    ? t('videoProcessingNotificationComplete')
    : t('videoProcessingNotificationFailed');

  // Re-use the same notification ID to atomically replace the sticky notification
  await Notifications.scheduleNotificationAsync({
    identifier: PROGRESS_NOTIFICATION_ID,
    content: {
      title: t('videoProcessingNotificationTitle'),
      body,
      sticky: false,
      ...(Platform.OS === 'android' && {
        channelId: CHANNEL_ID,
      }),
    },
    trigger: null,
  });
}

/**
 * Dismiss all video processing notifications.
 * Call when the user resets the upload form or navigates away.
 */
export async function dismissVideoProcessingNotifications(): Promise<void> {
  resultShown = false;
  lastProgressTime = 0;
  await Notifications.cancelScheduledNotificationAsync(PROGRESS_NOTIFICATION_ID);
  await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
}
