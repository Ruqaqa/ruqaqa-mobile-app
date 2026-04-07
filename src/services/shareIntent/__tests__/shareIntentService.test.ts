/**
 * Tests for shareIntentService — validates and processes incoming files
 * from the expo-share-intent library.
 */

import { shareIntentStore } from '../shareIntentStore';
import { handleIncomingFiles } from '../shareIntentService';

beforeEach(() => {
  shareIntentStore.clear();
});

describe('handleIncomingFiles', () => {
  it('processes valid shared files into the store', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/photo.jpg',
        mimeType: 'image/jpeg',
        fileName: 'photo.jpg',
        size: 2048,
      },
    ]);

    const state = shareIntentStore.getState();
    expect(state.status).toBe('files_received');
    if (state.status === 'files_received') {
      expect(state.files).toHaveLength(1);
      expect(state.files[0].uri).toBe('file:///local/photo.jpg');
      expect(state.files[0].fileType).toBe('image');
    }
  });

  it('rejects files with invalid MIME types', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/archive.zip',
        mimeType: 'application/zip',
        fileName: 'archive.zip',
        size: 5000,
      },
    ]);

    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('accepts video files', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/movie.mp4',
        mimeType: 'video/mp4',
        fileName: 'movie.mp4',
        size: 5000,
      },
    ]);

    const state = shareIntentStore.getState();
    expect(state.status).toBe('files_received');
    if (state.status === 'files_received') {
      expect(state.files).toHaveLength(1);
      expect(state.files[0].fileType).toBe('video');
    }
  });

  it('rejects oversized files above 100 MB', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/huge.mp4',
        mimeType: 'video/mp4',
        fileName: 'huge.mp4',
        size: 101 * 1024 * 1024,
      },
    ]);

    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('accepts files up to 100 MB', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/large_video.mp4',
        mimeType: 'video/mp4',
        fileName: 'large_video.mp4',
        size: 99 * 1024 * 1024,
      },
    ]);

    const state = shareIntentStore.getState();
    expect(state.status).toBe('files_received');
  });

  it('skips files with no path', () => {
    handleIncomingFiles([
      {
        path: '',
        mimeType: 'image/jpeg',
        fileName: 'no-uri.jpg',
        size: 1024,
      },
    ]);

    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('handles mixed valid and invalid files', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/photo.jpg',
        mimeType: 'image/jpeg',
        fileName: 'photo.jpg',
        size: 1024,
      },
      {
        path: 'file:///local/movie.mp4',
        mimeType: 'video/mp4',
        fileName: 'movie.mp4',
        size: 5000,
      },
      {
        path: 'file:///local/archive.zip',
        mimeType: 'application/zip',
        fileName: 'archive.zip',
        size: 1024,
      },
    ]);

    const state = shareIntentStore.getState();
    expect(state.status).toBe('files_received');
    if (state.status === 'files_received') {
      expect(state.files).toHaveLength(2);
      expect(state.files[0].mimeType).toBe('image/jpeg');
      expect(state.files[1].mimeType).toBe('video/mp4');
    }
  });

  it('accepts PDF files as document type', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/invoice.pdf',
        mimeType: 'application/pdf',
        fileName: 'invoice.pdf',
        size: 1024,
      },
    ]);

    const state = shareIntentStore.getState();
    if (state.status === 'files_received') {
      expect(state.files[0].fileType).toBe('document');
    }
  });

  it('handles null file size gracefully', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/photo.jpg',
        mimeType: 'image/jpeg',
        fileName: 'photo.jpg',
        size: null,
      },
    ]);

    const state = shareIntentStore.getState();
    expect(state.status).toBe('files_received');
  });

  it('sanitizes filenames', () => {
    handleIncomingFiles([
      {
        path: 'file:///local/photo.jpg',
        mimeType: 'image/jpeg',
        fileName: '../../../etc/passwd',
        size: 1024,
      },
    ]);

    const state = shareIntentStore.getState();
    if (state.status === 'files_received') {
      expect(state.files[0].fileName).not.toContain('..');
      expect(state.files[0].fileName).not.toContain('/');
    }
  });

  it('ignores empty or null file arrays', () => {
    handleIncomingFiles([]);
    expect(shareIntentStore.getState().status).toBe('idle');

    handleIncomingFiles(null as any);
    expect(shareIntentStore.getState().status).toBe('idle');
  });
});
