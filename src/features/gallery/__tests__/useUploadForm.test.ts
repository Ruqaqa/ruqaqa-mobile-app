import { renderHook, act } from '@testing-library/react-native';
import { useUploadForm } from '../hooks/useUploadForm';
import type { ImagePickerAsset } from 'expo-image-picker';
import { GalleryAlbum, PickerItem, MAX_IMAGES } from '../types';

const makeAsset = (uri: string): ImagePickerAsset => ({
  uri,
  width: 1920,
  height: 1080,
  type: 'image',
  assetId: uri,
});

const makeAlbum = (id: string): GalleryAlbum => ({
  id,
  title: `Album ${id}`,
  titleEn: `Album ${id}`,
  titleAr: `ألبوم ${id}`,
  isDefault: false,
  itemCount: 0,
  coverThumbnails: [],
  createdAt: '2025-01-01T00:00:00Z',
});

const makeTag = (id: string): PickerItem => ({ id, name: `Tag ${id}` });

describe('useUploadForm', () => {
  // --- Initial state ---

  it('starts with empty state', () => {
    const { result } = renderHook(() => useUploadForm());

    expect(result.current.state.images).toEqual([]);
    expect(result.current.state.video).toBeNull();
    expect(result.current.state.albums).toEqual([]);
    expect(result.current.state.tags).toEqual([]);
    expect(result.current.state.project).toBeNull();
    expect(result.current.state.watermarkDrafts).toBeNull();
    expect(result.current.state.stage).toBe('idle');
  });

  it('hasMedia is false initially', () => {
    const { result } = renderHook(() => useUploadForm());

    expect(result.current.hasMedia).toBe(false);
  });

  it('canUpload is false initially', () => {
    const { result } = renderHook(() => useUploadForm());

    expect(result.current.canUpload).toBe(false);
  });

  // --- addImages ---

  it('adds images and returns count added', () => {
    const { result } = renderHook(() => useUploadForm());

    let added: number;
    act(() => {
      added = result.current.addImages([makeAsset('img1'), makeAsset('img2')]);
    });

    expect(added!).toBe(2);
    expect(result.current.state.images).toHaveLength(2);
    expect(result.current.hasMedia).toBe(true);
  });

  it('deduplicates images by URI', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('img1')]);
    });

    act(() => {
      result.current.addImages([makeAsset('img1'), makeAsset('img2')]);
    });

    expect(result.current.state.images).toHaveLength(2);
    expect(result.current.state.images[0].uri).toBe('img1');
    expect(result.current.state.images[1].uri).toBe('img2');
  });

  it('caps images at MAX_IMAGES', () => {
    const { result } = renderHook(() => useUploadForm());

    // Add MAX_IMAGES images
    const assets = Array.from({ length: MAX_IMAGES }, (_, i) =>
      makeAsset(`img${i}`),
    );
    act(() => {
      result.current.addImages(assets);
    });

    expect(result.current.state.images).toHaveLength(MAX_IMAGES);

    // Try to add one more
    let added: number;
    act(() => {
      added = result.current.addImages([makeAsset('overflow')]);
    });

    expect(added!).toBe(0);
    expect(result.current.state.images).toHaveLength(MAX_IMAGES);
  });

  it('truncates to remaining capacity', () => {
    const { result } = renderHook(() => useUploadForm());

    const initial = Array.from({ length: MAX_IMAGES - 2 }, (_, i) =>
      makeAsset(`img${i}`),
    );
    act(() => {
      result.current.addImages(initial);
    });

    expect(result.current.state.images).toHaveLength(MAX_IMAGES - 2);

    act(() => {
      result.current.addImages([
        makeAsset('extra1'),
        makeAsset('extra2'),
        makeAsset('extra3'),
      ]);
    });

    // Only 2 of 3 should be added (cap at MAX_IMAGES)
    expect(result.current.state.images).toHaveLength(MAX_IMAGES);
  });

  // --- removeImage ---

  it('removes image at valid index', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('a'), makeAsset('b'), makeAsset('c')]);
    });

    act(() => {
      result.current.removeImage(1);
    });

    expect(result.current.state.images).toHaveLength(2);
    expect(result.current.state.images[0].uri).toBe('a');
    expect(result.current.state.images[1].uri).toBe('c');
  });

  it('ignores out-of-bounds index', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('a')]);
    });

    act(() => {
      result.current.removeImage(5);
    });

    expect(result.current.state.images).toHaveLength(1);
  });

  it('ignores negative index', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('a')]);
    });

    act(() => {
      result.current.removeImage(-1);
    });

    expect(result.current.state.images).toHaveLength(1);
  });

  // --- setVideo ---

  it('sets video and hasMedia becomes true', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setVideo(makeAsset('video1'));
    });

    expect(result.current.state.video?.uri).toBe('video1');
    expect(result.current.hasMedia).toBe(true);
  });

  it('clears video when set to null', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setVideo(makeAsset('video1'));
    });
    act(() => {
      result.current.setVideo(null);
    });

    expect(result.current.state.video).toBeNull();
    expect(result.current.hasMedia).toBe(false);
  });

  // --- Metadata ---

  it('setAlbums updates albums', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setAlbums([makeAlbum('a1'), makeAlbum('a2')]);
    });

    expect(result.current.state.albums).toHaveLength(2);
  });

  it('setTags updates tags', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setTags([makeTag('t1'), makeTag('t2')]);
    });

    expect(result.current.state.tags).toHaveLength(2);
  });

  it('setProject updates project', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setProject({ id: 'p1', name: 'Project 1' });
    });

    expect(result.current.state.project?.id).toBe('p1');
  });

  it('setProject clears when null', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setProject({ id: 'p1', name: 'Project 1' });
    });
    act(() => {
      result.current.setProject(null);
    });

    expect(result.current.state.project).toBeNull();
  });

  // --- hasRequiredMetadata ---

  it('hasRequiredMetadata is false with no albums or tags', () => {
    const { result } = renderHook(() => useUploadForm());

    expect(result.current.hasRequiredMetadata).toBe(false);
  });

  it('hasRequiredMetadata is false with albums but no tags', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setAlbums([makeAlbum('a1')]);
    });

    expect(result.current.hasRequiredMetadata).toBe(false);
  });

  it('hasRequiredMetadata is false with tags but no albums', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setTags([makeTag('t1')]);
    });

    expect(result.current.hasRequiredMetadata).toBe(false);
  });

  it('hasRequiredMetadata is true with both albums and tags', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
    });

    expect(result.current.hasRequiredMetadata).toBe(true);
  });

  // --- canUpload ---

  it('canUpload is true with media + albums + tags in idle stage', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('img1')]);
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
    });

    expect(result.current.canUpload).toBe(true);
  });

  it('canUpload is true with video + albums + tags', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setVideo(makeAsset('video1'));
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
    });

    expect(result.current.canUpload).toBe(true);
  });

  it('canUpload is false when stage is processing', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('img1')]);
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
      result.current.setStage('processing');
    });

    expect(result.current.canUpload).toBe(false);
  });

  it('canUpload is false when stage is done', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('img1')]);
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
      result.current.setStage('done');
    });

    expect(result.current.canUpload).toBe(false);
  });

  it('canUpload is false when stage is error', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('img1')]);
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
      result.current.setStage('error');
    });

    expect(result.current.canUpload).toBe(false);
  });

  it('canUpload is false without media', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
    });

    expect(result.current.canUpload).toBe(false);
  });

  // --- Watermark drafts ---

  it('sets watermark drafts', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.setWatermarkDrafts({
        img_0: { xPct: 40, yPct: 40, widthPct: 20, opacityPct: 50, noWatermarkNeeded: false },
      });
    });

    expect(result.current.state.watermarkDrafts).not.toBeNull();
    expect(result.current.state.watermarkDrafts?.img_0).toBeDefined();
  });

  // --- Reset ---

  it('reset clears all state back to initial', () => {
    const { result } = renderHook(() => useUploadForm());

    act(() => {
      result.current.addImages([makeAsset('img1')]);
      result.current.setVideo(makeAsset('video1'));
      result.current.setAlbums([makeAlbum('a1')]);
      result.current.setTags([makeTag('t1')]);
      result.current.setProject({ id: 'p1', name: 'P1' });
      result.current.setStage('done');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.images).toEqual([]);
    expect(result.current.state.video).toBeNull();
    expect(result.current.state.albums).toEqual([]);
    expect(result.current.state.tags).toEqual([]);
    expect(result.current.state.project).toBeNull();
    expect(result.current.state.stage).toBe('idle');
    expect(result.current.hasMedia).toBe(false);
    expect(result.current.hasRequiredMetadata).toBe(false);
    expect(result.current.canUpload).toBe(false);
  });
});
