import { buildWatermarkCommand, buildCompressCommand, buildExtractThumbnailCommand } from '../commands';

describe('buildWatermarkCommand', () => {
  const input = '/path/to/input.mp4';
  const logo = '/path/to/logo.png';
  const output = '/path/to/output.mp4';

  it('generates command with default options', () => {
    const cmd = buildWatermarkCommand(input, logo, output);

    expect(cmd).toContain(`-i "${input}"`);
    expect(cmd).toContain(`-i "${logo}"`);
    expect(cmd).toContain('-filter_complex');
    expect(cmd).toContain('overlay=');
    expect(cmd).toContain('-c:v libx264');
    expect(cmd).toContain('-crf 23');
    expect(cmd).toContain('-preset medium');
    expect(cmd).toContain('-c:a copy');
    expect(cmd).toContain(`-y "${output}"`);
  });

  it('uses bottom-right position by default', () => {
    const cmd = buildWatermarkCommand(input, logo, output);

    expect(cmd).toContain('main_w-overlay_w-10');
    expect(cmd).toContain('main_h-overlay_h-10');
  });

  it('applies top-left position', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { position: 'top-left' });

    expect(cmd).toContain('overlay=x=10:y=10');
    expect(cmd).not.toContain('main_w');
    expect(cmd).not.toContain('main_h');
  });

  it('applies top-right position', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { position: 'top-right' });

    expect(cmd).toContain('main_w-overlay_w-10');
    expect(cmd).toContain('y=10');
    expect(cmd).not.toContain('main_h-overlay_h');
  });

  it('applies bottom-left position', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { position: 'bottom-left' });

    expect(cmd).toContain('x=10');
    expect(cmd).toContain('main_h-overlay_h-10');
    expect(cmd).not.toContain('main_w-overlay_w');
  });

  it('applies custom margins', () => {
    const cmd = buildWatermarkCommand(input, logo, output, {
      position: 'top-left',
      marginX: 20,
      marginY: 30,
    });

    expect(cmd).toContain('overlay=x=20:y=30');
  });

  it('includes scale filter when scale option is provided', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { scale: 0.5 });

    expect(cmd).toContain('[1:v]scale=iw*0.5:ih*0.5[scaled]');
    expect(cmd).toContain('[0:v][scaled]');
  });

  it('omits scale filter when scale is not provided', () => {
    const cmd = buildWatermarkCommand(input, logo, output);

    expect(cmd).toContain('[0:v][1:v]');
    expect(cmd).not.toContain('[scaled]');
  });

  it('uses custom encoder', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { encoder: 'h264_videotoolbox' });

    expect(cmd).toContain('-c:v h264_videotoolbox');
  });

  it('uses custom crf', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { crf: 18 });

    expect(cmd).toContain('-crf 18');
  });

  it('uses custom preset', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { preset: 'fast' });

    expect(cmd).toContain('-preset fast');
  });

  it('handles paths with spaces', () => {
    const spaceyInput = '/path/to/my video.mp4';
    const spaceyLogo = '/path/to/my logo.png';
    const spaceyOutput = '/path/to/my output.mp4';
    const cmd = buildWatermarkCommand(spaceyInput, spaceyLogo, spaceyOutput);

    expect(cmd).toContain(`-i "${spaceyInput}"`);
    expect(cmd).toContain(`-i "${spaceyLogo}"`);
    expect(cmd).toContain(`-y "${spaceyOutput}"`);
  });

  it('combines all custom options together', () => {
    const cmd = buildWatermarkCommand(input, logo, output, {
      position: 'top-right',
      marginX: 15,
      marginY: 25,
      scale: 0.3,
      encoder: 'h264_mediacodec',
      crf: 20,
      preset: 'fast',
    });

    expect(cmd).toContain('-c:v h264_mediacodec');
    // Hardware encoder omits -crf and -preset
    expect(cmd).not.toContain('-crf');
    expect(cmd).not.toContain('-preset');
    expect(cmd).toContain('[1:v]scale=iw*0.3:ih*0.3[scaled]');
    expect(cmd).toContain('main_w-overlay_w-15');
    expect(cmd).toContain('y=25');
  });

  it('handles paths with special characters', () => {
    const specialInput = "/path/to/video (1)'s copy.mp4";
    const specialLogo = '/path/to/logo[2].png';
    const specialOutput = '/path/to/output & result.mp4';
    const cmd = buildWatermarkCommand(specialInput, specialLogo, specialOutput);

    expect(cmd).toContain(`-i "${specialInput}"`);
    expect(cmd).toContain(`-i "${specialLogo}"`);
    expect(cmd).toContain(`-y "${specialOutput}"`);
  });

  it('handles zero margins', () => {
    const cmd = buildWatermarkCommand(input, logo, output, {
      position: 'top-left',
      marginX: 0,
      marginY: 0,
    });

    expect(cmd).toContain('overlay=x=0:y=0');
  });

  it('handles scale of 1 (no scaling)', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { scale: 1 });

    expect(cmd).toContain('[1:v]scale=iw*1:ih*1[scaled]');
  });

  it('handles crf of 0 (lossless)', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { crf: 0 });

    expect(cmd).toContain('-crf 0');
  });

  it('places input before logo in the command', () => {
    const cmd = buildWatermarkCommand(input, logo, output);
    const inputIdx = cmd.indexOf(`-i "${input}"`);
    const logoIdx = cmd.indexOf(`-i "${logo}"`);

    expect(inputIdx).toBeLessThan(logoIdx);
  });

  it('places -y flag before output path for overwrite', () => {
    const cmd = buildWatermarkCommand(input, logo, output);

    expect(cmd).toContain(`-y "${output}"`);
  });

  it('applies center position', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { position: 'center' });

    expect(cmd).toContain('(main_w-overlay_w)/2');
    expect(cmd).toContain('(main_h-overlay_h)/2');
  });

  it('applies opacity filter', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { opacity: 0.5 });

    expect(cmd).toContain('format=rgba,colorchannelmixer=aa=0.5');
  });

  it('combines scale and opacity', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { scale: 0.3, opacity: 0.7 });

    expect(cmd).toContain('[1:v]scale=iw*0.3:ih*0.3[scaled]');
    expect(cmd).toContain('[scaled]format=rgba,colorchannelmixer=aa=0.7[logo_alpha]');
    expect(cmd).toContain('[0:v][logo_alpha]');
  });

  it('does not apply opacity filter when opacity is 1', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { opacity: 1 });

    expect(cmd).not.toContain('colorchannelmixer');
  });

  it('scales video before overlay when maxWidth is provided', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { maxWidth: 1280 });

    expect(cmd).toContain('scale=1280:-2:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('trunc(iw/2)*2:trunc(ih/2)*2[scaled_v]');
    expect(cmd).toContain('[scaled_v][1:v]overlay=');
  });

  it('scales video before overlay when maxHeight is provided', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { maxHeight: 720 });

    expect(cmd).toContain('scale=-2:720:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('[scaled_v]');
    expect(cmd).toContain('[scaled_v][1:v]overlay=');
  });

  it('scales video before overlay when both maxWidth and maxHeight are provided', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { maxWidth: 1280, maxHeight: 720 });

    expect(cmd).toContain('scale=1280:720:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('[scaled_v]');
    expect(cmd).toContain('[scaled_v][1:v]overlay=');
  });

  it('does not scale video when maxWidth/maxHeight are not provided', () => {
    const cmd = buildWatermarkCommand(input, logo, output);

    expect(cmd).not.toContain('[scaled_v]');
    expect(cmd).toContain('[0:v][1:v]overlay=');
  });

  it('combines video scaling with logo scaling and opacity', () => {
    const cmd = buildWatermarkCommand(input, logo, output, {
      maxWidth: 1280,
      maxHeight: 720,
      scale: 0.3,
      opacity: 0.5,
      position: 'bottom-right',
    });

    expect(cmd).toContain('[0:v]scale=1280:720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[scaled_v]');
    expect(cmd).toContain('[1:v]scale=iw*0.3:ih*0.3[scaled]');
    expect(cmd).toContain('[scaled]format=rgba,colorchannelmixer=aa=0.5[logo_alpha]');
    expect(cmd).toContain('[scaled_v][logo_alpha]overlay=');
  });
});

