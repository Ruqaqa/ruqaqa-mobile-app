export type ExecutionResult = {
  returnCode: number;
  output: string;
  duration: number;
};

export type MediaInfo = {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
};

export type ProgressData = {
  frame: number;
  fps: number;
  time: number;
  speed: number;
  percentage: number;
};

export type ExpoFfmpegModuleEvents = {
  onProgress: (data: ProgressData) => void;
};

export type ExecuteOptions = {
  /** Timeout in milliseconds. Default: 300000 (5 minutes). Set to 0 to disable. */
  timeout?: number;
};

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export type WatermarkOptions = {
  position?: WatermarkPosition;
  marginX?: number;
  marginY?: number;
  opacity?: number;
  scale?: number;
  encoder?: string;
  crf?: number;
  preset?: string;
  maxWidth?: number;
  maxHeight?: number;
  /** Number of FFmpeg threads. Default: 2. */
  threads?: number;
};

export type CompressOptions = {
  encoder?: string;
  crf?: number;
  preset?: string;
  maxWidth?: number;
  maxHeight?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  /** Number of FFmpeg threads. Default: 2. */
  threads?: number;
};

/** FFmpeg error codes for common failure modes. */
export const FFmpegErrorCode = {
  SUCCESS: 0,
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  IO_ERROR: 'IO_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type FFmpegErrorCode = (typeof FFmpegErrorCode)[keyof typeof FFmpegErrorCode];
