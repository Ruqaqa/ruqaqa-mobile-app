/**
 * Tests for soundService — success sound playback.
 */

const mockPlayAsync = jest.fn().mockResolvedValue({});
const mockSetPositionAsync = jest.fn().mockResolvedValue({});
const mockSound = { playAsync: mockPlayAsync, setPositionAsync: mockSetPositionAsync };
const mockCreateAsync = jest.fn().mockResolvedValue({ sound: mockSound });

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: mockCreateAsync,
    },
  },
}));

describe('playSuccessSound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAsync.mockResolvedValue({ sound: mockSound });
  });

  it('calls Audio.Sound.createAsync on first call', async () => {
    // Re-import to get fresh module-level state
    jest.resetModules();
    const { playSuccessSound } = require('../soundService');

    await playSuccessSound();

    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
    expect(mockPlayAsync).toHaveBeenCalledTimes(1);
  });

  it('reuses loaded sound on subsequent calls', async () => {
    jest.resetModules();
    const { playSuccessSound } = require('../soundService');

    await playSuccessSound();
    await playSuccessSound();

    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
    expect(mockSetPositionAsync).toHaveBeenCalledWith(0);
    expect(mockPlayAsync).toHaveBeenCalledTimes(2);
  });

  it('never throws even if Audio fails', async () => {
    jest.resetModules();
    mockCreateAsync.mockRejectedValueOnce(new Error('Audio unavailable'));
    const { playSuccessSound } = require('../soundService');

    await expect(playSuccessSound()).resolves.toBeUndefined();
  });
});
