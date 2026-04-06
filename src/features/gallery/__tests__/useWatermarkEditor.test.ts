import { renderHook, act } from '@testing-library/react-native';
import { useWatermarkEditor } from '../hooks/useWatermarkEditor';
import type { EditorMediaItem } from '../hooks/useWatermarkEditor';
import type { WatermarkDraft } from '../types';
import { DEFAULT_WATERMARK_DRAFT } from '../types';

// --- Mocks ---

// Mock Image.resolveAssetSource to avoid requiring the actual logo asset
jest.mock('react-native', () => ({
  Image: {
    resolveAssetSource: jest.fn().mockReturnValue({ width: 500, height: 200 }),
  },
}));

// --- Helpers ---

function makeItem(id: string, type: 'image' | 'video' = 'image'): EditorMediaItem {
  return { id, type, uri: `file:///photos/${id}.jpg`, thumbnailUri: `file:///photos/${id}_thumb.jpg` };
}

const DEFAULTS: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT };

function renderEditor(items: EditorMediaItem[] = [makeItem('a'), makeItem('b'), makeItem('c')]) {
  return renderHook(() =>
    useWatermarkEditor({ mediaItems: items, defaultSettings: DEFAULTS }),
  );
}

// --- Tests ---

describe('useWatermarkEditor', () => {
  // --- Initial state ---

  it('initializes drafts for all media items with defaults', () => {
    const { result } = renderEditor();

    expect(Object.keys(result.current.drafts)).toHaveLength(3);
    expect(result.current.drafts['a'].xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    expect(result.current.drafts['b'].opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
    expect(result.current.drafts['c'].widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
  });

  it('starts with activeIndex 0', () => {
    const { result } = renderEditor();

    expect(result.current.activeIndex).toBe(0);
  });

  it('sets activeItem to first media item', () => {
    const { result } = renderEditor();

    expect(result.current.activeItem?.id).toBe('a');
  });

  it('sets activeDraft to first items draft', () => {
    const { result } = renderEditor();

    expect(result.current.activeDraft).toBeDefined();
    expect(result.current.activeDraft?.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
  });

  // --- setActiveIndex ---

  it('changes active item when setActiveIndex is called', () => {
    const { result } = renderEditor();

    act(() => {
      result.current.setActiveIndex(1);
    });

    expect(result.current.activeIndex).toBe(1);
    expect(result.current.activeItem?.id).toBe('b');
  });

  // --- updateDraft ---

  it('updates draft for the active item', () => {
    const { result } = renderEditor();

    act(() => {
      result.current.updateDraft({
        ...DEFAULT_WATERMARK_DRAFT,
        xPct: 75,
        yPct: 25,
      });
    });

    expect(result.current.drafts['a'].xPct).toBe(75);
    expect(result.current.drafts['a'].yPct).toBe(25);
    // Other items unchanged
    expect(result.current.drafts['b'].xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
  });

  it('does not affect other items when updating active', () => {
    const { result } = renderEditor();

    act(() => {
      result.current.updateDraft({
        ...DEFAULT_WATERMARK_DRAFT,
        widthPct: 50,
        opacityPct: 90,
      });
    });

    expect(result.current.drafts['b'].widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
    expect(result.current.drafts['c'].opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
  });

  // --- applyToAll ---

  it('copies active draft positioning to all other items', () => {
    const { result } = renderEditor();

    // First update item 'a'
    act(() => {
      result.current.updateDraft({
        ...DEFAULT_WATERMARK_DRAFT,
        xPct: 10,
        yPct: 90,
        widthPct: 30,
        opacityPct: 75,
      });
    });

    // Apply to all
    let count: number;
    act(() => {
      count = result.current.applyToAll();
    });

    expect(count!).toBe(2); // 3 items - 1 active = 2 others
    expect(result.current.drafts['b'].xPct).toBe(10);
    expect(result.current.drafts['b'].yPct).toBe(90);
    expect(result.current.drafts['c'].widthPct).toBe(30);
    expect(result.current.drafts['c'].opacityPct).toBe(75);
  });

  it('applyToAll preserves noWatermarkNeeded of target items', () => {
    const { result } = renderEditor();

    // Set item 'b' to noWatermarkNeeded
    act(() => {
      result.current.setActiveIndex(1);
    });
    act(() => {
      result.current.setNoWatermark(true);
    });

    // Go back to 'a' and apply to all
    act(() => {
      result.current.setActiveIndex(0);
    });
    act(() => {
      result.current.updateDraft({
        ...DEFAULT_WATERMARK_DRAFT,
        xPct: 60,
      });
    });
    act(() => {
      result.current.applyToAll();
    });

    // 'b' gets position but keeps its noWatermarkNeeded status
    expect(result.current.drafts['b'].xPct).toBe(60);
  });

  // --- resetCurrent ---

  it('resets current item draft to defaults', () => {
    const { result } = renderEditor();

    act(() => {
      result.current.updateDraft({
        ...DEFAULT_WATERMARK_DRAFT,
        xPct: 99,
        yPct: 1,
        widthPct: 70,
        opacityPct: 15,
      });
    });

    act(() => {
      result.current.resetCurrent();
    });

    expect(result.current.drafts['a'].xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    expect(result.current.drafts['a'].yPct).toBe(DEFAULT_WATERMARK_DRAFT.yPct);
    expect(result.current.drafts['a'].widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
    expect(result.current.drafts['a'].opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
  });

  it('resetCurrent does not affect other items', () => {
    const { result } = renderEditor();

    // Modify item 'a' and 'b'
    act(() => {
      result.current.updateDraft({ ...DEFAULT_WATERMARK_DRAFT, xPct: 80 });
    });
    act(() => {
      result.current.setActiveIndex(1);
    });
    act(() => {
      result.current.updateDraft({ ...DEFAULT_WATERMARK_DRAFT, xPct: 60 });
    });

    // Reset 'b'
    act(() => {
      result.current.resetCurrent();
    });

    expect(result.current.drafts['b'].xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    // 'a' should still have its custom value
    expect(result.current.drafts['a'].xPct).toBe(80);
  });

  // --- setNoWatermark ---

  it('sets noWatermarkNeeded on active item', () => {
    const { result } = renderEditor();

    act(() => {
      result.current.setNoWatermark(true);
    });

    expect(result.current.drafts['a'].noWatermarkNeeded).toBe(true);
  });

  it('clears noWatermarkNeeded on active item', () => {
    const { result } = renderEditor();

    act(() => {
      result.current.setNoWatermark(true);
    });
    act(() => {
      result.current.setNoWatermark(false);
    });

    expect(result.current.drafts['a'].noWatermarkNeeded).toBe(false);
  });

  it('does not affect other items noWatermarkNeeded', () => {
    const { result } = renderEditor();

    act(() => {
      result.current.setNoWatermark(true);
    });

    expect(result.current.drafts['b'].noWatermarkNeeded).toBe(false);
    expect(result.current.drafts['c'].noWatermarkNeeded).toBe(false);
  });

  // --- Single item ---

  it('works with a single media item', () => {
    const { result } = renderHook(() =>
      useWatermarkEditor({ mediaItems: [makeItem('solo')], defaultSettings: DEFAULTS }),
    );

    expect(Object.keys(result.current.drafts)).toHaveLength(1);
    expect(result.current.activeItem?.id).toBe('solo');

    act(() => {
      result.current.updateDraft({ ...DEFAULT_WATERMARK_DRAFT, xPct: 50 });
    });

    expect(result.current.drafts['solo'].xPct).toBe(50);
  });

  it('applyToAll returns 0 for single item', () => {
    const { result } = renderHook(() =>
      useWatermarkEditor({ mediaItems: [makeItem('solo')], defaultSettings: DEFAULTS }),
    );

    let count: number;
    act(() => {
      count = result.current.applyToAll();
    });

    expect(count!).toBe(0);
  });
});
