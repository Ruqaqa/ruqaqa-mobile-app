import { useState, useCallback, useMemo } from 'react';
import type { ImagePickerAsset } from 'expo-image-picker';
import {
  GalleryAlbum,
  PickerItem,
  WatermarkDraft,
  UploadStage,
  MAX_IMAGES,
} from '../types';

export interface UploadFormState {
  /** Selected images (up to MAX_IMAGES). */
  images: ImagePickerAsset[];
  /** Selected video (at most 1). */
  video: ImagePickerAsset | null;
  /** Selected albums (required, multi-select). */
  albums: GalleryAlbum[];
  /** Selected tags (required, multi-select). */
  tags: PickerItem[];
  /** Selected project (optional, single-select). */
  project: PickerItem | null;
  /** Watermark drafts keyed by item ID (set after watermark editor). */
  watermarkDrafts: Record<string, WatermarkDraft> | null;
  /** Current upload stage. */
  stage: UploadStage;
}

export interface UseUploadFormReturn {
  state: UploadFormState;

  // Media actions
  addImages: (assets: ImagePickerAsset[]) => number;
  removeImage: (index: number) => void;
  setVideo: (asset: ImagePickerAsset | null) => void;

  // Metadata actions
  setAlbums: (albums: GalleryAlbum[]) => void;
  setTags: (tags: PickerItem[]) => void;
  setProject: (project: PickerItem | null) => void;

  // Watermark
  setWatermarkDrafts: (drafts: Record<string, WatermarkDraft> | null) => void;

  // Stage
  setStage: (stage: UploadStage) => void;

  // Computed flags
  hasMedia: boolean;
  hasRequiredMetadata: boolean;
  canUpload: boolean;

  // Reset
  reset: () => void;
}

const INITIAL_STATE: UploadFormState = {
  images: [],
  video: null,
  albums: [],
  tags: [],
  project: null,
  watermarkDrafts: null,
  stage: 'idle',
};

/**
 * Manages the upload form state: selected media, metadata, and computed flags.
 * Designed to be consumed by the upload screen UI and share intent integration.
 */
export function useUploadForm(): UseUploadFormReturn {
  const [state, setState] = useState<UploadFormState>(INITIAL_STATE);

  const addImages = useCallback((assets: ImagePickerAsset[]): number => {
    let added = 0;
    setState((prev) => {
      const existingUris = new Set(prev.images.map((img) => img.uri));
      const unique = assets.filter((a) => !existingUris.has(a.uri));
      const remaining = MAX_IMAGES - prev.images.length;
      if (remaining <= 0) return prev;
      const toAdd = unique.slice(0, remaining);
      added = toAdd.length;
      if (toAdd.length === 0) return prev;
      return { ...prev, images: [...prev.images, ...toAdd] };
    });
    return added;
  }, []);

  const removeImage = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.images.length) return prev;
      const images = [...prev.images];
      images.splice(index, 1);
      return { ...prev, images };
    });
  }, []);

  const setVideo = useCallback((asset: ImagePickerAsset | null) => {
    setState((prev) => ({ ...prev, video: asset }));
  }, []);

  const setAlbums = useCallback((albums: GalleryAlbum[]) => {
    setState((prev) => ({ ...prev, albums }));
  }, []);

  const setTags = useCallback((tags: PickerItem[]) => {
    setState((prev) => ({ ...prev, tags }));
  }, []);

  const setProject = useCallback((project: PickerItem | null) => {
    setState((prev) => ({ ...prev, project }));
  }, []);

  const setWatermarkDrafts = useCallback(
    (drafts: Record<string, WatermarkDraft> | null) => {
      setState((prev) => ({ ...prev, watermarkDrafts: drafts }));
    },
    [],
  );

  const setStage = useCallback((stage: UploadStage) => {
    setState((prev) => ({ ...prev, stage }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const hasMedia = state.images.length > 0 || state.video !== null;
  const hasRequiredMetadata = state.albums.length > 0 && state.tags.length > 0;
  const isLocked = state.stage === 'processing' || state.stage === 'done' || state.stage === 'error';
  const canUpload = hasMedia && hasRequiredMetadata && !isLocked;

  return useMemo(
    () => ({
      state,
      addImages,
      removeImage,
      setVideo,
      setAlbums,
      setTags,
      setProject,
      setWatermarkDrafts,
      setStage,
      hasMedia,
      hasRequiredMetadata,
      canUpload,
      reset,
    }),
    [state, addImages, removeImage, setVideo, setAlbums, setTags, setProject, setWatermarkDrafts, setStage, hasMedia, hasRequiredMetadata, canUpload, reset],
  );
}
