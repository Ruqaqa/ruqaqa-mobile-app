import { useState, useCallback, useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { WatermarkDraft } from '../types';

export interface EditorMediaItem {
  id: string;
  type: 'image' | 'video';
  /** Local file URI for display in canvas. */
  uri: string;
  /** Thumbnail URI (for strip; same as uri for images). */
  thumbnailUri: string;
}

interface UseWatermarkEditorOptions {
  mediaItems: EditorMediaItem[];
  defaultSettings: WatermarkDraft;
}

export function useWatermarkEditor({
  mediaItems,
  defaultSettings,
}: UseWatermarkEditorOptions) {
  // Per-item drafts keyed by item id
  const [drafts, setDrafts] = useState<Record<string, WatermarkDraft>>(() => {
    const initial: Record<string, WatermarkDraft> = {};
    for (const item of mediaItems) {
      initial[item.id] = { ...defaultSettings };
    }
    return initial;
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [logoAspectRatio, setLogoAspectRatio] = useState(2.5);

  // Sync drafts when mediaItems change (items added/removed after initial render)
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of mediaItems) {
        if (!next[item.id]) {
          next[item.id] = { ...defaultSettings };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [mediaItems, defaultSettings]);

  const activeItem = mediaItems[activeIndex];
  const activeDraft = activeItem ? drafts[activeItem.id] : undefined;

  // Resolve the logo aspect ratio from the bundled asset
  const resolved = useRef(false);
  useEffect(() => {
    if (resolved.current) return;
    resolved.current = true;
    const asset = Image.resolveAssetSource(
      require('../../../../assets/logo-green.png'),
    );
    if (asset && asset.width && asset.height) {
      setLogoAspectRatio(asset.width / asset.height);
    }
  }, []);

  const updateDraft = useCallback(
    (updated: Partial<WatermarkDraft>) => {
      if (!activeItem) return;
      setDrafts((prev) => ({
        ...prev,
        [activeItem.id]: { ...prev[activeItem.id], ...updated },
      }));
    },
    [activeItem],
  );

  const applyToAll = useCallback(() => {
    if (!activeItem) return 0;
    const source = drafts[activeItem.id];
    const count = mediaItems.length - 1;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const item of mediaItems) {
        if (item.id === activeItem.id) continue;
        next[item.id] = {
          ...next[item.id],
          xPct: source.xPct,
          yPct: source.yPct,
          widthPct: source.widthPct,
          opacityPct: source.opacityPct,
        };
      }
      return next;
    });
    return count;
  }, [activeItem, drafts, mediaItems]);

  const resetCurrent = useCallback(() => {
    if (!activeItem) return;
    setDrafts((prev) => ({
      ...prev,
      [activeItem.id]: { ...defaultSettings },
    }));
  }, [activeItem, defaultSettings]);

  const setNoWatermark = useCallback(
    (value: boolean) => {
      if (!activeItem) return;
      setDrafts((prev) => ({
        ...prev,
        [activeItem.id]: { ...prev[activeItem.id], noWatermarkNeeded: value },
      }));
    },
    [activeItem],
  );

  return {
    drafts,
    activeIndex,
    setActiveIndex,
    activeItem,
    activeDraft,
    logoAspectRatio,
    updateDraft,
    applyToAll,
    resetCurrent,
    setNoWatermark,
  };
}
