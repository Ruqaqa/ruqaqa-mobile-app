import { DownloadSnapshot, EMPTY_DOWNLOAD_SNAPSHOT } from '../types';

// --- Mocks ---

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { LOW: 2 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

jest.mock('@/i18n', () => ({
  i18next: { t: (key: string, opts?: any) => key },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

// --- Helpers ---

function makeSnapshot(overrides: Partial<DownloadSnapshot> = {}): DownloadSnapshot {
  return {
    jobs: [],
    totalCount: 0,
    completedCount: 0,
    failedCount: 0,
    isActive: false,
    batchProgress: 0,
    ...overrides,
  };
}

// Multiple microtask flushes needed for chained async (permission check → channel → schedule)
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// --- Tests ---

let Notifications: typeof import('expo-notifications');
let downloadNotificationObserver: typeof import('../services/downloadNotificationService').downloadNotificationObserver;
let dismissDownloadNotifications: typeof import('../services/downloadNotificationService').dismissDownloadNotifications;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Re-import to get fresh module state (channelConfigured, lastResultKey)
  Notifications = require('expo-notifications');
  const mod = require('../services/downloadNotificationService');
  downloadNotificationObserver = mod.downloadNotificationObserver;
  dismissDownloadNotifications = mod.dismissDownloadNotifications;
});

describe('downloadNotificationService', () => {
  describe('no-op cases', () => {
    it('does nothing for empty snapshot (totalCount=0)', async () => {
      downloadNotificationObserver(EMPTY_DOWNLOAD_SNAPSHOT);
      await flush();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('does nothing for snapshot with zero total and isActive false', async () => {
      downloadNotificationObserver(makeSnapshot({ totalCount: 0, isActive: false }));
      await flush();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('progress notification', () => {
    it('shows progress notification when snapshot is active', async () => {
      downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 3, completedCount: 1, failedCount: 0 }),
      );
      await flush();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'gallery-download-progress',
          trigger: null,
          content: expect.objectContaining({
            sticky: true,
          }),
        }),
      );
    });

    it('updates progress notification on subsequent active snapshots', async () => {
      downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 5, completedCount: 0, failedCount: 0 }),
      );
      await flush();

      downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 5, completedCount: 2, failedCount: 0 }),
      );
      await flush();

      // Both calls should use the progress notification ID (update in-place)
      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].identifier).toBe('gallery-download-progress');
      expect(calls[1][0].identifier).toBe('gallery-download-progress');
    });
  });

  describe('Android channel setup', () => {
    it('creates Android notification channel on first active call', async () => {
      downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 1 }),
      );
      await flush();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'gallery-downloads',
        expect.objectContaining({
          importance: 2, // AndroidImportance.LOW
        }),
      );
    });

    it('does not re-create channel on subsequent calls', async () => {
      downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 1 }),
      );
      await flush();

      downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 2, completedCount: 1 }),
      );
      await flush();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    });

    it('skips channel setup on iOS', async () => {
      // Override Platform.OS for this test
      jest.resetModules();
      jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
      jest.mock('expo-notifications', () => ({
        requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
        setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
        scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
        dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
        cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
        AndroidImportance: { LOW: 2 },
        AndroidNotificationVisibility: { PUBLIC: 1 },
      }));
      jest.mock('@/i18n', () => ({
        i18next: { t: (key: string) => key },
      }));

      const iosNotifications = require('expo-notifications');
      const iosMod = require('../services/downloadNotificationService');

      iosMod.downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 1 }),
      );
      await flush();

      expect(iosNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
      // Should still schedule the notification itself
      expect(iosNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('completion notification', () => {
    it('replaces progress with success notification using same ID', async () => {
      downloadNotificationObserver(
        makeSnapshot({ isActive: false, totalCount: 3, completedCount: 3, failedCount: 0 }),
      );
      await flush();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'gallery-download-progress',
          trigger: null,
          content: expect.objectContaining({
            body: 'downloadNotificationComplete',
            sticky: false,
          }),
        }),
      );
    });
  });

  describe('failure notification', () => {
    it('shows all-failed notification when every download fails', async () => {
      downloadNotificationObserver(
        makeSnapshot({ isActive: false, totalCount: 2, completedCount: 0, failedCount: 2 }),
      );
      await flush();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'gallery-download-progress',
          content: expect.objectContaining({
            body: 'downloadNotificationAllFailed',
          }),
        }),
      );
    });

    it('shows partial failure notification when some downloads fail', async () => {
      downloadNotificationObserver(
        makeSnapshot({ isActive: false, totalCount: 5, completedCount: 3, failedCount: 2 }),
      );
      await flush();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'gallery-download-progress',
          content: expect.objectContaining({
            body: 'downloadNotificationPartialFailure',
          }),
        }),
      );
    });
  });

  describe('deduplication', () => {
    it('does not show duplicate result notification for same completed snapshot', async () => {
      const snapshot = makeSnapshot({
        isActive: false,
        totalCount: 3,
        completedCount: 3,
        failedCount: 0,
      });

      downloadNotificationObserver(snapshot);
      await flush();

      downloadNotificationObserver(snapshot);
      await flush();

      // scheduleNotificationAsync should only be called once for the result
      const resultCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0].content?.sticky === false,
      );
      expect(resultCalls).toHaveLength(1);
    });

    it('resets dedup key when a new active batch starts', async () => {
      // First batch completes
      downloadNotificationObserver(
        makeSnapshot({ isActive: false, totalCount: 2, completedCount: 2, failedCount: 0 }),
      );
      await flush();

      // New batch starts (active)
      downloadNotificationObserver(
        makeSnapshot({ isActive: true, totalCount: 3, completedCount: 0, failedCount: 0 }),
      );
      await flush();

      // New batch completes with same counts would still show because key was reset
      downloadNotificationObserver(
        makeSnapshot({ isActive: false, totalCount: 2, completedCount: 2, failedCount: 0 }),
      );
      await flush();

      // Should have two result notifications (one per batch)
      const resultCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0].content?.sticky === false,
      );
      expect(resultCalls).toHaveLength(2);
    });
  });

  describe('dismissDownloadNotifications', () => {
    it('dismisses the download notification', async () => {
      await dismissDownloadNotifications();

      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
        'gallery-download-progress',
      );
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
    });

    it('resets dedup key so next result notification is shown', async () => {
      // Complete a batch
      downloadNotificationObserver(
        makeSnapshot({ isActive: false, totalCount: 2, completedCount: 2, failedCount: 0 }),
      );
      await flush();

      // Dismiss notifications (resets lastResultKey)
      await dismissDownloadNotifications();

      // Same batch shape arrives again — should show notification since key was reset
      downloadNotificationObserver(
        makeSnapshot({ isActive: false, totalCount: 2, completedCount: 2, failedCount: 0 }),
      );
      await flush();

      const resultCalls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0].content?.sticky === false,
      );
      expect(resultCalls).toHaveLength(2);
    });
  });
});
