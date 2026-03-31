import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAlbumActions } from '../hooks/useAlbumActions';
import * as galleryService from '../services/galleryService';
import { GalleryAlbum } from '../types';

jest.mock('../services/galleryService', () => {
  const actual = jest.requireActual('../services/galleryService');
  return {
    ...actual,
    createAlbum: jest.fn(),
    updateAlbumTitle: jest.fn(),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const mockCreateAlbum = galleryService.createAlbum as jest.MockedFunction<
  typeof galleryService.createAlbum
>;
const mockUpdateAlbumTitle = galleryService.updateAlbumTitle as jest.MockedFunction<
  typeof galleryService.updateAlbumTitle
>;

const makeAlbum = (id: string): GalleryAlbum => ({
  id,
  title: `Album ${id}`,
  titleEn: `Album ${id}`,
  titleAr: `ألبوم ${id}`,
  isDefault: false,
  itemCount: 0,
  coverThumbnails: [],
  createdAt: '2025-06-01T00:00:00Z',
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAlbumActions', () => {
  it('createAlbum calls service with name and locale', async () => {
    const album = makeAlbum('1');
    mockCreateAlbum.mockResolvedValue(album);

    const { result } = renderHook(() => useAlbumActions());

    await act(async () => {
      await result.current.createAlbum('My Album');
    });

    expect(mockCreateAlbum).toHaveBeenCalledWith('My Album', 'en');
  });

  it('createAlbum returns album on success', async () => {
    const album = makeAlbum('1');
    mockCreateAlbum.mockResolvedValue(album);

    const { result } = renderHook(() => useAlbumActions());

    let created: GalleryAlbum | null = null;
    await act(async () => {
      created = await result.current.createAlbum('My Album');
    });

    expect(created).toEqual(album);
    expect(result.current.error).toBeNull();
  });

  it('createAlbum returns null and sets error on failure', async () => {
    mockCreateAlbum.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useAlbumActions());

    let created: GalleryAlbum | null = null;
    await act(async () => {
      created = await result.current.createAlbum('My Album');
    });

    expect(created).toBeNull();
    expect(result.current.error).toBe('failedToCreateAlbum');
  });

  it('createAlbum validates name before calling service', async () => {
    const { result } = renderHook(() => useAlbumActions());

    let created: GalleryAlbum | null = null;
    await act(async () => {
      created = await result.current.createAlbum('   ');
    });

    expect(created).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(mockCreateAlbum).not.toHaveBeenCalled();
  });

  it('renameAlbum calls service with id, name, locale', async () => {
    mockUpdateAlbumTitle.mockResolvedValue(true);

    const { result } = renderHook(() => useAlbumActions());

    await act(async () => {
      await result.current.renameAlbum('album-1', 'New Name');
    });

    expect(mockUpdateAlbumTitle).toHaveBeenCalledWith('album-1', 'New Name', 'en');
  });

  it('renameAlbum returns true on success', async () => {
    mockUpdateAlbumTitle.mockResolvedValue(true);

    const { result } = renderHook(() => useAlbumActions());

    let success = false;
    await act(async () => {
      success = await result.current.renameAlbum('album-1', 'New Name');
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('renameAlbum returns false and sets error on failure', async () => {
    mockUpdateAlbumTitle.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useAlbumActions());

    let success = true;
    await act(async () => {
      success = await result.current.renameAlbum('album-1', 'New Name');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('failedToUpdateAlbumName');
  });

  it('clearError resets error state', async () => {
    mockCreateAlbum.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useAlbumActions());

    await act(async () => {
      await result.current.createAlbum('My Album');
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
