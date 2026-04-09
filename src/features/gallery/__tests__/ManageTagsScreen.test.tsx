// jest-expo's automock strips react-native down to { Platform } via some
// internal transformer. Component tests need the real module, so unmock it.
jest.unmock('react-native');

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ManageTagsScreen } from '../components/ManageTagsScreen';
import { UserPermissions } from '@/types/permissions';
import { ThemeProvider } from '@/theme';
import { PickerItem } from '../types';

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

// Mock react-native-safe-area-context — its real module crashes at module
// load in jest because SafeAreaContext tries to call a native module that's
// not available. Replace with simple passthroughs.
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

// Mock lucide icons — avoid pulling in react-native-svg (native module not available in jest)
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
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      if (opts && 'name' in opts) return `${key}:${opts.name}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// ---------------------------------------------------------------------------
// Tag list + actions hook mocks — controllable per-test via mockImplementation
// ---------------------------------------------------------------------------

const mockSetSearch = jest.fn();
const mockRefresh = jest.fn();
const mockRetry = jest.fn();
const mockUpdateTagLocally = jest.fn();
const mockAddTagLocally = jest.fn();
const mockRemoveTagLocally = jest.fn();

let mockTagListState: {
  tags: PickerItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: { code: string } | null;
  search: string;
  hasActiveFilters: boolean;
} = {
  tags: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  search: '',
  hasActiveFilters: false,
};

jest.mock('../hooks/useTagList', () => ({
  useTagList: () => ({
    ...mockTagListState,
    setSearch: mockSetSearch,
    refresh: mockRefresh,
    retry: mockRetry,
    updateTagLocally: mockUpdateTagLocally,
    addTagLocally: mockAddTagLocally,
    removeTagLocally: mockRemoveTagLocally,
  }),
}));

const mockCreateTag = jest.fn();
const mockRenameTag = jest.fn();
const mockDeleteTag = jest.fn();
const mockClearError = jest.fn();

let mockTagActionsState = {
  isCreating: false,
  isRenaming: false,
  isDeleting: false,
  error: null as string | null,
};

jest.mock('../hooks/useTagActions', () => ({
  useTagActions: () => ({
    ...mockTagActionsState,
    createTag: mockCreateTag,
    renameTag: mockRenameTag,
    deleteTag: mockDeleteTag,
    clearError: mockClearError,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTag = (id: string, name: string): PickerItem => ({ id, name });

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

function renderScreen(permsOverrides: Partial<UserPermissions> = {}) {
  const permissions = { ...ALL_PERMS, ...permsOverrides };
  const onClose = jest.fn();

  const utils = render(
    <ThemeProvider>
      <ManageTagsScreen visible={true} onClose={onClose} permissions={permissions} />
    </ThemeProvider>,
  );

  return { ...utils, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTagListState = {
    tags: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    search: '',
    hasActiveFilters: false,
  };
  mockTagActionsState = {
    isCreating: false,
    isRenaming: false,
    isDeleting: false,
    error: null,
  };
});

// ---------------------------------------------------------------------------
// Permission gating
// ---------------------------------------------------------------------------

describe('ManageTagsScreen — permission gating', () => {
  beforeEach(() => {
    mockTagListState.tags = [makeTag('507f1f77bcf86cd799439011', 'nature')];
  });

  it('shows edit button when canUpdateGallery is true', () => {
    const { getByTestId } = renderScreen({ canUpdateGallery: true });
    expect(getByTestId('tag-edit-507f1f77bcf86cd799439011')).toBeTruthy();
  });

  it('hides edit button when canUpdateGallery is false', () => {
    const { queryByTestId } = renderScreen({ canUpdateGallery: false });
    expect(queryByTestId('tag-edit-507f1f77bcf86cd799439011')).toBeNull();
  });

  it('shows delete button when canDeleteGallery is true', () => {
    const { getByTestId } = renderScreen({ canDeleteGallery: true });
    expect(getByTestId('tag-delete-507f1f77bcf86cd799439011')).toBeTruthy();
  });

  it('hides delete button when canDeleteGallery is false', () => {
    const { queryByTestId } = renderScreen({ canDeleteGallery: false });
    expect(queryByTestId('tag-delete-507f1f77bcf86cd799439011')).toBeNull();
  });

  it('hides inline create row when canCreateGallery is false', () => {
    const { queryByTestId } = renderScreen({ canCreateGallery: false });
    expect(queryByTestId('tag-create-trigger')).toBeNull();
  });

  it('shows inline create row when canCreateGallery is true', () => {
    const { getByTestId } = renderScreen({ canCreateGallery: true });
    expect(getByTestId('tag-create-trigger')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Inline rename flow
// ---------------------------------------------------------------------------

describe('ManageTagsScreen — inline rename', () => {
  beforeEach(() => {
    mockTagListState.tags = [
      makeTag('507f1f77bcf86cd799439011', 'nature'),
      makeTag('507f1f77bcf86cd799439022', 'portrait'),
    ];
  });

  it('tapping edit shows an input pre-filled with current name', () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-edit-507f1f77bcf86cd799439011'));

    const input = getByTestId('tag-rename-input-507f1f77bcf86cd799439011');
    expect(input.props.value).toBe('nature');
  });

  it('save calls renameTag and updateTagLocally on success', async () => {
    mockRenameTag.mockResolvedValue({
      success: true,
      tag: makeTag('507f1f77bcf86cd799439011', 'wildlife'),
    });

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-edit-507f1f77bcf86cd799439011'));

    const input = getByTestId('tag-rename-input-507f1f77bcf86cd799439011');
    fireEvent.changeText(input, 'wildlife');
    fireEvent.press(getByTestId('tag-rename-save-507f1f77bcf86cd799439011'));

    await waitFor(() => {
      expect(mockRenameTag).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'wildlife');
    });
    await waitFor(() => {
      expect(mockUpdateTagLocally).toHaveBeenCalledWith('507f1f77bcf86cd799439011', { name: 'wildlife' });
    });
  });

  it('save does NOT call updateTagLocally when renameTag returns TAG_NAME_TAKEN', async () => {
    mockRenameTag.mockResolvedValue({ success: false, code: 'TAG_NAME_TAKEN' });

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-edit-507f1f77bcf86cd799439011'));

    const input = getByTestId('tag-rename-input-507f1f77bcf86cd799439011');
    fireEvent.changeText(input, 'wildlife');
    fireEvent.press(getByTestId('tag-rename-save-507f1f77bcf86cd799439011'));

    await waitFor(() => {
      expect(mockRenameTag).toHaveBeenCalled();
    });
    expect(mockUpdateTagLocally).not.toHaveBeenCalled();
  });

  it('save does NOT call updateTagLocally when renameTag returns null', async () => {
    mockRenameTag.mockResolvedValue(null);

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-edit-507f1f77bcf86cd799439011'));

    const input = getByTestId('tag-rename-input-507f1f77bcf86cd799439011');
    fireEvent.changeText(input, 'wildlife');
    fireEvent.press(getByTestId('tag-rename-save-507f1f77bcf86cd799439011'));

    await waitFor(() => {
      expect(mockRenameTag).toHaveBeenCalled();
    });
    expect(mockUpdateTagLocally).not.toHaveBeenCalled();
  });

  it('cancel exits rename mode without calling renameTag', () => {
    const { getByTestId, queryByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-edit-507f1f77bcf86cd799439011'));
    fireEvent.press(getByTestId('tag-rename-cancel-507f1f77bcf86cd799439011'));

    expect(mockRenameTag).not.toHaveBeenCalled();
    // Back to view mode — input is gone
    expect(queryByTestId('tag-rename-input-507f1f77bcf86cd799439011')).toBeNull();
  });

  it('does not call renameTag when trimmed value is empty', async () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-edit-507f1f77bcf86cd799439011'));

    const input = getByTestId('tag-rename-input-507f1f77bcf86cd799439011');
    fireEvent.changeText(input, '   ');
    fireEvent.press(getByTestId('tag-rename-save-507f1f77bcf86cd799439011'));

    expect(mockRenameTag).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Inline create flow
// ---------------------------------------------------------------------------

describe('ManageTagsScreen — inline create', () => {
  it('tapping create trigger shows an empty input', () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-create-trigger'));

    const input = getByTestId('tag-create-input');
    expect(input.props.value).toBe('');
  });

  it('save calls createTag and addTagLocally on success', async () => {
    mockCreateTag.mockResolvedValue(makeTag('507f1f77bcf86cd799439099', 'landscape'));

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-create-trigger'));

    fireEvent.changeText(getByTestId('tag-create-input'), 'landscape');
    fireEvent.press(getByTestId('tag-create-save'));

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledWith('landscape');
    });
    expect(mockAddTagLocally).toHaveBeenCalledWith(
      makeTag('507f1f77bcf86cd799439099', 'landscape'),
    );
  });

  it('save does NOT call addTagLocally when createTag returns null', async () => {
    mockCreateTag.mockResolvedValue(null);

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-create-trigger'));

    fireEvent.changeText(getByTestId('tag-create-input'), 'landscape');
    fireEvent.press(getByTestId('tag-create-save'));

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalled();
    });
    expect(mockAddTagLocally).not.toHaveBeenCalled();
  });

  it('does not call createTag when trimmed value is empty', () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-create-trigger'));

    fireEvent.changeText(getByTestId('tag-create-input'), '   ');
    fireEvent.press(getByTestId('tag-create-save'));

    expect(mockCreateTag).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Delete flow
// ---------------------------------------------------------------------------

describe('ManageTagsScreen — delete', () => {
  beforeEach(() => {
    mockTagListState.tags = [makeTag('507f1f77bcf86cd799439011', 'nature')];
  });

  it('tapping delete opens the confirm dialog', () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-delete-507f1f77bcf86cd799439011'));

    expect(getByTestId('delete-tag-confirm-dialog')).toBeTruthy();
  });

  it('confirming delete calls deleteTag and removeTagLocally on success', async () => {
    mockDeleteTag.mockResolvedValue({ success: true, detachedFromItemCount: 0 });

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-delete-507f1f77bcf86cd799439011'));
    fireEvent.press(getByTestId('delete-tag-confirm-button'));

    await waitFor(() => {
      expect(mockDeleteTag).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
    await waitFor(() => {
      expect(mockRemoveTagLocally).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
  });

  it('does NOT removeTagLocally when delete returns TAG_ONLY_ON_ITEMS', async () => {
    mockDeleteTag.mockResolvedValue({
      success: false,
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: ['507f1f77bcf86cd799439091', '507f1f77bcf86cd799439092'],
      count: 2,
    });

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-delete-507f1f77bcf86cd799439011'));
    fireEvent.press(getByTestId('delete-tag-confirm-button'));

    await waitFor(() => {
      expect(mockDeleteTag).toHaveBeenCalled();
    });
    expect(mockRemoveTagLocally).not.toHaveBeenCalled();
  });

  it('does NOT removeTagLocally when delete throws', async () => {
    mockDeleteTag.mockRejectedValue(new Error('boom'));

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-delete-507f1f77bcf86cd799439011'));
    fireEvent.press(getByTestId('delete-tag-confirm-button'));

    await waitFor(() => {
      expect(mockDeleteTag).toHaveBeenCalled();
    });
    expect(mockRemoveTagLocally).not.toHaveBeenCalled();
  });

  it('cancel closes dialog without calling deleteTag', () => {
    const { getByTestId, queryByTestId } = renderScreen();
    fireEvent.press(getByTestId('tag-delete-507f1f77bcf86cd799439011'));
    fireEvent.press(getByTestId('delete-tag-cancel-button'));

    expect(mockDeleteTag).not.toHaveBeenCalled();
    expect(queryByTestId('delete-tag-confirm-dialog')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty & error states
// ---------------------------------------------------------------------------

describe('ManageTagsScreen — states', () => {
  it('shows "no tags yet" empty state when list is empty and no filter', () => {
    mockTagListState.tags = [];
    mockTagListState.hasActiveFilters = false;

    const { getByTestId } = renderScreen();
    expect(getByTestId('tags-empty-initial')).toBeTruthy();
  });

  it('shows "no tags found" empty state when search has no results', () => {
    mockTagListState.tags = [];
    mockTagListState.search = 'xyz';
    mockTagListState.hasActiveFilters = true;

    const { getByTestId } = renderScreen();
    expect(getByTestId('tags-empty-filtered')).toBeTruthy();
  });

  it('shows error state with retry when fetch fails', () => {
    mockTagListState.tags = [];
    mockTagListState.error = { code: 'NETWORK' };

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('tags-retry-button'));
    expect(mockRetry).toHaveBeenCalled();
  });

  it('calls onClose when header close button is pressed', () => {
    const { getByTestId, onClose } = renderScreen();
    fireEvent.press(getByTestId('manage-tags-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
