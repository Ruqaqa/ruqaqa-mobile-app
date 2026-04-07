import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';
import { MAX_IMAGES } from '../types';
import { convertSharedFilesToUploadAssets } from '../utils/gallerySharedFilesAdapter';

// --- Helpers ---

function makeSharedImage(overrides: Partial<SharedFile> = {}): SharedFile {
  return {
    uri: 'file:///data/photo.jpg',
    mimeType: 'image/jpeg',
    fileType: 'image',
    fileName: 'photo.jpg',
    fileSize: 1024,
    ...overrides,
  };
}

function makeSharedVideo(overrides: Partial<SharedFile> = {}): SharedFile {
  return {
    uri: 'file:///data/video.mp4',
    mimeType: 'video/mp4',
    fileType: 'video',
    fileName: 'video.mp4',
    fileSize: 50_000_000,
    ...overrides,
  };
}

// --- Tests ---

describe('convertSharedFilesToUploadAssets', () => {
  // --- Image conversion ---

  it('converts a single shared image to ImagePickerAsset format', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedImage({ uri: 'file:///photos/pic.jpg' }),
    ]);

    expect(result.images).toHaveLength(1);
    expect(result.images[0].uri).toBe('file:///photos/pic.jpg');
    expect(result.images[0].type).toBe('image');
  });

  it('converts multiple shared images', () => {
    const files = Array.from({ length: 3 }, (_, i) =>
      makeSharedImage({ uri: `file:///photos/pic_${i}.jpg`, fileName: `pic_${i}.jpg` }),
    );

    const result = convertSharedFilesToUploadAssets(files);

    expect(result.images).toHaveLength(3);
    expect(result.video).toBeNull();
  });

  // --- Video conversion ---

  it('converts a shared video to video asset', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedVideo({ uri: 'file:///videos/clip.mp4' }),
    ]);

    expect(result.video).not.toBeNull();
    expect(result.video!.uri).toBe('file:///videos/clip.mp4');
    expect(result.video!.type).toBe('video');
    expect(result.images).toHaveLength(0);
  });

  it('detects video by MIME type video/mp4', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedVideo({ mimeType: 'video/mp4' }),
    ]);

    expect(result.video).not.toBeNull();
  });

  it('detects video by MIME type video/quicktime', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedVideo({ mimeType: 'video/quicktime' }),
    ]);

    expect(result.video).not.toBeNull();
  });

  it('detects video by MIME type video/x-matroska', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedVideo({ mimeType: 'video/x-matroska' }),
    ]);

    expect(result.video).not.toBeNull();
  });

  // --- Mixed images and videos ---

  it('separates images and video from mixed input', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedImage({ uri: 'file:///photos/a.jpg' }),
      makeSharedVideo({ uri: 'file:///videos/clip.mp4' }),
      makeSharedImage({ uri: 'file:///photos/b.png', mimeType: 'image/png' }),
    ]);

    expect(result.images).toHaveLength(2);
    expect(result.video).not.toBeNull();
    expect(result.video!.uri).toBe('file:///videos/clip.mp4');
  });

  // --- MAX_VIDEO = 1 enforcement ---

  it('takes only the first video when multiple videos are shared', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedVideo({ uri: 'file:///videos/first.mp4' }),
      makeSharedVideo({ uri: 'file:///videos/second.mp4' }),
    ]);

    expect(result.video).not.toBeNull();
    expect(result.video!.uri).toBe('file:///videos/first.mp4');
    expect(result.droppedCount).toBe(1);
  });

  // --- MAX_IMAGES enforcement ---

  it('caps images at MAX_IMAGES', () => {
    const files = Array.from({ length: MAX_IMAGES + 5 }, (_, i) =>
      makeSharedImage({ uri: `file:///photos/pic_${i}.jpg`, fileName: `pic_${i}.jpg` }),
    );

    const result = convertSharedFilesToUploadAssets(files);

    expect(result.images).toHaveLength(MAX_IMAGES);
    expect(result.droppedCount).toBe(5);
  });

  // --- Empty input ---

  it('returns empty arrays for empty input', () => {
    const result = convertSharedFilesToUploadAssets([]);

    expect(result.images).toHaveLength(0);
    expect(result.video).toBeNull();
    expect(result.droppedCount).toBe(0);
  });

  // --- droppedCount reporting ---

  it('reports zero droppedCount when within limits', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedImage(),
      makeSharedImage({ uri: 'file:///photos/b.jpg' }),
    ]);

    expect(result.droppedCount).toBe(0);
  });

  // --- MIME type classification ---

  it('classifies image/heic as image', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedImage({ mimeType: 'image/heic' }),
    ]);

    expect(result.images).toHaveLength(1);
    expect(result.video).toBeNull();
  });

  it('classifies image/webp as image', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedImage({ mimeType: 'image/webp' }),
    ]);

    expect(result.images).toHaveLength(1);
  });

  // --- Invalid/missing data ---

  it('drops files with empty URI', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedImage({ uri: '' }),
      makeSharedImage({ uri: 'file:///photos/valid.jpg' }),
    ]);

    expect(result.images).toHaveLength(1);
    expect(result.droppedCount).toBe(1);
  });

  it('drops files with unsupported MIME type', () => {
    const result = convertSharedFilesToUploadAssets([
      makeSharedImage({ mimeType: 'application/pdf' }),
    ]);

    expect(result.images).toHaveLength(0);
    expect(result.video).toBeNull();
    expect(result.droppedCount).toBe(1);
  });
});
