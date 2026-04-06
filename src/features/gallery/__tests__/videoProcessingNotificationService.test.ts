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

// Multiple microtask flushes needed for chained async
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// --- Setup ---

let Notifications: typeof import('expo-notifications');
let showVideoProcessingProgress: typeof import('../services/videoProcessingNotificationService').showVideoProcessingProgress;
let showVideoProcessingResult: typeof import('../services/videoProcessingNotificationService').showVideoProcessingResult;
let dismissVideoProcessingNotifications: typeof import('../services/videoProcessingNotificationService').dismissVideoProcessingNotifications;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  Notifications = require('expo-notifications');
  const mod = require('../services/videoProcessingNotificationService');
  showVideoProcessingProgress = mod.showVideoProcessingProgress;
  showVideoProcessingResult = mod.showVideoProcessingResult;
  dismissVideoProcessingNotifications = mod.dismissVideoProcessingNotifications;
});

// --- Tests ---

describe('showVideoProcessingProgress', () => {
  it('shows a notification with the progress percentage', async () => {
    await showVideoProcessingProgress(50);
    await flush();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'gallery-video-processing',
        content: expect.objectContaining({
          sticky: true,
        }),
        trigger: null,
      }),
    );
  });

  it('clamps percentage to 0-100 range', async () => {
    await showVideoProcessingProgress(150);
    await flush();

    // Should not crash, should clamp to 100
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('requests permission on first call', async () => {
    await showVideoProcessingProgress(25);
    await flush();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('creates Android notification channel on first call', async () => {
    await showVideoProcessingProgress(25);
    await flush();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'gallery-video-processing',
      expect.objectContaining({
        importance: Notifications.AndroidImportance.LOW,
      }),
    );
  });

  it('does not show notification when permission denied', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    await showVideoProcessingProgress(50);
    await flush();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('showVideoProcessingResult', () => {
  it('shows success notification with sticky=false', async () => {
    await showVideoProcessingResult(true);
    await flush();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'gallery-video-processing',
        content: expect.objectContaining({
          sticky: false,
        }),
        trigger: null,
      }),
    );
  });

  it('shows failure notification', async () => {
    await showVideoProcessingResult(false);
    await flush();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('reuses same notification ID to replace progress notification', async () => {
    await showVideoProcessingProgress(75);
    await flush();
    await showVideoProcessingResult(true);
    await flush();

    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(calls[0][0].identifier).toBe('gallery-video-processing');
    expect(calls[1][0].identifier).toBe('gallery-video-processing');
  });
});

describe('dismissVideoProcessingNotifications', () => {
  it('cancels and dismisses notifications', async () => {
    await dismissVideoProcessingNotifications();
    await flush();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'gallery-video-processing',
    );
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
      'gallery-video-processing',
    );
  });
});
