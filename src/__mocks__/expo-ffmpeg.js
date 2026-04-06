// Mock for modules/expo-ffmpeg/src
// This mock is used by Jest via moduleNameMapper to handle the relative
// import path from src/features/gallery/services/videoOptimizationService.ts

const FFmpegErrorCode = {
  CANCELLED: 'CANCELLED',
  UNKNOWN: 'UNKNOWN',
  IO_ERROR: 'IO_ERROR',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
};

module.exports = {
  execute: jest.fn().mockResolvedValue({ returnCode: 0, output: '' }),
  cancel: jest.fn(),
  getMediaInfo: jest.fn().mockResolvedValue({ width: 1920, height: 1080, duration: 60 }),
  buildWatermarkCommand: jest.fn().mockReturnValue('-i input -i logo output.mp4'),
  buildCompressCommand: jest.fn().mockReturnValue('-i input output.mp4'),
  buildExtractThumbnailCommand: jest.fn().mockReturnValue('-i input -vframes 1 thumb.jpg'),
  getPreferredEncoder: jest.fn().mockReturnValue('h264_videotoolbox'),
  getErrorCode: jest.fn().mockReturnValue('UNKNOWN'),
  FFmpegErrorCode,
};
