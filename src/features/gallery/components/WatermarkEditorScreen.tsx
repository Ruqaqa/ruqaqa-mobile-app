import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { X, Droplets } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { WatermarkDraft } from '../types';
import { useWatermarkEditor } from '../hooks/useWatermarkEditor';
import type { EditorMediaItem } from '../hooks/useWatermarkEditor';
import { WatermarkEditorCanvas } from './WatermarkEditorCanvas';
import { WatermarkThumbnailStrip } from './WatermarkThumbnailStrip';
import { OpacitySlider } from './OpacitySlider';

export { EditorMediaItem };

interface WatermarkEditorScreenProps {
  visible: boolean;
  mediaItems: EditorMediaItem[];
  defaultSettings: WatermarkDraft;
  onComplete: (drafts: Record<string, WatermarkDraft> | null) => void;
}

export function WatermarkEditorScreen({
  visible,
  mediaItems,
  defaultSettings,
  onComplete,
}: WatermarkEditorScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const {
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
  } = useWatermarkEditor({ mediaItems, defaultSettings });

  const handleApplyToAll = useCallback(() => {
    const count = applyToAll();
    // TODO: show toast/snackbar with t('watermarkAppliedToAll', { count })
    void count;
  }, [applyToAll]);

  const handleConfirm = useCallback(() => {
    onComplete(drafts);
  }, [onComplete, drafts]);

  const handleCancel = useCallback(() => {
    onComplete(null);
  }, [onComplete]);

  const handleOpacityChange = useCallback(
    (value: number) => {
      if (!activeDraft) return;
      updateDraft({ opacityPct: Math.round(value) });
    },
    [activeDraft, updateDraft],
  );

  const handleNoWatermarkToggle = useCallback(() => {
    if (!activeDraft) return;
    setNoWatermark(!activeDraft.noWatermarkNeeded);
  }, [activeDraft, setNoWatermark]);

  if (!visible || !activeItem || !activeDraft) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* ---- Header ---- */}
        <View style={styles.header}>
          <Pressable
            onPress={handleCancel}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            hitSlop={8}
            testID="close_button"
          >
            <X size={24} color="#ffffff" />
          </Pressable>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('watermarkEditorTitle')}
          </Text>

          <Pressable
            onPress={handleApplyToAll}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('watermarkApplyToAll')}
            testID="apply_all_button"
          >
            <Text style={styles.applyAllText}>
              {t('watermarkApplyToAll')}
            </Text>
          </Pressable>
        </View>

        {/* ---- Canvas with overlays ---- */}
        <View style={styles.canvasArea}>
          <WatermarkEditorCanvas
            uri={activeItem.uri}
            draft={activeDraft}
            logoAspectRatio={logoAspectRatio}
            onDraftChanged={updateDraft}
          />

          {/* No-watermark chip */}
          <View style={styles.chipContainer}>
            <Pressable
              onPress={handleNoWatermarkToggle}
              style={[
                styles.chip,
                activeDraft.noWatermarkNeeded
                  ? styles.chipActive
                  : styles.chipInactive,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: activeDraft.noWatermarkNeeded }}
              accessibilityLabel={
                activeDraft.noWatermarkNeeded
                  ? t('watermarkNoWatermarkNeeded')
                  : t('watermarkWatermarkOn')
              }
              testID="no_watermark_toggle"
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: activeDraft.noWatermarkNeeded
                      ? '#ffffff'
                      : 'rgba(255,255,255,0.7)',
                  },
                ]}
              >
                {activeDraft.noWatermarkNeeded
                  ? t('watermarkNoWatermarkNeeded')
                  : t('watermarkWatermarkOn')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ---- Opacity row ---- */}
        <View style={styles.opacityRow}>
          <Droplets size={20} color="rgba(255,255,255,0.54)" />
          <View style={styles.sliderContainer}>
            <OpacitySlider
              value={activeDraft.opacityPct}
              minimumValue={10}
              maximumValue={100}
              disabled={activeDraft.noWatermarkNeeded}
              onValueChange={handleOpacityChange}
              trackColor={colors.primary}
            />
          </View>
          <Text style={styles.opacityLabel}>
            {activeDraft.opacityPct}%
          </Text>
          <Pressable
            onPress={resetCurrent}
            style={styles.resetButton}
            accessibilityRole="button"
            accessibilityLabel={t('watermarkResetDefaults')}
            testID="reset_button"
          >
            <Text style={styles.resetText}>
              {t('watermarkResetDefaults')}
            </Text>
          </Pressable>
        </View>

        {/* ---- Thumbnail strip ---- */}
        {mediaItems.length > 1 && (
          <WatermarkThumbnailStrip
            items={mediaItems}
            activeIndex={activeIndex}
            onItemSelected={setActiveIndex}
            drafts={drafts}
          />
        )}

        {/* ---- Confirm button ---- */}
        <View style={[styles.confirmArea, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('watermarkConfirm')}
            testID="confirm_button"
          >
            <Text style={styles.confirmText}>{t('watermarkConfirm')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const PANEL_BG = '#1e293b';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PANEL_BG,
    height: 52,
    paddingHorizontal: 4,
  },
  headerButton: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  applyAllText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  // ---- Canvas area ----
  canvasArea: {
    flex: 1,
  },
  chipContainer: {
    position: 'absolute',
    top: 16,
    end: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipActive: {
    backgroundColor: '#b91c1c',
  },
  chipInactive: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // ---- Opacity row ----
  opacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PANEL_BG,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sliderContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  opacityLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    minWidth: 36,
    textAlign: 'right',
  },
  resetButton: {
    marginStart: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetText: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 12,
  },
  // ---- Confirm button ----
  confirmArea: {
    backgroundColor: PANEL_BG,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  confirmButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
