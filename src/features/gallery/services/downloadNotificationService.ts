import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { i18next } from '@/i18n';
import { DownloadSnapshot } from '../types';

// Stable notification ID so we update in-place rather than stacking
const PROGRESS_NOTIFICATION_ID = 'gallery-download-progress';

// Android notification channel for downloads
const CHANNEL_ID = 'gallery-downloads';

let channelConfigured = false;
let permissionGranted: boolean | null = null;

async function ensurePermissionAndChannel(): Promise<boolean> {
  // Request notification permission (required on Android 13+)
  if (permissionGranted === null) {
    const { status } = await Notifications.requestPermissionsAsync();
    permissionGranted = status === 'granted';
  }
  if (!permissionGranted) return false;

  // Set up Android channel
  if (!channelConfigured && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18next.t('downloadNotificationChannelName'),
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
 * Observer that listens to download queue snapshots and manages
 * system notifications for download progress, completion, and failure.
 *
 * Usage:
 *   const unsub = queue.subscribe(downloadNotificationObserver);
 *   // later: unsub();
 */
export function downloadNotificationObserver(snapshot: DownloadSnapshot): void {
  // Nothing to notify about
  if (snapshot.totalCount === 0) return;

  if (snapshot.isActive) {
    showProgressNotification(snapshot);
  } else {
    dismissProgressAndShowResult(snapshot);
  }
}

// --- Internal state to avoid duplicate final notifications ---
let lastResultKey: string | null = null;

async function showProgressNotification(snapshot: DownloadSnapshot): Promise<void> {
  // Reset result key when a new batch starts
  lastResultKey = null;

  const allowed = await ensurePermissionAndChannel();
  if (!allowed) return;

  const body = t('downloadNotificationProgress', {
    completed: snapshot.completedCount,
    total: snapshot.totalCount,
  });

  await Notifications.scheduleNotificationAsync({
    identifier: PROGRESS_NOTIFICATION_ID,
    content: {
      title: t('downloadNotificationTitle'),
      body,
      sticky: true,
      ...(Platform.OS === 'android' && {
        channelId: CHANNEL_ID,
      }),
    },
    trigger: null, // immediate
  });
}

async function dismissProgressAndShowResult(snapshot: DownloadSnapshot): Promise<void> {
  // Derive a key so we don't re-fire the same result notification
  const resultKey = `${snapshot.completedCount}-${snapshot.failedCount}-${snapshot.totalCount}`;
  if (lastResultKey === resultKey) return;
  lastResultKey = resultKey;

  const allowed = await ensurePermissionAndChannel();
  if (!allowed) return;

  let body: string;
  if (snapshot.failedCount > 0 && snapshot.completedCount === 0) {
    body = t('downloadNotificationAllFailed', { count: snapshot.failedCount });
  } else if (snapshot.failedCount > 0) {
    body = t('downloadNotificationPartialFailure', {
      completed: snapshot.completedCount,
      total: snapshot.totalCount,
      failed: snapshot.failedCount,
    });
  } else {
    body = t('downloadNotificationComplete', { count: snapshot.completedCount });
  }

  // Re-use the same notification ID so the result replaces the sticky progress
  // notification atomically — avoids the dismiss-then-create race that leaves
  // a stale "جاري تحميل" notification on Android.
  await Notifications.scheduleNotificationAsync({
    identifier: PROGRESS_NOTIFICATION_ID,
    content: {
      title: t('downloadNotificationTitle'),
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
 * Dismiss all download-related notifications.
 * Call this when the user clears completed downloads from the UI.
 */
export async function dismissDownloadNotifications(): Promise<void> {
  lastResultKey = null;
  await Notifications.cancelScheduledNotificationAsync(PROGRESS_NOTIFICATION_ID);
  await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
}
