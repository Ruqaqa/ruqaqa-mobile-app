jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
}));

describe('notificationConfig', () => {
  let Notifications: typeof import('expo-notifications');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Notifications = require('expo-notifications');
  });

  it('calls setNotificationHandler on import', () => {
    require('../notificationConfig');

    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('configures handler without deprecated shouldShowAlert property', async () => {
    require('../notificationConfig');

    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    const result = await handler.handleNotification();

    expect(result).not.toHaveProperty('shouldShowAlert');
  });

  it('configures shouldShowBanner to true', async () => {
    require('../notificationConfig');

    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    const result = await handler.handleNotification();

    expect(result.shouldShowBanner).toBe(true);
  });

  it('configures shouldShowList to true', async () => {
    require('../notificationConfig');

    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    const result = await handler.handleNotification();

    expect(result.shouldShowList).toBe(true);
  });

  it('configures shouldPlaySound to false', async () => {
    require('../notificationConfig');

    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    const result = await handler.handleNotification();

    expect(result.shouldPlaySound).toBe(false);
  });

  it('configures shouldSetBadge to false', async () => {
    require('../notificationConfig');

    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    const result = await handler.handleNotification();

    expect(result.shouldSetBadge).toBe(false);
  });
});
