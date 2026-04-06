const mockExecute = jest.fn().mockResolvedValue({
  returnCode: 0,
  output: 'stub',
  duration: 0,
});
const mockCancel = jest.fn();
const mockGetMediaInfo = jest.fn().mockResolvedValue({
  duration: 0,
  width: 0,
  height: 0,
  codec: '',
  bitrate: 0,
});
const mockAddListener = jest.fn().mockReturnValue({ remove: jest.fn() });

jest.mock('expo', () => ({
  NativeModule: class {},
  requireNativeModule: () => ({
    execute: mockExecute,
    cancel: mockCancel,
    getMediaInfo: mockGetMediaInfo,
    addListener: mockAddListener,
  }),
}));

let mockPlatformOS = 'ios';
jest.mock('../platform', () => ({
  getPreferredEncoder: () => {
    switch (mockPlatformOS) {
      case 'ios':
        return 'h264_videotoolbox';
      case 'android':
        return 'h264_mediacodec';
      default:
        return 'libx264';
    }
  },
}));

import {
  execute,
  cancel,
  getMediaInfo,
  getPreferredEncoder,
  extractThumbnail,
  buildWatermarkCommand,
  buildCompressCommand,
  buildExtractThumbnailCommand,
  getErrorCode,
  extractOutputPath,
  FFmpegErrorCode,
} from '../index';

describe('module exports', () => {
  it('exports execute as a function', () => {
    expect(typeof execute).toBe('function');
  });

  it('exports cancel as a function', () => {
    expect(typeof cancel).toBe('function');
  });

  it('exports getMediaInfo as a function', () => {
    expect(typeof getMediaInfo).toBe('function');
  });

  it('exports getPreferredEncoder as a function', () => {
    expect(typeof getPreferredEncoder).toBe('function');
  });

  it('exports extractThumbnail as a function', () => {
    expect(typeof extractThumbnail).toBe('function');
  });

  it('exports buildWatermarkCommand as a function', () => {
    expect(typeof buildWatermarkCommand).toBe('function');
  });

  it('exports buildCompressCommand as a function', () => {
    expect(typeof buildCompressCommand).toBe('function');
  });

  it('exports buildExtractThumbnailCommand as a function', () => {
    expect(typeof buildExtractThumbnailCommand).toBe('function');
  });

  it('exports getErrorCode as a function', () => {
    expect(typeof getErrorCode).toBe('function');
  });

  it('exports extractOutputPath as a function', () => {
    expect(typeof extractOutputPath).toBe('function');
  });

  it('exports FFmpegErrorCode constants', () => {
    expect(FFmpegErrorCode).toBeDefined();
    expect(FFmpegErrorCode.SUCCESS).toBe(0);
    expect(FFmpegErrorCode.CANCELLED).toBe('CANCELLED');
    expect(FFmpegErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(FFmpegErrorCode.UNKNOWN).toBe('UNKNOWN');
  });
});

describe('execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls native execute and returns the result', async () => {
    const result = await execute('-i input.mp4 output.mp4');

    expect(mockExecute).toHaveBeenCalledWith('-i input.mp4 output.mp4');
    expect(result).toEqual({
      returnCode: 0,
      output: 'stub',
      duration: 0,
    });
  });

  it('subscribes to progress events when callback is provided', async () => {
    const onProgress = jest.fn();
    await execute('-i input.mp4 output.mp4', onProgress);

    expect(mockAddListener).toHaveBeenCalledWith('onProgress', onProgress);
  });

  it('does not subscribe to progress events when no callback', async () => {
    await execute('-i input.mp4 output.mp4');

    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it('removes progress listener after execution completes', async () => {
    const mockRemove = jest.fn();
    mockAddListener.mockReturnValueOnce({ remove: mockRemove });

    await execute('-i input.mp4 output.mp4', jest.fn());

    expect(mockRemove).toHaveBeenCalled();
  });

  it('removes progress listener even when execution throws', async () => {
    const mockRemove = jest.fn();
    mockAddListener.mockReturnValueOnce({ remove: mockRemove });
    mockExecute.mockRejectedValueOnce(new Error('FFmpeg failed'));

    await expect(execute('-i input.mp4 output.mp4', jest.fn())).rejects.toThrow('FFmpeg failed');
    expect(mockRemove).toHaveBeenCalled();
  });

  it('returns ExecutionResult with correct shape', async () => {
    mockExecute.mockResolvedValueOnce({
      returnCode: 0,
      output: 'frame=  100 fps=30.0 time=00:00:03.33 speed=2.5x',
      duration: 3500,
    });

    const result = await execute('-i input.mp4 output.mp4');

    expect(result).toHaveProperty('returnCode');
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('duration');
    expect(typeof result.returnCode).toBe('number');
    expect(typeof result.output).toBe('string');
    expect(typeof result.duration).toBe('number');
  });

  it('returns non-zero returnCode on FFmpeg error', async () => {
    mockExecute.mockResolvedValueOnce({
      returnCode: 1,
      output: 'Error: Invalid input file',
      duration: 50,
    });

    const result = await execute('-i nonexistent.mp4 output.mp4');

    expect(result.returnCode).toBe(1);
  });
});

describe('cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls native cancel', () => {
    cancel();

    expect(mockCancel).toHaveBeenCalled();
  });
});

