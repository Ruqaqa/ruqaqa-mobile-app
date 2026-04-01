import { useState, useCallback, useMemo } from 'react';

interface UseMediaSelectionParams {
  enabled: boolean;
}

export interface UseMediaSelectionReturn {
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
}

export function useMediaSelection({
  enabled,
}: UseMediaSelectionParams): UseMediaSelectionReturn {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forceMode, setForceMode] = useState(false);

  const isSelectionMode = forceMode || selected.size > 0;

  const isSelected = useCallback(
    (id: string) => selected.has(id),
    [selected],
  );

  const toggleItem = useCallback(
    (id: string) => {
      if (!enabled) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [enabled],
  );

  const selectAll = useCallback(
    (ids: string[]) => {
      if (!enabled) return;
      setSelected(new Set(ids));
    },
    [enabled],
  );

  const deselectAll = useCallback(() => {
    setSelected(new Set());
    setForceMode(false);
  }, []);

  const enterSelectionMode = useCallback(() => {
    if (!enabled) return;
    setForceMode(true);
  }, [enabled]);

  const exitSelectionMode = useCallback(() => {
    setSelected(new Set());
    setForceMode(false);
  }, []);

  return useMemo(
    () => ({
      isSelectionMode,
      selectedIds: selected,
      selectedCount: selected.size,
      isSelected,
      toggleItem,
      selectAll,
      deselectAll,
      enterSelectionMode,
      exitSelectionMode,
    }),
    [
      isSelectionMode,
      selected,
      isSelected,
      toggleItem,
      selectAll,
      deselectAll,
      enterSelectionMode,
      exitSelectionMode,
    ],
  );
}
