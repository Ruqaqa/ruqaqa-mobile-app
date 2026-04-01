import { renderHook, act } from '@testing-library/react-native';
import { useMediaSelection } from '../hooks/useMediaSelection';

describe('useMediaSelection', () => {
  it('starts with empty selection and isSelectionMode=false', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIds).toEqual(new Set());
  });

  it('toggleItem adds item and sets isSelectionMode=true', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.toggleItem('item-1');
    });

    expect(result.current.isSelectionMode).toBe(true);
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected('item-1')).toBe(true);
  });

  it('toggleItem removes already-selected item', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.toggleItem('item-1');
    });
    act(() => {
      result.current.toggleItem('item-1');
    });

    expect(result.current.isSelected('item-1')).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('toggling last selected item exits selection mode', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.toggleItem('item-1');
    });
    expect(result.current.isSelectionMode).toBe(true);

    act(() => {
      result.current.toggleItem('item-1');
    });
    expect(result.current.isSelectionMode).toBe(false);
  });

  it('selectedIds returns Set of currently selected IDs', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.toggleItem('item-1');
      result.current.toggleItem('item-2');
    });

    expect(result.current.selectedIds).toEqual(new Set(['item-1', 'item-2']));
  });

  it('selectAll selects all provided IDs', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.selectAll(['item-1', 'item-2', 'item-3']);
    });

    expect(result.current.isSelectionMode).toBe(true);
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isSelected('item-1')).toBe(true);
    expect(result.current.isSelected('item-2')).toBe(true);
    expect(result.current.isSelected('item-3')).toBe(true);
  });

  it('selectAll then deselect one leaves remaining selected', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.selectAll(['item-1', 'item-2', 'item-3']);
    });
    act(() => {
      result.current.toggleItem('item-2');
    });

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected('item-1')).toBe(true);
    expect(result.current.isSelected('item-2')).toBe(false);
    expect(result.current.isSelected('item-3')).toBe(true);
  });

  it('deselectAll clears all and sets isSelectionMode=false', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.selectAll(['item-1', 'item-2']);
    });
    expect(result.current.isSelectionMode).toBe(true);

    act(() => {
      result.current.deselectAll();
    });

    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('exitSelectionMode clears selection entirely', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.toggleItem('item-1');
      result.current.toggleItem('item-2');
    });

    act(() => {
      result.current.exitSelectionMode();
    });

    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIds).toEqual(new Set());
  });

  it('enterSelectionMode sets mode even with empty selection', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.enterSelectionMode();
    });

    expect(result.current.isSelectionMode).toBe(true);
    expect(result.current.selectedCount).toBe(0);
  });

  it('does not enter selection mode when enabled=false', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: false }));

    act(() => {
      result.current.toggleItem('item-1');
    });

    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('rapid toggles maintain consistent state', () => {
    const { result } = renderHook(() => useMediaSelection({ enabled: true }));

    act(() => {
      result.current.toggleItem('item-1');
      result.current.toggleItem('item-2');
      result.current.toggleItem('item-3');
      result.current.toggleItem('item-1'); // deselect
      result.current.toggleItem('item-4');
    });

    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isSelected('item-1')).toBe(false);
    expect(result.current.isSelected('item-2')).toBe(true);
    expect(result.current.isSelected('item-3')).toBe(true);
    expect(result.current.isSelected('item-4')).toBe(true);
  });
});
