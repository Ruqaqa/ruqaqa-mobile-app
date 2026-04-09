// jest-expo's automock strips react-native down to { Platform }. Component
// tests need the real module, so unmock it. See project memory:
// project_jest_expo_automock.md
jest.unmock('react-native');

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlbumOptionsSheet } from '../components/AlbumOptionsSheet';
import { DeleteAlbumConfirmDialog } from '../components/DeleteAlbumConfirmDialog';
import { UserPermissions } from '@/types/permissions';
import { ThemeProvider } from '@/theme';
import { GalleryAlbum } from '../types';

// ---------------------------------------------------------------------------
// Module-resolution mocks (avoid expo-file-system native boot)
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
      get: (_target, _prop) => stub,
    },
  );
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'title' in opts) return `${key}:${opts.title}`;
      if (opts && 'name' in opts) return `${key}:${opts.name}`;
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
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

const NORMAL_ALBUM: GalleryAlbum = {
  id: '507f1f77bcf86cd799439011',
  title: 'Wildlife',
  titleEn: 'Wildlife',
  titleAr: 'الحياة البرية',
  description: '',
  isDefault: false,
  itemCount: 5,
  coverThumbnails: [],
  createdAt: '2025-01-01T00:00:00Z',
};

const DEFAULT_ALBUM: GalleryAlbum = {
  ...NORMAL_ALBUM,
  id: '507f1f77bcf86cd799439099',
  title: 'Default Album',
  titleEn: 'Default Album',
  titleAr: 'الألبوم الافتراضي',
  isDefault: true,
};

function renderSheet(
  permsOverrides: Partial<UserPermissions> = {},
  album: GalleryAlbum | null = NORMAL_ALBUM,
  visible = true,
) {
  const permissions = { ...ALL_PERMS, ...permsOverrides };
  const onClose = jest.fn();
  const onEditName = jest.fn();
  const onDelete = jest.fn();

  const utils = render(
    <ThemeProvider>
      <AlbumOptionsSheet
        visible={visible}
        album={album}
        permissions={permissions}
        onClose={onClose}
        onEditName={onEditName}
        onDelete={onDelete}
      />
    </ThemeProvider>,
  );

  return { ...utils, onClose, onEditName, onDelete };
}

function renderDialog(
  album: GalleryAlbum | null = NORMAL_ALBUM,
  isDeleting = false,
  visible = true,
) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  const utils = render(
    <ThemeProvider>
      <DeleteAlbumConfirmDialog
        visible={visible}
        album={album}
        isDeleting={isDeleting}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </ThemeProvider>,
  );

  return { ...utils, onConfirm, onCancel };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// AlbumOptionsSheet — permission gating
// ===========================================================================

describe('AlbumOptionsSheet — permission gating', () => {
  it('shows both edit and delete rows when user has update + delete permissions on a non-default album', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('album-options-edit-row')).toBeTruthy();
    expect(getByTestId('album-options-delete-row')).toBeTruthy();
  });

  it('hides the edit row when canUpdateGallery is false', () => {
    const { queryByTestId, getByTestId } = renderSheet({
      canUpdateGallery: false,
      canDeleteGallery: true,
    });
    expect(queryByTestId('album-options-edit-row')).toBeNull();
    expect(getByTestId('album-options-delete-row')).toBeTruthy();
  });

  it('hides the delete row when canDeleteGallery is false', () => {
    const { getByTestId, queryByTestId } = renderSheet({
      canUpdateGallery: true,
      canDeleteGallery: false,
    });
    expect(getByTestId('album-options-edit-row')).toBeTruthy();
    expect(queryByTestId('album-options-delete-row')).toBeNull();
  });

  it('hides the delete row when the album is the default album (even with canDeleteGallery)', () => {
    const { queryByTestId, getByTestId } = renderSheet(
      { canUpdateGallery: true, canDeleteGallery: true },
      DEFAULT_ALBUM,
    );
    // Edit row is still visible for the default album (caller decides whether
    // to allow renaming it; sheet gates only on permission).
    expect(getByTestId('album-options-edit-row')).toBeTruthy();
    // Delete row must NEVER appear for the default album.
    expect(queryByTestId('album-options-delete-row')).toBeNull();
  });

  it('renders nothing when the user has neither update nor delete permission', () => {
    const { queryByTestId } = renderSheet({
      canUpdateGallery: false,
      canDeleteGallery: false,
    });
    expect(queryByTestId('album-options-edit-row')).toBeNull();
    expect(queryByTestId('album-options-delete-row')).toBeNull();
  });

  it('renders nothing for a default album when the user only has delete permission', () => {
    const { queryByTestId } = renderSheet(
      { canUpdateGallery: false, canDeleteGallery: true },
      DEFAULT_ALBUM,
    );
    // canEdit = false (no update), canDelete = false (default album).
    // Both gated → null render.
    expect(queryByTestId('album-options-edit-row')).toBeNull();
    expect(queryByTestId('album-options-delete-row')).toBeNull();
  });

  it('returns null when album is null regardless of permissions', () => {
    const { queryByTestId } = renderSheet({}, null);
    expect(queryByTestId('album-options-edit-row')).toBeNull();
    expect(queryByTestId('album-options-delete-row')).toBeNull();
  });
});

// ===========================================================================
// AlbumOptionsSheet — callback dispatch
// ===========================================================================

describe('AlbumOptionsSheet — callback dispatch', () => {
  it('calls onEditName and onClose when edit row is pressed', () => {
    const { getByTestId, onEditName, onClose } = renderSheet();
    fireEvent.press(getByTestId('album-options-edit-row'));
    expect(onEditName).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete and onClose when delete row is pressed', () => {
    const { getByTestId, onDelete, onClose } = renderSheet();
    fireEvent.press(getByTestId('album-options-delete-row'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onDelete when only the edit row is pressed', () => {
    const { getByTestId, onDelete } = renderSheet();
    fireEvent.press(getByTestId('album-options-edit-row'));
    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// DeleteAlbumConfirmDialog — rendering
// ===========================================================================

describe('DeleteAlbumConfirmDialog — rendering', () => {
  it('returns null when album is null', () => {
    const { queryByTestId } = renderDialog(null);
    expect(queryByTestId('delete-album-confirm-dialog')).toBeNull();
  });

  it('renders the confirm dialog with cancel + delete buttons when album is provided', () => {
    const { getByTestId } = renderDialog();
    expect(getByTestId('delete-album-confirm-dialog')).toBeTruthy();
    expect(getByTestId('delete-album-cancel-button')).toBeTruthy();
    expect(getByTestId('delete-album-confirm-button')).toBeTruthy();
  });

  it('shows a spinner and hides buttons when isDeleting is true', () => {
    const { queryByTestId } = renderDialog(NORMAL_ALBUM, true);
    expect(queryByTestId('delete-album-cancel-button')).toBeNull();
    expect(queryByTestId('delete-album-confirm-button')).toBeNull();
  });
});

// ===========================================================================
// DeleteAlbumConfirmDialog — callback dispatch
// ===========================================================================

describe('DeleteAlbumConfirmDialog — callback dispatch', () => {
  it('calls onConfirm when delete button is pressed', () => {
    const { getByTestId, onConfirm, onCancel } = renderDialog();
    fireEvent.press(getByTestId('delete-album-confirm-button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is pressed', () => {
    const { getByTestId, onCancel, onConfirm } = renderDialog();
    fireEvent.press(getByTestId('delete-album-cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
