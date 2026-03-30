import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { SearchModal } from '../components/SearchModal';
import { EMPTY_FILTERS, ReconciliationFilters } from '../types';
import { ThemeProvider } from '@/theme';

// Mock react-i18next — return the key as the translated string
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock financeChannelService
jest.mock('@/services/financeChannelService', () => ({
  getFinanceChannels: jest.fn().mockResolvedValue([]),
}));

// Mock employeeCacheService
const mockGetEmployees = jest.fn().mockResolvedValue([
  { id: 'emp-1', name: 'Ahmed Ali' },
  { id: 'emp-2', name: 'Mohammed Saeed' },
  { id: 'emp-3', name: 'Sara Hassan' },
]);
jest.mock('@/services/employeeCacheService', () => ({
  getEmployees: (...args: unknown[]) => mockGetEmployees(...args),
}));

function renderModal(filterOverrides: Partial<ReconciliationFilters> = {}) {
  const filters: ReconciliationFilters = { ...EMPTY_FILTERS, ...filterOverrides };
  const onApply = jest.fn();
  const onClose = jest.fn();

  const utils = render(
    <ThemeProvider>
      <SearchModal
        visible={true}
        filters={filters}
        onApply={onApply}
        onClose={onClose}
      />
    </ThemeProvider>,
  );

  return { ...utils, onApply, onClose };
}

describe('SearchModal employee field visibility', () => {
  it('hides sender employee field when fromType is null', () => {
    const { queryByText } = renderModal({ fromType: null });
    // The sender employee label should NOT be rendered
    expect(queryByText('senderEmployee')).toBeNull();
  });

  it('shows sender employee field when fromType is employee', () => {
    const { getByText } = renderModal({ fromType: 'employee' });
    // The sender employee label should be rendered
    expect(getByText('senderEmployee')).toBeTruthy();
  });

  it('hides receiver employee field when toType is null', () => {
    const { queryByText } = renderModal({ toType: null });
    expect(queryByText('receiverEmployee')).toBeNull();
  });

  it('shows receiver employee field when toType is employee', () => {
    const { getByText } = renderModal({ toType: 'employee' });
    expect(getByText('receiverEmployee')).toBeTruthy();
  });

  it('hides sender employee field when fromType is a non-employee entity', () => {
    const { queryByText } = renderModal({ fromType: 'المحفظة' });
    expect(queryByText('senderEmployee')).toBeNull();
  });

  it('hides receiver employee field when toType is a non-employee entity', () => {
    const { queryByText } = renderModal({ toType: 'بطاقة البلاد' });
    expect(queryByText('receiverEmployee')).toBeNull();
  });
});

describe('SearchModal employee autocomplete', () => {
  beforeEach(() => {
    mockGetEmployees.mockClear();
  });

  it('loads employees from cache when modal opens', async () => {
    renderModal({ fromType: 'employee' });
    await waitFor(() => {
      expect(mockGetEmployees).toHaveBeenCalledTimes(1);
    });
  });

  it('renders AutocompleteField for sender employee instead of plain Input', async () => {
    const { getByTestId } = renderModal({ fromType: 'employee' });
    await waitFor(() => {
      expect(mockGetEmployees).toHaveBeenCalled();
    });
    // AutocompleteField renders a search icon input — look for the testID
    expect(getByTestId('from-employee-autocomplete')).toBeTruthy();
  });

  it('renders AutocompleteField for receiver employee instead of plain Input', async () => {
    const { getByTestId } = renderModal({ toType: 'employee' });
    await waitFor(() => {
      expect(mockGetEmployees).toHaveBeenCalled();
    });
    expect(getByTestId('to-employee-autocomplete')).toBeTruthy();
  });

  it('shows pre-selected sender employee when filter has matching ID', async () => {
    const { getByText } = renderModal({
      fromType: 'employee',
      fromEmployee: 'emp-1',
    });
    await waitFor(() => {
      expect(mockGetEmployees).toHaveBeenCalled();
    });
    // AutocompleteField renders the selected value as a chip with the label text
    await waitFor(() => {
      expect(getByText('Ahmed Ali')).toBeTruthy();
    });
  });

  it('shows pre-selected receiver employee when filter has matching ID', async () => {
    const { getByText } = renderModal({
      toType: 'employee',
      toEmployee: 'emp-2',
    });
    await waitFor(() => {
      expect(mockGetEmployees).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(getByText('Mohammed Saeed')).toBeTruthy();
    });
  });

  it('clears selected sender employee when clear all is pressed', async () => {
    const { getByText, queryByText } = renderModal({
      fromType: 'employee',
      fromEmployee: 'emp-1',
    });
    await waitFor(() => {
      expect(getByText('Ahmed Ali')).toBeTruthy();
    });

    // Press "Clear All"
    await act(async () => {
      fireEvent.press(getByText('clearAll'));
    });

    // fromType is reset to null, so the autocomplete should be hidden entirely
    expect(queryByText('Ahmed Ali')).toBeNull();
  });
});
