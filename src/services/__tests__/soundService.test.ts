/**
 * Tests for soundService — success sound playback.
 */

const mockPlay = jest.fn();
const mockSeekTo = jest.fn();
const mockPlayer = { play: mockPlay, seekTo: mockSeekTo };
const mockCreateAudioPlayer = jest.fn().mockReturnValue(mockPlayer);

jest.mock('expo-audio', () => ({
  createAudioPlayer: mockCreateAudioPlayer,
}));

describe('playSuccessSound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAudioPlayer.mockReturnValue(mockPlayer);
  });

  it('creates a player on first call', async () => {
    jest.resetModules();
    const { playSuccessSound } = require('../soundService');

    await playSuccessSound();

    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('reuses player and seeks to start on subsequent calls', async () => {
    jest.resetModules();
    const { playSuccessSound } = require('../soundService');

    await playSuccessSound();
    await playSuccessSound();

    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockPlay).toHaveBeenCalledTimes(2);
  });

  it('never throws even if createAudioPlayer fails', async () => {
    jest.resetModules();
    mockCreateAudioPlayer.mockImplementationOnce(() => {
      throw new Error('Audio unavailable');
    });
    const { playSuccessSound } = require('../soundService');

    await expect(playSuccessSound()).resolves.toBeUndefined();
  });

  it('never throws if play() throws', async () => {
    jest.resetModules();
    mockPlay.mockImplementationOnce(() => {
      throw new Error('Playback failed');
    });
    const { playSuccessSound } = require('../soundService');

    await expect(playSuccessSound()).resolves.toBeUndefined();
  });

  it('never throws if seekTo() throws on replay', async () => {
    jest.resetModules();
    const { playSuccessSound } = require('../soundService');

    await playSuccessSound(); // first call — creates player
    mockSeekTo.mockImplementationOnce(() => {
      throw new Error('Seek failed');
    });

    await expect(playSuccessSound()).resolves.toBeUndefined();
  });

  it('retries creating player after a previous creation failure', async () => {
    jest.resetModules();
    mockCreateAudioPlayer.mockImplementationOnce(() => {
      throw new Error('Audio unavailable');
    });
    const { playSuccessSound } = require('../soundService');

    await playSuccessSound(); // fails to create
    mockCreateAudioPlayer.mockReturnValue(mockPlayer);
    await playSuccessSound(); // should retry creation

    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(2);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });
});
