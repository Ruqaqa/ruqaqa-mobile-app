import type { WatermarkOptions, WatermarkPosition, CompressOptions } from './types';

const ALLOWED_ENCODERS = new Set([
  'libx264', 'h264_videotoolbox', 'h264_mediacodec', 'mjpeg', 'png',
]);

const ALLOWED_PRESETS = new Set([
  'ultrafast', 'superfast', 'veryfast', 'faster', 'fast',
  'medium', 'slow', 'slower', 'veryslow', 'placebo',
]);

/** Validate encoder against the allowlist. */
function validateEncoder(value: string): string {
  if (!ALLOWED_ENCODERS.has(value)) {
    throw new Error(`Invalid encoder: "${value}" is not allowed. Allowed: ${[...ALLOWED_ENCODERS].join(', ')}`);
  }
  return value;
}

/** Validate preset against the allowlist. */
function validatePreset(value: string): string {
  if (!ALLOWED_PRESETS.has(value)) {
    throw new Error(`Invalid preset: "${value}" is not allowed. Allowed: ${[...ALLOWED_PRESETS].join(', ')}`);
  }
  return value;
}

/** Validate that a string option contains only safe alphanumeric/underscore characters. */
function validateOption(name: string, value: string): string {
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    throw new Error(`Invalid ${name}: "${value}" contains disallowed characters`);
  }
  return value;
}

const POSITION_MAP: Record<WatermarkPosition, string> = {
  'top-left': 'overlay=x={mx}:y={my}',
  'top-right': 'overlay=x=main_w-overlay_w-{mx}:y={my}',
  'bottom-left': 'overlay=x={mx}:y=main_h-overlay_h-{my}',
  'bottom-right': 'overlay=x=main_w-overlay_w-{mx}:y=main_h-overlay_h-{my}',
  'center': 'overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2',
};

export function buildWatermarkCommand(
  inputPath: string,
  logoPath: string,
  outputPath: string,
  options: WatermarkOptions = {},
): string {
  const {
    position = 'bottom-right',
    marginX = 10,
    marginY = 10,
    opacity,
    scale,
    encoder = 'libx264',
    crf = 23,
    preset = 'medium',
    maxWidth,
    maxHeight,
    threads = 2,
  } = options;

  validateEncoder(encoder);
  validatePreset(preset);

  const parts: string[] = [
    `-threads ${threads}`,
    `-i "${inputPath}"`,
    `-i "${logoPath}"`,
  ];

  let filterComplex: string;
  const overlayExpr = POSITION_MAP[position]
    .replace(/{mx}/g, String(marginX))
    .replace(/{my}/g, String(marginY));

  // Build the filter graph step by step
  const filterSteps: string[] = [];
  let videoLabel = '[0:v]';
  let logoLabel = '[1:v]';

  // When maxWidth/maxHeight are provided, scale the video first
  if (maxWidth != null || maxHeight != null) {
    const w = maxWidth ?? -2;
    const h = maxHeight ?? -2;
    filterSteps.push(
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[scaled_v]`,
    );
    videoLabel = '[scaled_v]';
  }

  if (scale != null) {
    filterSteps.push(`[1:v]scale=iw*${scale}:ih*${scale}[scaled]`);
    logoLabel = '[scaled]';
  }

  if (opacity != null && opacity < 1) {
    const inputForOpacity = logoLabel === '[1:v]' ? '[1:v]' : logoLabel;
    const outputLabel = '[logo_alpha]';
    filterSteps.push(`${inputForOpacity}format=rgba,colorchannelmixer=aa=${opacity}${outputLabel}`);
    logoLabel = outputLabel;
  }

  filterSteps.push(`${videoLabel}${logoLabel}${overlayExpr}`);
  filterComplex = filterSteps.join(';');

  parts.push(`-filter_complex "${filterComplex}"`);
  parts.push(`-c:v ${encoder}`);

  const isHardwareEncoder = encoder.includes('mediacodec') || encoder.includes('videotoolbox');
  if (!isHardwareEncoder) {
    parts.push(`-crf ${crf}`);
    parts.push(`-preset ${preset}`);
  }

  parts.push('-c:a copy');
  parts.push(`-y "${outputPath}"`);

  return parts.join(' ');
}

export function buildCompressCommand(
  inputPath: string,
  outputPath: string,
  options: CompressOptions = {},
): string {
  const {
    encoder = 'libx264',
    crf = 23,
    preset = 'medium',
    maxWidth,
    maxHeight,
    videoBitrate,
    audioBitrate,
    threads = 2,
  } = options;

  validateEncoder(encoder);
  validatePreset(preset);
  if (videoBitrate != null) validateOption('videoBitrate', videoBitrate);
  if (audioBitrate != null) validateOption('audioBitrate', audioBitrate);

  const parts: string[] = [
    `-threads ${threads}`,
    `-i "${inputPath}"`,
  ];

  if (maxWidth != null || maxHeight != null) {
    // Use force_original_aspect_ratio=decrease to only scale down (never up).
    // The second scale ensures even dimensions (required by most encoders)
    // by rounding up to the nearest multiple of 2 using trunc().
    const w = maxWidth ?? -2;
    const h = maxHeight ?? -2;
    parts.push(`-vf "scale=${w}:${h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"`);
  }

  parts.push(`-c:v ${encoder}`);

  // Hardware encoders (mediacodec, videotoolbox) don't support -crf or -preset.
  // They use -b:v for bitrate control.
  const isHardwareEncoder = encoder.includes('mediacodec') || encoder.includes('videotoolbox');

  if (videoBitrate != null) {
    parts.push(`-b:v ${videoBitrate}`);
  } else if (!isHardwareEncoder) {
    parts.push(`-crf ${crf}`);
  }

  if (!isHardwareEncoder) {
    parts.push(`-preset ${preset}`);
  }

  if (audioBitrate != null) {
    parts.push(`-c:a aac -b:a ${audioBitrate}`);
  } else {
    parts.push('-c:a copy');
  }

  parts.push(`-y "${outputPath}"`);

  return parts.join(' ');
}

export function buildExtractThumbnailCommand(
  videoPath: string,
  outputPath: string,
  timeSeconds: number = 1,
): string {
  // -ss before -i for fast seeking. -f image2 explicitly sets the image output format.
  return `-ss ${timeSeconds} -i "${videoPath}" -vframes 1 -f image2 -y "${outputPath}"`;
}
