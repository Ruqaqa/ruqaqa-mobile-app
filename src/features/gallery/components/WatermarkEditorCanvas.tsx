import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Image,
  Text,
  PanResponder,
  StyleSheet,
  LayoutChangeEvent,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { WatermarkDraft } from '../types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoAsset = require('../../../../assets/logo-green.png');

const HANDLE_TOUCH_SIZE = 64;
const HANDLE_VISUAL_SIZE = 14;
const HALF_TOUCH = HANDLE_TOUCH_SIZE / 2;
const MIN_WIDTH_PCT = 5;
const MAX_WIDTH_PCT = 80;

interface WatermarkEditorCanvasProps {
  uri: string;
  draft: WatermarkDraft;
  logoAspectRatio: number;
  onDraftChanged: (updated: Partial<WatermarkDraft>) => void;
}

/** Distance between two touch points. */
function touchDistance(touches: { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function WatermarkEditorCanvas({
  uri,
  draft,
  logoAspectRatio,
  onDraftChanged,
}: WatermarkEditorCanvasProps) {
  const { t } = useTranslation();

  // Canvas dimensions (state so onLayout triggers re-render)
  const [canvasLayout, setCanvasLayout] = useState({ w: 0, h: 0 });
  const canvasSize = useRef({ w: 0, h: 0 });
  // Snapshot values at gesture start
  const baseWidthPct = useRef(0);
  const baseXPct = useRef(0);
  const baseYPct = useRef(0);
  const baseDistance = useRef(0);
  const baseDraft = useRef(draft);

  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    canvasSize.current = { w: width, h: height };
    setCanvasLayout({ w: width, h: height });
  }, []);

  // Keep baseDraft in sync so corner handlers read latest draft
  baseDraft.current = draft;

  // ---- Main overlay: drag + pinch ----
  const overlayPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !baseDraft.current.noWatermarkNeeded,
      onMoveShouldSetPanResponder: () => !baseDraft.current.noWatermarkNeeded,
      onPanResponderGrant: (evt) => {
        const d = baseDraft.current;
        baseWidthPct.current = d.widthPct;
        baseXPct.current = d.xPct;
        baseYPct.current = d.yPct;
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          baseDistance.current = touchDistance(
            touches as unknown as { pageX: number; pageY: number }[],
          );
        }
      },
      onPanResponderMove: (
        evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { w, h } = canvasSize.current;
        if (w <= 0 || h <= 0) return;

        const touches = evt.nativeEvent.touches;
        const touchCount = touches ? touches.length : 1;

        if (touchCount >= 2 && touches) {
          // Pinch to resize
          const dist = touchDistance(
            touches as unknown as { pageX: number; pageY: number }[],
          );
          if (baseDistance.current > 0) {
            const scale = dist / baseDistance.current;
            const newWidth = clamp(
              baseWidthPct.current * scale,
              MIN_WIDTH_PCT,
              MAX_WIDTH_PCT,
            );
            onDraftChanged({ widthPct: newWidth });
          }
        } else {
          // Single finger drag — cumulative from gesture start
          const dxPct = (gestureState.dx / w) * 100;
          const dyPct = (gestureState.dy / h) * 100;
          const current = baseDraft.current;
          const aspect = logoAspectRatio > 0 ? logoAspectRatio : 1;
          const hPct = (current.widthPct / aspect) * (w / h);
          const maxX = clamp(100 - current.widthPct, 0, 100);
          const maxY = clamp(100 - hPct, 0, 100);
          onDraftChanged({
            xPct: clamp(baseXPct.current + dxPct, 0, maxX),
            yPct: clamp(baseYPct.current + dyPct, 0, maxY),
          });
        }
      },
    }),
  ).current;

  // ---- Corner resize handles ----
  // Store base values per-corner at gesture start
  const cornerBase = useRef({ widthPct: 0, xPct: 0, yPct: 0 });

  const makeCornerResponder = (corner: 'nw' | 'ne' | 'sw' | 'se') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !baseDraft.current.noWatermarkNeeded,
      onMoveShouldSetPanResponder: () => !baseDraft.current.noWatermarkNeeded,
      onPanResponderGrant: () => {
        const d = baseDraft.current;
        cornerBase.current = {
          widthPct: d.widthPct,
          xPct: d.xPct,
          yPct: d.yPct,
        };
      },
      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { w, h } = canvasSize.current;
        if (w <= 0 || h <= 0) return;

        const base = cornerBase.current;
        const current = baseDraft.current;
        const dxPct = (gestureState.dx / w) * 100;
        const aspect = logoAspectRatio > 0 ? logoAspectRatio : 1;

        let newWidth = base.widthPct;
        let newX = base.xPct;
        let newY = base.yPct;

        switch (corner) {
          case 'se':
            newWidth = base.widthPct + dxPct;
            break;
          case 'sw':
            newWidth = base.widthPct - dxPct;
            newX = base.xPct + dxPct;
            break;
          case 'ne': {
            newWidth = base.widthPct + dxPct;
            const oldHPct = (base.widthPct / aspect / h) * w;
            const newHPct = (newWidth / aspect / h) * w;
            newY = base.yPct + (oldHPct - newHPct);
            break;
          }
          case 'nw': {
            newWidth = base.widthPct - dxPct;
            newX = base.xPct + dxPct;
            const oldHPct = (base.widthPct / aspect / h) * w;
            const newHPct = (newWidth / aspect / h) * w;
            newY = base.yPct + (oldHPct - newHPct);
            break;
          }
        }

        newWidth = clamp(newWidth, MIN_WIDTH_PCT, MAX_WIDTH_PCT);
        if (newX < 0) {
          newWidth += newX;
          newX = 0;
        }
        if (newWidth > 100 - newX) newWidth = 100 - newX;
        if (newY < 0) newY = 0;

        onDraftChanged({
          widthPct: clamp(newWidth, MIN_WIDTH_PCT, MAX_WIDTH_PCT),
          xPct: clamp(newX, 0, 100),
          yPct: clamp(newY, 0, 100),
        });
      },
    });

  const nwResponder = useRef(makeCornerResponder('nw')).current;
  const neResponder = useRef(makeCornerResponder('ne')).current;
  const swResponder = useRef(makeCornerResponder('sw')).current;
  const seResponder = useRef(makeCornerResponder('se')).current;

  // ---- Computed positions ----
  const { w: cW, h: cH } = canvasLayout;
  const watermarkW = (draft.widthPct / 100) * cW;
  const watermarkH =
    logoAspectRatio > 0 ? watermarkW / logoAspectRatio : watermarkW;
  const wmLeft = (draft.xPct / 100) * cW;
  const wmTop = (draft.yPct / 100) * cH;

  return (
    <View style={styles.canvas} onLayout={onCanvasLayout}>
      {/* Background media preview */}
      <Image
        source={{ uri }}
        style={[
          StyleSheet.absoluteFill,
          draft.noWatermarkNeeded && { opacity: 0.3 },
        ]}
        resizeMode="contain"
      />

      {/* Disabled overlay */}
      {draft.noWatermarkNeeded && (
        <View style={styles.disabledOverlay}>
          <View style={styles.disabledBadge}>
            <Text style={styles.disabledText}>{t('watermarkDisabled')}</Text>
          </View>
        </View>
      )}

      {/* Watermark overlay + handles */}
      {!draft.noWatermarkNeeded && cW > 0 && (
        <>
          {/* Draggable watermark image */}
          <View
            style={[
              styles.watermarkContainer,
              {
                left: wmLeft,
                top: wmTop,
                width: watermarkW,
                height: watermarkH,
              },
            ]}
            {...overlayPanResponder.panHandlers}
          >
            <Image
              source={logoAsset}
              style={[
                styles.watermarkImage,
                { opacity: draft.opacityPct / 100 },
              ]}
              resizeMode="contain"
              testID="watermark_overlay"
            />
          </View>

          {/* Selection border */}
          <View
            style={[
              styles.selectionBorder,
              {
                left: wmLeft - 1,
                top: wmTop - 1,
                width: watermarkW + 2,
                height: watermarkH + 2,
              },
            ]}
            pointerEvents="none"
          />

          {/* Corner handles */}
          <CornerHandle
            centerX={wmLeft}
            centerY={wmTop}
            panHandlers={nwResponder.panHandlers}
            testID="resize_handle_nw"
          />
          <CornerHandle
            centerX={wmLeft + watermarkW}
            centerY={wmTop}
            panHandlers={neResponder.panHandlers}
            testID="resize_handle_ne"
          />
          <CornerHandle
            centerX={wmLeft}
            centerY={wmTop + watermarkH}
            panHandlers={swResponder.panHandlers}
            testID="resize_handle_sw"
          />
          <CornerHandle
            centerX={wmLeft + watermarkW}
            centerY={wmTop + watermarkH}
            panHandlers={seResponder.panHandlers}
            testID="resize_handle_se"
          />
        </>
      )}
    </View>
  );
}

interface CornerHandleProps {
  centerX: number;
  centerY: number;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  testID: string;
}

function CornerHandle({ centerX, centerY, panHandlers, testID }: CornerHandleProps) {
  return (
    <View
      style={[
        styles.handleTouch,
        {
          left: centerX - HALF_TOUCH,
          top: centerY - HALF_TOUCH,
        },
      ]}
      {...panHandlers}
      testID={testID}
    >
      <View style={styles.handleDot} />
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#000000',
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
  },
  disabledText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  watermarkContainer: {
    position: 'absolute',
  },
  watermarkImage: {
    width: '100%',
    height: '100%',
  },
  selectionBorder: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
  },
  handleTouch: {
    position: 'absolute',
    width: HANDLE_TOUCH_SIZE,
    height: HANDLE_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    width: HANDLE_VISUAL_SIZE,
    height: HANDLE_VISUAL_SIZE,
    borderRadius: HANDLE_VISUAL_SIZE / 2,
    backgroundColor: '#1428a0',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.38,
    shadowRadius: 4,
    elevation: 4,
  },
});
