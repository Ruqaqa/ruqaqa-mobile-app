import type {
  ExecutionResult,
  MediaInfo,
  ProgressData,
  WatermarkOptions,
  WatermarkPosition,
  CompressOptions,
  ExecuteOptions,
} from '../types';
import { FFmpegErrorCode } from '../types';

// These tests verify the type definitions are structurally correct.
// They use runtime objects that conform to the types — if the types
// change incompatibly, these tests will fail to compile.

describe('type definitions', () => {
  it('ExecutionResult has the expected shape', () => {
    const result: ExecutionResult = {
      returnCode: 0,
      output: 'success',
      duration: 1234,
    };

    expect(result.returnCode).toBe(0);
    expect(result.output).toBe('success');
    expect(result.duration).toBe(1234);
  });

  it('MediaInfo has the expected shape', () => {
    const info: MediaInfo = {
      duration: 30.5,
      width: 1920,
      height: 1080,
      codec: 'h264',
      bitrate: 5000000,
    };

    expect(info.duration).toBe(30.5);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.codec).toBe('h264');
    expect(info.bitrate).toBe(5000000);
  });

  it('ProgressData has the expected shape', () => {
    const progress: ProgressData = {
      frame: 100,
      fps: 30,
      time: 3.33,
      speed: 2.5,
      percentage: 50,
    };

    expect(progress.frame).toBe(100);
    expect(progress.fps).toBe(30);
    expect(progress.time).toBe(3.33);
    expect(progress.speed).toBe(2.5);
    expect(progress.percentage).toBe(50);
  });

  it('WatermarkPosition accepts all valid positions', () => {
    const positions: WatermarkPosition[] = [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
      'center',
    ];

    expect(positions).toHaveLength(5);
  });

  it('WatermarkOptions allows all optional fields including threads', () => {
    const full: WatermarkOptions = {
      position: 'top-left',
      marginX: 10,
      marginY: 10,
      opacity: 0.8,
      scale: 0.5,
      encoder: 'libx264',
      crf: 23,
      preset: 'medium',
      threads: 4,
    };
    const empty: WatermarkOptions = {};

    expect(full.position).toBe('top-left');
    expect(full.opacity).toBe(0.8);
    expect(full.threads).toBe(4);
    expect(empty.position).toBeUndefined();
  });

  it('CompressOptions allows all optional fields including threads', () => {
    const full: CompressOptions = {
      encoder: 'libx264',
      crf: 23,
      preset: 'medium',
      maxWidth: 1920,
      maxHeight: 1080,
      videoBitrate: '2M',
      audioBitrate: '128k',
      threads: 2,
    };
    const empty: CompressOptions = {};

    expect(full.encoder).toBe('libx264');
    expect(full.videoBitrate).toBe('2M');
    expect(full.audioBitrate).toBe('128k');
    expect(full.threads).toBe(2);
    expect(empty.encoder).toBeUndefined();
  });

  it('ExecuteOptions allows timeout field', () => {
    const withTimeout: ExecuteOptions = { timeout: 10000 };
    const empty: ExecuteOptions = {};

    expect(withTimeout.timeout).toBe(10000);
    expect(empty.timeout).toBeUndefined();
  });

  it('FFmpegErrorCode has all expected constant values', () => {
    expect(FFmpegErrorCode.SUCCESS).toBe(0);
    expect(FFmpegErrorCode.CANCELLED).toBe('CANCELLED');
    expect(FFmpegErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(FFmpegErrorCode.OUT_OF_MEMORY).toBe('OUT_OF_MEMORY');
    expect(FFmpegErrorCode.INVALID_ARGUMENT).toBe('INVALID_ARGUMENT');
    expect(FFmpegErrorCode.IO_ERROR).toBe('IO_ERROR');
    expect(FFmpegErrorCode.UNKNOWN).toBe('UNKNOWN');
  });

  it('FFmpegErrorCode has exactly 7 entries', () => {
    expect(Object.keys(FFmpegErrorCode)).toHaveLength(7);
  });
});
