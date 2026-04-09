import { renderHook, act } from '@testing-library/react-native';
import { useTagActions } from '../hooks/useTagActions';
import * as galleryService from '../services/galleryService';
import { PickerItem } from '../types';

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

jest.mock('../services/galleryService', () => {
  const actual = jest.requireActual('../services/galleryService');
  return {
    ...actual,
    createTag: jest.fn(),
    renameTag: jest.fn(),
    deleteTag: jest.fn(),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const mockCreateTag = galleryService.createTag as jest.MockedFunction<
  typeof galleryService.createTag
>;
const mockRenameTag = galleryService.renameTag as jest.MockedFunction<
  typeof galleryService.renameTag
>;
const mockDeleteTag = galleryService.deleteTag as jest.MockedFunction<
  typeof galleryService.deleteTag
>;

const makeTag = (id: string, name: string): PickerItem => ({ id, name });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useTagActions', () => {
  // --- createTag ---
  describe('createTag', () => {
    it('calls service with name and locale', async () => {
      mockCreateTag.mockResolvedValue(makeTag('1', 'nature'));

      const { result } = renderHook(() => useTagActions());

      await act(async () => {
        await result.current.createTag('nature');
      });

      expect(mockCreateTag).toHaveBeenCalledWith('nature', 'en');
    });

    it('returns created tag on success', async () => {
      const tag = makeTag('1', 'nature');
      mockCreateTag.mockResolvedValue(tag);

      const { result } = renderHook(() => useTagActions());

      let created: PickerItem | null = null;
      await act(async () => {
        created = await result.current.createTag('nature');
      });

      expect(created).toEqual(tag);
      expect(result.current.error).toBeNull();
    });

    it('validates name before calling service', async () => {
      const { result } = renderHook(() => useTagActions());

      let created: PickerItem | null = null;
      await act(async () => {
        created = await result.current.createTag('   ');
      });

      expect(created).toBeNull();
      expect(result.current.error).toBeTruthy();
      expect(mockCreateTag).not.toHaveBeenCalled();
    });

    it('returns null and sets error when service returns null', async () => {
      mockCreateTag.mockResolvedValue(null);

      const { result } = renderHook(() => useTagActions());

      let created: PickerItem | null = null;
      await act(async () => {
        created = await result.current.createTag('nature');
      });

      expect(created).toBeNull();
      expect(result.current.error).toBe('failedToCreateTag');
    });

    it('returns null and sets error on thrown error', async () => {
      mockCreateTag.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() => useTagActions());

      let created: PickerItem | null = null;
      await act(async () => {
        created = await result.current.createTag('nature');
      });

      expect(created).toBeNull();
      expect(result.current.error).toBe('failedToCreateTag');
    });
  });

  // --- renameTag ---
  describe('renameTag', () => {
    it('calls service with id, name, and locale', async () => {
      mockRenameTag.mockResolvedValue({
        success: true,
        tag: makeTag('1', 'new-name'),
      });

      const { result } = renderHook(() => useTagActions());

      await act(async () => {
        await result.current.renameTag('1', 'new-name');
      });

      expect(mockRenameTag).toHaveBeenCalledWith('1', 'new-name', 'en');
    });

    it('returns success result with tag on happy path', async () => {
      const tag = makeTag('1', 'new-name');
      mockRenameTag.mockResolvedValue({ success: true, tag });

      const { result } = renderHook(() => useTagActions());

      let renameResult: Awaited<ReturnType<typeof result.current.renameTag>> = null;
      await act(async () => {
        renameResult = await result.current.renameTag('1', 'new-name');
      });

      expect(renameResult).toEqual({ success: true, tag });
      expect(result.current.error).toBeNull();
    });

    it('returns TAG_NAME_TAKEN failure when service returns it', async () => {
      mockRenameTag.mockResolvedValue({ success: false, code: 'TAG_NAME_TAKEN' });

      const { result } = renderHook(() => useTagActions());

      let renameResult: Awaited<ReturnType<typeof result.current.renameTag>> = null;
      await act(async () => {
        renameResult = await result.current.renameTag('1', 'new-name');
      });

      expect(renameResult).toEqual({ success: false, code: 'TAG_NAME_TAKEN' });
      // TAG_NAME_TAKEN is a typed failure — not a generic error
      expect(result.current.error).toBeNull();
    });

    it('returns null and sets validation error for empty name', async () => {
      const { result } = renderHook(() => useTagActions());

      let renameResult: Awaited<ReturnType<typeof result.current.renameTag>> = null;
      await act(async () => {
        renameResult = await result.current.renameTag('1', '');
      });

      expect(renameResult).toBeNull();
      expect(result.current.error).toBeTruthy();
      expect(mockRenameTag).not.toHaveBeenCalled();
    });

    it('returns null and sets error on thrown error', async () => {
      mockRenameTag.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() => useTagActions());

      let renameResult: Awaited<ReturnType<typeof result.current.renameTag>> = null;
      await act(async () => {
        renameResult = await result.current.renameTag('1', 'new-name');
      });

      expect(renameResult).toBeNull();
      expect(result.current.error).toBe('failedToRenameTag');
    });
  });

  // --- deleteTag ---
  describe('deleteTag', () => {
    it('calls service with tag id', async () => {
      mockDeleteTag.mockResolvedValue({ success: true, detachedFromItemCount: 0 });

      const { result } = renderHook(() => useTagActions());

      await act(async () => {
        await result.current.deleteTag('1');
      });

      expect(mockDeleteTag).toHaveBeenCalledWith('1');
    });

    it('returns success result on happy path with detached count', async () => {
      mockDeleteTag.mockResolvedValue({ success: true, detachedFromItemCount: 7 });

      const { result } = renderHook(() => useTagActions());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteTag>> | null = null;
      await act(async () => {
        deleteResult = await result.current.deleteTag('1');
      });

      expect(deleteResult).toEqual({ success: true, detachedFromItemCount: 7 });
      expect(result.current.error).toBeNull();
    });

    it('returns TAG_ONLY_ON_ITEMS failure with itemIds + count', async () => {
      const itemIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439022'];
      mockDeleteTag.mockResolvedValue({
        success: false,
        code: 'TAG_ONLY_ON_ITEMS',
        itemIds,
        count: 2,
      });

      const { result } = renderHook(() => useTagActions());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteTag>> | null = null;
      await act(async () => {
        deleteResult = await result.current.deleteTag('1');
      });

      expect(deleteResult).toEqual({
        success: false,
        code: 'TAG_ONLY_ON_ITEMS',
        itemIds,
        count: 2,
      });
    });

    it('returns TAG_DETACH_CONFLICT failure with itemId', async () => {
      mockDeleteTag.mockResolvedValue({
        success: false,
        code: 'TAG_DETACH_CONFLICT',
        itemId: '507f1f77bcf86cd799439099',
      });

      const { result } = renderHook(() => useTagActions());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteTag>> | null = null;
      await act(async () => {
        deleteResult = await result.current.deleteTag('1');
      });

      expect(deleteResult).toEqual({
        success: false,
        code: 'TAG_DETACH_CONFLICT',
        itemId: '507f1f77bcf86cd799439099',
      });
    });

    it('returns TAG_RACE_CONFLICT failure', async () => {
      mockDeleteTag.mockResolvedValue({ success: false, code: 'TAG_RACE_CONFLICT' });

      const { result } = renderHook(() => useTagActions());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteTag>> | null = null;
      await act(async () => {
        deleteResult = await result.current.deleteTag('1');
      });

      expect(deleteResult).toEqual({ success: false, code: 'TAG_RACE_CONFLICT' });
    });

    it('returns TAG_HAS_TOO_MANY_REFERENCES failure with count', async () => {
      mockDeleteTag.mockResolvedValue({
        success: false,
        code: 'TAG_HAS_TOO_MANY_REFERENCES',
        affectedItemCount: 500,
      });

      const { result } = renderHook(() => useTagActions());

      let deleteResult: Awaited<ReturnType<typeof result.current.deleteTag>> | null = null;
      await act(async () => {
        deleteResult = await result.current.deleteTag('1');
      });

      expect(deleteResult).toEqual({
        success: false,
        code: 'TAG_HAS_TOO_MANY_REFERENCES',
        affectedItemCount: 500,
      });
    });

    it('re-throws and sets error on unexpected error', async () => {
      const err = new Error('boom');
      mockDeleteTag.mockRejectedValue(err);

      const { result } = renderHook(() => useTagActions());

      let caught: unknown = null;
      await act(async () => {
        try {
          await result.current.deleteTag('1');
        } catch (e) {
          caught = e;
        }
      });

      expect(caught).toBe(err);
      expect(result.current.error).toBe('failedToDeleteTag');
    });
  });

  it('clearError resets error state', async () => {
    mockCreateTag.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useTagActions());

    await act(async () => {
      await result.current.createTag('nature');
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