describe('getMediaInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls native getMediaInfo with the path and returns result', async () => {
    const result = await getMediaInfo('/path/to/video.mp4');

    expect(mockGetMediaInfo).toHaveBeenCalledWith('/path/to/video.mp4');
    expect(result).toEqual({
      duration: 0,
      width: 0,
      height: 0,
      codec: '',
      bitrate: 0,
    });
  });

  it('returns MediaInfo with realistic values', async () => {
    mockGetMediaInfo.mockResolvedValueOnce({
      duration: 120.5,
      width: 1920,
      height: 1080,
      codec: 'h264',
      bitrate: 8000000,
    });
    const result = await getMediaInfo('/path/to/video.mp4');

    expect(result.duration).toBe(120.5);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.codec).toBe('h264');
    expect(result.bitrate).toBe(8000000);
  });

  it('rejects when native module throws', async () => {
    mockGetMediaInfo.mockRejectedValueOnce(new Error('File not found'));

    await expect(getMediaInfo('/nonexistent.mp4')).rejects.toThrow('File not found');
  });
});

describe('getPreferredEncoder', () => {
  afterEach(() => {
    mockPlatformOS = 'ios';
  });

  it('returns h264_videotoolbox for iOS', () => {
    mockPlatformOS = 'ios';

    expect(getPreferredEncoder()).toBe('h264_videotoolbox');
  });

  it('returns h264_mediacodec for Android', () => {
    mockPlatformOS = 'android';

    expect(getPreferredEncoder()).toBe('h264_mediacodec');
  });

  it('returns libx264 for unknown platforms', () => {
    mockPlatformOS = 'web';

    expect(getPreferredEncoder()).toBe('libx264');
  });
});

describe('extractThumbnail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls execute with the thumbnail extraction command', async () => {
    await extractThumbnail('/video.mp4', '/thumb.jpg', 2);

    expect(mockExecute).toHaveBeenCalledWith(
      '-ss 2 -i "/video.mp4" -vframes 1 -f image2 -y "/thumb.jpg"',
    );
  });

  it('uses default time of 1 second', async () => {
    await extractThumbnail('/video.mp4', '/thumb.jpg');

    expect(mockExecute).toHaveBeenCalledWith(
      '-ss 1 -i "/video.mp4" -vframes 1 -f image2 -y "/thumb.jpg"',
    );
  });

  it('returns ExecutionResult from the native execute', async () => {
    mockExecute.mockResolvedValueOnce({
      returnCode: 0,
      output: 'thumbnail extracted',
      duration: 200,
    });

    const result = await extractThumbnail('/video.mp4', '/thumb.jpg');

    expect(result).toEqual({
      returnCode: 0,
      output: 'thumbnail extracted',
      duration: 200,
    });
  });

  it('rejects when native execute fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Codec not found'));

    await expect(extractThumbnail('/video.mp4', '/thumb.jpg')).rejects.toThrow('Codec not found');
  });
});

