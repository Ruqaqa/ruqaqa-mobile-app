import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createTag as createTagService,
  renameTag as renameTagService,
  deleteTag as deleteTagService,
} from '../services/galleryService';
import { PickerItem, DeleteTagResult, RenameTagResult } from '../types';
import { validateTagName } from '../utils/validation';

export interface UseTagActionsReturn {
  createTag: (name: string) => Promise<PickerItem | null>;
  /**
   * Returns the typed result on success or `TAG_NAME_TAKEN`, or `null` when
   * client-side validation fails or the service throws (see `error` state).
   */
  renameTag: (tagId: string, name: string) => Promise<RenameTagResult | null>;
  /**
   * Returns the typed `DeleteTagResult` union. Throws on unexpected errors —
   * the caller must catch. On thrown errors, `error` state is set to
   * `'failedToDeleteTag'` so the UI can render a generic message.
   */
  deleteTag: (tagId: string) => Promise<DeleteTagResult>;
  isCreating: boolean;
  isRenaming: boolean;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useTagActions(): UseTagActionsReturn {
  const { i18n } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale = (i18n.language === 'ar' ? 'ar' : 'en') as 'ar' | 'en';

  const createTag = useCallback(
    async (name: string): Promise<PickerItem | null> => {
      const validation = validateTagName(name);
      if (!validation.valid) {
        setError(validation.error ?? 'failedToCreateTag');
        return null;
      }

      setIsCreating(true);
      setError(null);
      try {
        const tag = await createTagService(name, locale);
        if (!tag) {
          setError('failedToCreateTag');
          return null;
        }
        return tag;
      } catch {
        setError('failedToCreateTag');
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [locale],
  );

  const renameTag = useCallback(
    async (
      tagId: string,
      name: string,
    ): Promise<RenameTagResult | null> => {
      const validation = validateTagName(name);
      if (!validation.valid) {
        setError(validation.error ?? 'failedToRenameTag');
        return null;
      }

      setIsRenaming(true);
      setError(null);
      try {
        return await renameTagService(tagId, name, locale);
      } catch {
        setError('failedToRenameTag');
        return null;
      } finally {
        setIsRenaming(false);
      }
    },
    [locale],
  );

  const deleteTag = useCallback(
    async (tagId: string): Promise<DeleteTagResult> => {
      setIsDeleting(true);
      setError(null);
      try {
        return await deleteTagService(tagId);
      } catch (err) {
        setError('failedToDeleteTag');
        throw err;
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
    createTag,
    renameTag,
    deleteTag,
    isCreating,
    isRenaming,
    isDeleting,
    error,
    clearError,
  };
}