describe('buildCompressCommand', () => {
  const input = '/path/to/input.mp4';
  const output = '/path/to/output.mp4';

  it('generates command with default options', () => {
    const cmd = buildCompressCommand(input, output);

    expect(cmd).toContain(`-i "${input}"`);
    expect(cmd).toContain('-c:v libx264');
    expect(cmd).toContain('-crf 23');
    expect(cmd).toContain('-preset medium');
    expect(cmd).toContain('-c:a copy');
    expect(cmd).toContain(`-y "${output}"`);
  });

  it('does not include scale filter by default', () => {
    const cmd = buildCompressCommand(input, output);

    expect(cmd).not.toContain('-vf');
    expect(cmd).not.toContain('scale=');
  });

  it('applies maxWidth scale filter', () => {
    const cmd = buildCompressCommand(input, output, { maxWidth: 1280 });

    expect(cmd).toContain('-vf');
    expect(cmd).toContain('scale=1280:-2:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('trunc(iw/2)*2:trunc(ih/2)*2');
  });

  it('applies maxHeight scale filter', () => {
    const cmd = buildCompressCommand(input, output, { maxHeight: 720 });

    expect(cmd).toContain('-vf');
    expect(cmd).toContain('scale=-2:720:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('trunc(iw/2)*2:trunc(ih/2)*2');
  });

  it('applies both maxWidth and maxHeight', () => {
    const cmd = buildCompressCommand(input, output, { maxWidth: 1280, maxHeight: 720 });

    expect(cmd).toContain('scale=1280:720:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('trunc(iw/2)*2:trunc(ih/2)*2');
  });

  it('uses custom encoder', () => {
    const cmd = buildCompressCommand(input, output, { encoder: 'h264_videotoolbox' });

    expect(cmd).toContain('-c:v h264_videotoolbox');
  });

  it('uses custom crf and preset', () => {
    const cmd = buildCompressCommand(input, output, { crf: 28, preset: 'ultrafast' });

    expect(cmd).toContain('-crf 28');
    expect(cmd).toContain('-preset ultrafast');
  });

  it('handles paths with spaces', () => {
    const spaceyInput = '/path/to/my video.mp4';
    const spaceyOutput = '/path/to/my output.mp4';
    const cmd = buildCompressCommand(spaceyInput, spaceyOutput);

    expect(cmd).toContain(`-i "${spaceyInput}"`);
    expect(cmd).toContain(`-y "${spaceyOutput}"`);
  });

  it('combines all custom options together', () => {
    const cmd = buildCompressCommand(input, output, {
      encoder: 'h264_mediacodec',
      crf: 20,
      preset: 'fast',
      maxWidth: 1920,
      maxHeight: 1080,
    });

    expect(cmd).toContain('-c:v h264_mediacodec');
    // Hardware encoder omits -crf and -preset
    expect(cmd).not.toContain('-crf');
    expect(cmd).not.toContain('-preset');
    expect(cmd).toContain('scale=1920:1080:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('trunc(iw/2)*2:trunc(ih/2)*2');
  });

  it('handles paths with special characters', () => {
    const specialInput = "/path/to/video (1)'s copy.mp4";
    const specialOutput = '/path/to/output & result.mp4';
    const cmd = buildCompressCommand(specialInput, specialOutput);

    expect(cmd).toContain(`-i "${specialInput}"`);
    expect(cmd).toContain(`-y "${specialOutput}"`);
  });

  it('handles crf of 0 (lossless)', () => {
    const cmd = buildCompressCommand(input, output, { crf: 0 });

    expect(cmd).toContain('-crf 0');
  });

  it('handles very large dimensions', () => {
    const cmd = buildCompressCommand(input, output, { maxWidth: 7680, maxHeight: 4320 });

    expect(cmd).toContain('scale=7680:4320:force_original_aspect_ratio=decrease');
    expect(cmd).toContain('trunc(iw/2)*2:trunc(ih/2)*2');
  });

  it('places -y flag before output for overwrite', () => {
    const cmd = buildCompressCommand(input, output);

    expect(cmd).toContain(`-y "${output}"`);
  });

  it('uses videoBitrate instead of crf when provided', () => {
    const cmd = buildCompressCommand(input, output, { videoBitrate: '2M' });

    expect(cmd).toContain('-b:v 2M');
    expect(cmd).not.toContain('-crf');
  });

  it('uses audioBitrate with aac codec when provided', () => {
    const cmd = buildCompressCommand(input, output, { audioBitrate: '128k' });

    expect(cmd).toContain('-c:a aac -b:a 128k');
    expect(cmd).not.toContain('-c:a copy');
  });

  it('defaults to -c:a copy when no audioBitrate', () => {
    const cmd = buildCompressCommand(input, output);

    expect(cmd).toContain('-c:a copy');
    expect(cmd).not.toContain('-b:a');
  });
});

describe('buildExtractThumbnailCommand', () => {
  it('generates command with default time', () => {
    const cmd = buildExtractThumbnailCommand('/video.mp4', '/thumb.jpg');

    expect(cmd).toBe('-ss 1 -i "/video.mp4" -vframes 1 -f image2 -y "/thumb.jpg"');
  });

  it('uses custom time', () => {
    const cmd = buildExtractThumbnailCommand('/video.mp4', '/thumb.jpg', 5.5);

    expect(cmd).toContain('-ss 5.5');
  });

  it('uses time of 0', () => {
    const cmd = buildExtractThumbnailCommand('/video.mp4', '/thumb.jpg', 0);

    expect(cmd).toContain('-ss 0');
  });

  it('handles paths with spaces', () => {
    const cmd = buildExtractThumbnailCommand('/my video.mp4', '/my thumb.jpg');

    expect(cmd).toContain('-i "/my video.mp4"');
    expect(cmd).toContain('-y "/my thumb.jpg"');
  });
});

describe('command builder security: encoder validation', () => {
  const input = '/path/to/input.mp4';
  const logo = '/path/to/logo.png';
  const output = '/path/to/output.mp4';

  it('accepts all allowed encoders for watermark', () => {
    const allowedEncoders = ['libx264', 'h264_videotoolbox', 'h264_mediacodec', 'mjpeg', 'png'];
    for (const encoder of allowedEncoders) {
      expect(() => buildWatermarkCommand(input, logo, output, { encoder })).not.toThrow();
    }
  });

  it('accepts all allowed encoders for compress', () => {
    const allowedEncoders = ['libx264', 'h264_videotoolbox', 'h264_mediacodec', 'mjpeg', 'png'];
    for (const encoder of allowedEncoders) {
      expect(() => buildCompressCommand(input, output, { encoder })).not.toThrow();
    }
  });

  it('rejects unknown encoder in watermark command', () => {
    expect(() =>
      buildWatermarkCommand(input, logo, output, { encoder: 'evil_codec' }),
    ).toThrow('Invalid encoder');
  });

  it('rejects unknown encoder in compress command', () => {
    expect(() =>
      buildCompressCommand(input, output, { encoder: 'evil_codec' }),
    ).toThrow('Invalid encoder');
  });

  it('rejects encoder containing shell injection characters', () => {
    expect(() =>
      buildWatermarkCommand(input, logo, output, { encoder: 'libx264; rm -rf /' }),
    ).toThrow('Invalid encoder');
  });

  it('rejects encoder with backtick injection', () => {
    expect(() =>
      buildCompressCommand(input, output, { encoder: '`whoami`' }),
    ).toThrow('Invalid encoder');
  });

  it('rejects encoder with $() command substitution', () => {
    expect(() =>
      buildCompressCommand(input, output, { encoder: '$(cat /etc/passwd)' }),
    ).toThrow('Invalid encoder');
  });
});

describe('command builder security: preset validation', () => {
  const input = '/path/to/input.mp4';
  const logo = '/path/to/logo.png';
  const output = '/path/to/output.mp4';

  it('accepts all valid presets for watermark', () => {
    const validPresets = [
      'ultrafast', 'superfast', 'veryfast', 'faster', 'fast',
      'medium', 'slow', 'slower', 'veryslow', 'placebo',
    ];
    for (const preset of validPresets) {
      expect(() => buildWatermarkCommand(input, logo, output, { preset })).not.toThrow();
    }
  });

  it('accepts all valid presets for compress', () => {
    const validPresets = [
      'ultrafast', 'superfast', 'veryfast', 'faster', 'fast',
      'medium', 'slow', 'slower', 'veryslow', 'placebo',
    ];
    for (const preset of validPresets) {
      expect(() => buildCompressCommand(input, output, { preset })).not.toThrow();
    }
  });

  it('rejects invalid preset in watermark command', () => {
    expect(() =>
      buildWatermarkCommand(input, logo, output, { preset: 'malicious' }),
    ).toThrow('Invalid preset');
  });

  it('rejects invalid preset in compress command', () => {
    expect(() =>
      buildCompressCommand(input, output, { preset: 'malicious' }),
    ).toThrow('Invalid preset');
  });

  it('rejects preset with shell injection', () => {
    expect(() =>
      buildCompressCommand(input, output, { preset: 'fast; rm -rf /' }),
    ).toThrow('Invalid preset');
  });
});

describe('command builder security: bitrate validation', () => {
  const input = '/path/to/input.mp4';
  const output = '/path/to/output.mp4';

  it('accepts valid videoBitrate values', () => {
    expect(() => buildCompressCommand(input, output, { videoBitrate: '2M' })).not.toThrow();
    expect(() => buildCompressCommand(input, output, { videoBitrate: '5000k' })).not.toThrow();
    expect(() => buildCompressCommand(input, output, { videoBitrate: '128000' })).not.toThrow();
  });

  it('accepts valid audioBitrate values', () => {
    expect(() => buildCompressCommand(input, output, { audioBitrate: '128k' })).not.toThrow();
    expect(() => buildCompressCommand(input, output, { audioBitrate: '192k' })).not.toThrow();
  });

  it('rejects videoBitrate with shell injection', () => {
    expect(() =>
      buildCompressCommand(input, output, { videoBitrate: '2M; rm -rf /' }),
    ).toThrow('Invalid videoBitrate');
  });

  it('rejects audioBitrate with shell injection', () => {
    expect(() =>
      buildCompressCommand(input, output, { audioBitrate: '128k && cat /etc/passwd' }),
    ).toThrow('Invalid audioBitrate');
  });

  it('rejects videoBitrate with spaces', () => {
    expect(() =>
      buildCompressCommand(input, output, { videoBitrate: '2 M' }),
    ).toThrow('Invalid videoBitrate');
  });

  it('rejects audioBitrate with backtick injection', () => {
    expect(() =>
      buildCompressCommand(input, output, { audioBitrate: '`whoami`' }),
    ).toThrow('Invalid audioBitrate');
  });
});

describe('command builder: thread count option', () => {
  const input = '/path/to/input.mp4';
  const logo = '/path/to/logo.png';
  const output = '/path/to/output.mp4';

  it('uses default thread count of 2 for watermark', () => {
    const cmd = buildWatermarkCommand(input, logo, output);

    expect(cmd).toContain('-threads 2');
  });

  it('uses default thread count of 2 for compress', () => {
    const cmd = buildCompressCommand(input, output);

    expect(cmd).toContain('-threads 2');
  });

  it('passes custom thread count for watermark', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { threads: 4 });

    expect(cmd).toContain('-threads 4');
  });

  it('passes custom thread count for compress', () => {
    const cmd = buildCompressCommand(input, output, { threads: 1 });

    expect(cmd).toContain('-threads 1');
  });

  it('places -threads before -i in watermark command', () => {
    const cmd = buildWatermarkCommand(input, logo, output, { threads: 3 });
    const threadsIdx = cmd.indexOf('-threads 3');
    const inputIdx = cmd.indexOf(`-i "${input}"`);

    expect(threadsIdx).toBeLessThan(inputIdx);
  });

  it('places -threads before -i in compress command', () => {
    const cmd = buildCompressCommand(input, output, { threads: 3 });
    const threadsIdx = cmd.indexOf('-threads 3');
    const inputIdx = cmd.indexOf(`-i "${input}"`);

    expect(threadsIdx).toBeLessThan(inputIdx);
  });
});

describe('command builder: paths with injection attempts', () => {
  const input = '/path/to/input.mp4';
  const logo = '/path/to/logo.png';
  const output = '/path/to/output.mp4';

  it('wraps paths in double quotes to prevent shell splitting', () => {
    const maliciousInput = '/path/to/; rm -rf /; echo .mp4';
    const cmd = buildWatermarkCommand(maliciousInput, logo, output);

    // The malicious path should be wrapped in quotes, not split by shell
    expect(cmd).toContain(`-i "${maliciousInput}"`);
  });

  it('handles path with backtick injection attempt', () => {
    const maliciousInput = '/path/to/`whoami`.mp4';
    const cmd = buildCompressCommand(maliciousInput, output);

    expect(cmd).toContain(`-i "${maliciousInput}"`);
  });

  it('handles path with $() command substitution attempt', () => {
    const maliciousOutput = '/path/to/$(cat /etc/passwd).mp4';
    const cmd = buildCompressCommand(input, maliciousOutput);

    expect(cmd).toContain(`-y "${maliciousOutput}"`);
  });

  it('handles path with newline injection attempt', () => {
    const maliciousInput = '/path/to/video\n-i /etc/passwd\n.mp4';
    const cmd = buildCompressCommand(maliciousInput, output);

    expect(cmd).toContain(`-i "${maliciousInput}"`);
  });

  it('handles path with double quote character (embedded in quoted path)', () => {
    const inputWithQuote = '/path/to/video"test.mp4';
    const cmd = buildCompressCommand(inputWithQuote, output);

    // The path is placed in quotes; verify it's at least present in the command
    expect(cmd).toContain(inputWithQuote);
  });

  it('handles path with pipe injection attempt', () => {
    const maliciousInput = '/path/to/video.mp4 | cat /etc/passwd';
    const cmd = buildCompressCommand(maliciousInput, output);

    expect(cmd).toContain(`-i "${maliciousInput}"`);
  });
});