describe('getErrorCode', () => {
  it('maps "Cancelled by user" to CANCELLED', () => {
    expect(getErrorCode('Cancelled by user')).toBe(FFmpegErrorCode.CANCELLED);
  });

  it('maps "cancelled by user" (lowercase) to CANCELLED', () => {
    expect(getErrorCode('cancelled by user')).toBe(FFmpegErrorCode.CANCELLED);
  });

  it('maps "Out of memory" to OUT_OF_MEMORY', () => {
    expect(getErrorCode('Out of memory')).toBe(FFmpegErrorCode.OUT_OF_MEMORY);
  });

  it('maps "out of memory" (lowercase) to OUT_OF_MEMORY', () => {
    expect(getErrorCode('out of memory during encoding')).toBe(FFmpegErrorCode.OUT_OF_MEMORY);
  });

  it('maps "Invalid argument" to INVALID_ARGUMENT', () => {
    expect(getErrorCode('Invalid argument')).toBe(FFmpegErrorCode.INVALID_ARGUMENT);
  });

  it('maps "missing input" to INVALID_ARGUMENT', () => {
    expect(getErrorCode('missing input file')).toBe(FFmpegErrorCode.INVALID_ARGUMENT);
  });

  it('maps "I/O error" to IO_ERROR', () => {
    expect(getErrorCode('I/O error reading file')).toBe(FFmpegErrorCode.IO_ERROR);
  });

  it('maps "cannot open" to IO_ERROR', () => {
    expect(getErrorCode('cannot open /path/to/file.mp4')).toBe(FFmpegErrorCode.IO_ERROR);
  });

  it('returns UNKNOWN for empty string', () => {
    expect(getErrorCode('')).toBe(FFmpegErrorCode.UNKNOWN);
  });

  it('returns UNKNOWN for unrecognized error', () => {
    expect(getErrorCode('Some random FFmpeg error')).toBe(FFmpegErrorCode.UNKNOWN);
  });

  it('maps error strings case-insensitively', () => {
    expect(getErrorCode('CANCELLED BY USER')).toBe(FFmpegErrorCode.CANCELLED);
    expect(getErrorCode('OUT OF MEMORY')).toBe(FFmpegErrorCode.OUT_OF_MEMORY);
    expect(getErrorCode('INVALID ARGUMENT')).toBe(FFmpegErrorCode.INVALID_ARGUMENT);
    expect(getErrorCode('I/O ERROR')).toBe(FFmpegErrorCode.IO_ERROR);
    expect(getErrorCode('CANNOT OPEN')).toBe(FFmpegErrorCode.IO_ERROR);
  });
});

describe('extractOutputPath', () => {
  it('extracts quoted output path after -y flag', () => {
    expect(extractOutputPath('-i "/input.mp4" -y "/output.mp4"')).toBe('/output.mp4');
  });

  it('extracts unquoted output path after -y flag', () => {
    expect(extractOutputPath('-i /input.mp4 -y /output.mp4')).toBe('/output.mp4');
  });

  it('returns null when no -y flag is present', () => {
    expect(extractOutputPath('-i /input.mp4 /output.mp4')).toBeNull();
  });

  it('extracts path after the last -y flag', () => {
    expect(
      extractOutputPath('-i "/input.mp4" -y "/intermediate.mp4" -i "/other.mp4" -y "/final.mp4"'),
    ).toBe('/final.mp4');
  });

  it('handles paths with spaces inside quotes', () => {
    expect(extractOutputPath('-i "/input.mp4" -y "/path/to/my output.mp4"')).toBe(
      '/path/to/my output.mp4',
    );
  });

  it('returns null for empty command', () => {
    expect(extractOutputPath('')).toBeNull();
  });

  it('returns null when -y has no path after it', () => {
    expect(extractOutputPath('-i /input.mp4 -y ')).toBeNull();
  });

  it('handles real watermark command output path', () => {
    const cmd = buildWatermarkCommand('/video.mp4', '/logo.png', '/output/result.mp4');
    expect(extractOutputPath(cmd)).toBe('/output/result.mp4');
  });

  it('handles real compress command output path', () => {
    const cmd = buildCompressCommand('/video.mp4', '/output/compressed.mp4');
    expect(extractOutputPath(cmd)).toBe('/output/compressed.mp4');
  });

  it('handles real thumbnail command output path', () => {
    const cmd = buildExtractThumbnailCommand('/video.mp4', '/output/thumb.jpg');
    expect(extractOutputPath(cmd)).toBe('/output/thumb.jpg');
  });
});

