import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createAlbum as createAlbumService,
  updateAlbumTitle,
  deleteAlbum as deleteAlbumService,
} from '../services/galleryService';
import { GalleryAlbum } from '../types';
import { validateAlbumName } from '../utils/validation';

export interface UseAlbumActionsReturn {
  createAlbum: (name: string) => Promise<GalleryAlbum | null>;
  renameAlbum: (albumId: string, name: string) => Promise<boolean>;
  deleteAlbum: (albumId: string) => Promise<boolean>;
  isCreating: boolean;
  isRenaming: boolean;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useAlbumActions(): UseAlbumActionsReturn {
  const { i18n } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en';

  const createAlbum = useCallback(
    async (name: string): Promise<GalleryAlbum | null> => {
      const validation = validateAlbumName(name);
      if (!validation.valid) {
        setError(validation.error ?? 'failedToCreateAlbum');
        return null;
      }

      setIsCreating(true);
      setError(null);
      try {
        const album = await createAlbumService(name, locale);
        return album;
      } catch {
        setError('failedToCreateAlbum');
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [locale],
  );

  const renameAlbum = useCallback(
    async (albumId: string, name: string): Promise<boolean> => {
      const validation = validateAlbumName(name);
      if (!validation.valid) {
        setError(validation.error ?? 'failedToUpdateAlbumName');
        return false;
      }

      setIsRenaming(true);
      setError(null);
      try {
        await updateAlbumTitle(albumId, name, locale);
        return true;
      } catch {
        setError('failedToUpdateAlbumName');
        return false;
      } finally {
        setIsRenaming(false);
      }
    },
    [locale],
  );

  const deleteAlbum = useCallback(
    async (albumId: string): Promise<boolean> => {
      setIsDeleting(true);
      setError(null);
      try {
        await deleteAlbumService(albumId);
        return true;
      } catch {
        setError('failedToDeleteAlbum');
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createAlbum,
    renameAlbum,
    deleteAlbum,
    isCreating,
    isRenaming,
    isDeleting,
    error,
    clearError,
  };
}
