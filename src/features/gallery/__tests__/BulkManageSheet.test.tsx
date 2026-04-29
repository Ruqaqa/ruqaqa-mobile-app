jest.unmock('react-native');

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BulkManageSheet } from '../components/BulkManageSheet';
import { ThemeProvider } from '@/theme';
import { UserPermissions } from '@/types/permissions';
import { ManageSheetState, PickerItem, GalleryAlbum } from '../types';

// ---------------------------------------------------------------------------
// Module-resolution mocks
// ---------------------------------------------------------------------------

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

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  return {
    __esModule: true,
    SafeAreaView: Passthrough,
    SafeAreaProvider: Passthrough,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  };
});

jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy(
    {},
    {
      get: () => stub,
    },
  );
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      if (opts && 'query' in opts) return `${key}:${opts.query}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_PERMS: UserPermissions = {
  canAccessFinance: true,
  canAccessGallery: true,
  canCreateTransactions: false,
  canViewTransactionHistory: false,
  canViewAllTransactions: false,
  canUpdateTransactions: false,
  canSelectPartner: false,
  canAddReceiptsToSubmitted: false,
  canCreateReconciliation: false,
  canViewReconciliationHistory: false,
  canViewAllReconciliations: false,
  canUpdateReconciliation: false,
  canViewGallery: true,
  canCreateGallery: true,
  canUpdateGallery: true,
  canDeleteGallery: true,
};

const DEFAULT_STATE: ManageSheetState = {
  albums: [
    { id: '507f1f77bcf86cd799439011', title: 'Nature', state: 'unchecked' },
    { id: '507f1f77bcf86cd799439012', title: 'Portrait', state: 'checked' },
  ],
  tags: [
    { id: '507f1f77bcf86cd799439021', name: 'landscape', state: 'unchecked' },
    { id: '507f1f77bcf86cd799439022', name: 'sunset', state: 'mixed' },
  ],
};

const ALL_ALBUMS: GalleryAlbum[] = [
  {
    id: '507f1f77bcf86cd799439011',
    title: 'Nature',
    titleEn: 'Nature',
    titleAr: 'طبيعة',
    isDefault: false,
    itemCount: 0,
    coverThumbnails: [],
    createdAt: '2026-04-09T00:00:00Z',
  },
  {
    id: '507f1f77bcf86cd799439012',
    title: 'Portrait',
    titleEn: 'Portrait',
    titleAr: 'بورتريه',
    isDefault: false,
    itemCount: 0,
    coverThumbnails: [],
    createdAt: '2026-04-09T00:00:00Z',
  },
];

const ALL_TAGS: PickerItem[] = [
  { id: '507f1f77bcf86cd799439021', name: 'landscape' },
  { id: '507f1f77bcf86cd799439022', name: 'sunset' },
];

function makeSearchAlbums(items: GalleryAlbum[] = ALL_ALBUMS) {
  return jest.fn(async (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) => a.title.toLowerCase().includes(q));
  });
}

function makeSearchTags(items: PickerItem[] = ALL_TAGS) {
  return jest.fn(async (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => t.name.toLowerCase().includes(q));
  });
}

function renderSheet({
  permsOverrides = {},
  manageState = DEFAULT_STATE,
  onCreateAlbum = jest.fn(),
  onCreateTag = jest.fn(),
  searchAlbums = makeSearchAlbums(),
  searchTags = makeSearchTags(),
  errorMessage = null,
}: {
  permsOverrides?: Partial<UserPermissions>;
  manageState?: ManageSheetState | null;
  onCreateAlbum?: jest.Mock;
  onCreateTag?: jest.Mock;
  searchAlbums?: jest.Mock;
  searchTags?: jest.Mock;
  errorMessage?: string | null;
} = {}) {
  const permissions = { ...ALL_PERMS, ...permsOverrides };
  const onConfirm = jest.fn();
  const onClose = jest.fn();

  const utils = render(
    <ThemeProvider>
      <BulkManageSheet
        visible={true}
        selectedCount={3}
        currentAlbumId=""
        manageState={manageState}
        isFetchingState={false}
        isProcessing={false}
        progress={null}
        permissions={permissions}
        searchAlbums={searchAlbums}
        searchTags={searchTags}
        onCreateAlbum={onCreateAlbum}
        onCreateTag={onCreateTag}
        errorMessage={errorMessage}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </ThemeProvider>,
  );

  return {
    ...utils,
    onConfirm,
    onClose,
    onCreateAlbum,
    onCreateTag,
    searchAlbums,
    searchTags,
  };
}

/**
 * Wait until the initial searchAlbums('') / searchTags('') calls have resolved
 * and the resulting setState calls have flushed.
 */
async function waitForInitialFetch(
  searchAlbums: jest.Mock,
  searchTags: jest.Mock,
) {
  await waitFor(() => {
    expect(searchAlbums).toHaveBeenCalledWith('');
    expect(searchTags).toHaveBeenCalledWith('');
  });
}

// ---------------------------------------------------------------------------
// Initial list display (the bug this refactor fixes)
// ---------------------------------------------------------------------------

describe('BulkManageSheet — initial album/tag list', () => {
  it('fetches the full album and tag inventory on open', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    renderSheet({ searchAlbums, searchTags });

    await waitForInitialFetch(searchAlbums, searchTags);
  });

  it('shows the full list of albums even when none of them are attached to the selected items', async () => {
    // manageState contains no attached albums — but full inventory has two.
    const emptyState: ManageSheetState = { albums: [], tags: [] };
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();

    const { findByText } = renderSheet({
      manageState: emptyState,
      searchAlbums,
      searchTags,
    });

    expect(await findByText('Nature')).toBeTruthy();
    expect(await findByText('Portrait')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Album inline create
// ---------------------------------------------------------------------------

describe('BulkManageSheet — inline album create', () => {
  it('does not show album create row when search is empty', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { queryByTestId, getByTestId } = renderSheet({
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    expect(queryByTestId('bulk-manage-create-album')).toBeNull();
    expect(getByTestId('bulk-manage-album-search')).toBeTruthy();
  });

  it('shows album create row when search has no exact match', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId } = renderSheet({ searchAlbums, searchTags });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-album-search'), 'Wildlife');
    expect(getByTestId('bulk-manage-create-album')).toBeTruthy();
  });

  it('does not show album create row when search matches an existing album (case-insensitive)', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, queryByTestId } = renderSheet({
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-album-search'), 'nature');
    expect(queryByTestId('bulk-manage-create-album')).toBeNull();
  });

  it('does not show album create row when user lacks canCreateGallery', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, queryByTestId } = renderSheet({
      permsOverrides: { canCreateGallery: false },
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-album-search'), 'Wildlife');
    expect(queryByTestId('bulk-manage-create-album')).toBeNull();
  });

  it('calls onCreateAlbum with trimmed query when create row is tapped', async () => {
    const newAlbum: GalleryAlbum = {
      id: '507f1f77bcf86cd799439099',
      title: 'Wildlife',
      titleEn: 'Wildlife',
      titleAr: 'حياة برية',
      isDefault: false,
      itemCount: 0,
      coverThumbnails: [],
      createdAt: '2026-04-09T00:00:00Z',
    };
    const onCreateAlbum = jest.fn().mockResolvedValue(newAlbum);
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId } = renderSheet({
      onCreateAlbum,
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-album-search'), '  Wildlife  ');
    fireEvent.press(getByTestId('bulk-manage-create-album'));

    await waitFor(() => {
      expect(onCreateAlbum).toHaveBeenCalledWith('Wildlife');
    });
  });

  it('clears album search after successful create', async () => {
    const newAlbum: GalleryAlbum = {
      id: '507f1f77bcf86cd799439099',
      title: 'Wildlife',
      titleEn: 'Wildlife',
      titleAr: 'حياة برية',
      isDefault: false,
      itemCount: 0,
      coverThumbnails: [],
      createdAt: '2026-04-09T00:00:00Z',
    };
    const onCreateAlbum = jest.fn().mockResolvedValue(newAlbum);
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId } = renderSheet({
      onCreateAlbum,
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    const input = getByTestId('bulk-manage-album-search');
    fireEvent.changeText(input, 'Wildlife');
    fireEvent.press(getByTestId('bulk-manage-create-album'));

    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  it('adds the new album to the selection with checked state (queued in confirm payload)', async () => {
    const newAlbum: GalleryAlbum = {
      id: '507f1f77bcf86cd799439099',
      title: 'Wildlife',
      titleEn: 'Wildlife',
      titleAr: 'حياة برية',
      isDefault: false,
      itemCount: 0,
      coverThumbnails: [],
      createdAt: '2026-04-09T00:00:00Z',
    };
    const onCreateAlbum = jest.fn().mockResolvedValue(newAlbum);
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, onConfirm } = renderSheet({
      onCreateAlbum,
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    const input = getByTestId('bulk-manage-album-search');
    fireEvent.changeText(input, 'Wildlife');
    fireEvent.press(getByTestId('bulk-manage-create-album'));

    await waitFor(() => {
      expect(input.props.value).toBe('');
    });

    fireEvent.press(getByTestId('bulk-manage-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.albums).toContainEqual({
      id: '507f1f77bcf86cd799439099',
      state: 'checked',
    });
  });

  it('does not add album or clear search when onCreateAlbum returns null', async () => {
    const onCreateAlbum = jest.fn().mockResolvedValue(null);
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, onConfirm } = renderSheet({
      onCreateAlbum,
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    const input = getByTestId('bulk-manage-album-search');
    fireEvent.changeText(input, 'Wildlife');
    fireEvent.press(getByTestId('bulk-manage-create-album'));

    await waitFor(() => {
      expect(onCreateAlbum).toHaveBeenCalled();
    });

    expect(input.props.value).toBe('Wildlife');

    fireEvent.press(getByTestId('bulk-manage-confirm'));
    if (onConfirm.mock.calls.length > 0) {
      const payload = onConfirm.mock.calls[0][0];
      expect(payload.albums).toEqual([]);
    }
  });

  it('toggles a previously-unattached album from unchecked to checked and includes it in confirm payload', async () => {
    // manageState has no attached albums — but the inventory does.
    const emptyState: ManageSheetState = { albums: [], tags: [] };
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { findByLabelText, getByTestId, onConfirm } = renderSheet({
      manageState: emptyState,
      searchAlbums,
      searchTags,
    });

    const natureRow = await findByLabelText('Nature');
    fireEvent.press(natureRow);

    fireEvent.press(getByTestId('bulk-manage-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.albums).toContainEqual({
      id: '507f1f77bcf86cd799439011',
      state: 'checked',
    });
  });
});

// ---------------------------------------------------------------------------
// Tag inline create
// ---------------------------------------------------------------------------

describe('BulkManageSheet — inline tag create', () => {
  it('shows tag create row when search has no exact match', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId } = renderSheet({ searchAlbums, searchTags });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-tag-search'), 'wildlife');
    expect(getByTestId('bulk-manage-create-tag')).toBeTruthy();
  });

  it('does not show tag create row when search matches an existing tag', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, queryByTestId } = renderSheet({
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-tag-search'), 'landscape');
    expect(queryByTestId('bulk-manage-create-tag')).toBeNull();
  });

  it('does not show tag create row when user lacks canCreateGallery', async () => {
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, queryByTestId } = renderSheet({
      permsOverrides: { canCreateGallery: false },
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-tag-search'), 'wildlife');
    expect(queryByTestId('bulk-manage-create-tag')).toBeNull();
  });

  it('calls onCreateTag with trimmed query when create row is tapped', async () => {
    const newTag: PickerItem = { id: '507f1f77bcf86cd799439099', name: 'wildlife' };
    const onCreateTag = jest.fn().mockResolvedValue(newTag);
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId } = renderSheet({
      onCreateTag,
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    fireEvent.changeText(getByTestId('bulk-manage-tag-search'), '  wildlife  ');
    fireEvent.press(getByTestId('bulk-manage-create-tag'));

    await waitFor(() => {
      expect(onCreateTag).toHaveBeenCalledWith('wildlife');
    });
  });

  it('clears tag search and adds tag to selection on success', async () => {
    const newTag: PickerItem = { id: '507f1f77bcf86cd799439099', name: 'wildlife' };
    const onCreateTag = jest.fn().mockResolvedValue(newTag);
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, onConfirm } = renderSheet({
      onCreateTag,
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    const input = getByTestId('bulk-manage-tag-search');
    fireEvent.changeText(input, 'wildlife');
    fireEvent.press(getByTestId('bulk-manage-create-tag'));

    await waitFor(() => {
      expect(input.props.value).toBe('');
    });

    fireEvent.press(getByTestId('bulk-manage-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.tags).toContainEqual({
      id: '507f1f77bcf86cd799439099',
      state: 'checked',
    });
  });

  it('does not add tag when onCreateTag returns null', async () => {
    const onCreateTag = jest.fn().mockResolvedValue(null);
    const searchAlbums = makeSearchAlbums();
    const searchTags = makeSearchTags();
    const { getByTestId, onConfirm } = renderSheet({
      onCreateTag,
      searchAlbums,
      searchTags,
    });
    await waitForInitialFetch(searchAlbums, searchTags);

    const input = getByTestId('bulk-manage-tag-search');
    fireEvent.changeText(input, 'wildlife');
    fireEvent.press(getByTestId('bulk-manage-create-tag'));

    await waitFor(() => {
      expect(onCreateTag).toHaveBeenCalled();
    });

    expect(input.props.value).toBe('wildlife');
    fireEvent.press(getByTestId('bulk-manage-confirm'));
    if (onConfirm.mock.calls.length > 0) {
      const payload = onConfirm.mock.calls[0][0];
      expect(payload.tags).toEqual([]);
    }
  });
});