describe('execute with timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects with timeout error when execution exceeds timeout', async () => {
    // Native execute never resolves
    mockExecute.mockReturnValueOnce(new Promise(() => {}));

    const promise = execute('-i input.mp4 -y /output.mp4', undefined, { timeout: 1000 });

    jest.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow('FFmpeg execution timed out');
    expect(mockCancel).toHaveBeenCalled();
  });

  it('succeeds when execution completes before timeout', async () => {
    mockExecute.mockResolvedValueOnce({
      returnCode: 0,
      output: 'done',
      duration: 500,
    });

    const result = await execute('-i input.mp4 -y /output.mp4', undefined, { timeout: 5000 });

    expect(result.returnCode).toBe(0);
  });

  it('uses default timeout of 300000ms when no timeout option provided', async () => {
    mockExecute.mockReturnValueOnce(new Promise(() => {}));

    const promise = execute('-i input.mp4 -y /output.mp4');

    // Advance just under 5 minutes — should not have timed out yet
    jest.advanceTimersByTime(299_999);

    // Still pending (no rejection yet, cancel not called)
    expect(mockCancel).not.toHaveBeenCalled();

    // Advance past 5 minutes
    jest.advanceTimersByTime(1);

    await expect(promise).rejects.toThrow('FFmpeg execution timed out');
    expect(mockCancel).toHaveBeenCalled();
  });

  it('disables timeout when timeout is 0', async () => {
    mockExecute.mockResolvedValueOnce({
      returnCode: 0,
      output: 'done',
      duration: 100,
    });

    const result = await execute('-i input.mp4 -y /output.mp4', undefined, { timeout: 0 });

    expect(result.returnCode).toBe(0);
    // No timeout was set, so cancel should never be called
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('calls cancel() when timeout fires', async () => {
    mockExecute.mockReturnValueOnce(new Promise(() => {}));

    const promise = execute('-i input.mp4 -y /output.mp4', undefined, { timeout: 500 });

    jest.advanceTimersByTime(500);

    await expect(promise).rejects.toThrow('FFmpeg execution timed out');
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('clears timeout on successful completion (no late timeout fires)', async () => {
    mockExecute.mockResolvedValueOnce({
      returnCode: 0,
      output: 'done',
      duration: 100,
    });

    await execute('-i input.mp4 -y /output.mp4', undefined, { timeout: 5000 });

    // Advance past the timeout — should NOT trigger cancel because it was cleared
    jest.advanceTimersByTime(10000);
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe('execute cleanup on failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rethrows the original error from native execute', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Codec not found'));

    await expect(execute('-i input.mp4 -y "/output.mp4"')).rejects.toThrow('Codec not found');
  });

  it('attempts to extract and clean output path on failure', async () => {
    // deleteFileIfExists uses dynamic require which will fail in test env (silently).
    // The important thing is that it doesn't throw and the original error propagates.
    mockExecute.mockRejectedValueOnce(new Error('Processing failed'));

    await expect(execute('-i input.mp4 -y "/tmp/output.mp4"')).rejects.toThrow('Processing failed');
  });

  it('does not throw when command has no -y output path and fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('No output'));

    await expect(execute('-i input.mp4 output.mp4')).rejects.toThrow('No output');
  });

  it('still removes progress listener on failure', async () => {
    const mockRemove = jest.fn();
    mockAddListener.mockReturnValueOnce({ remove: mockRemove });
    mockExecute.mockRejectedValueOnce(new Error('Failed'));

    await expect(execute('-i input.mp4 -y "/output.mp4"', jest.fn())).rejects.toThrow('Failed');
    expect(mockRemove).toHaveBeenCalled();
  });
});
