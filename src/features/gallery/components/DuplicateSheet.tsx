import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import {
  Copy,
  FileText,
  FolderOpen,
  Tag,
  Album,
  Check,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { Button } from '@/components/ui/Button';
import type { DuplicateInfo, DuplicateDecision } from '../types';

export interface DuplicateSheetResult {
  action: DuplicateDecision;
  applyToAll: boolean;
}

interface DuplicateSheetProps {
  visible: boolean;
  info: DuplicateInfo;
  onResult: (result: DuplicateSheetResult) => void;
}

/**
 * Bottom sheet shown when a duplicate file is detected during upload.
 * Displays existing item details and offers "Add to Albums" or "Skip".
 * Includes an "Apply to All Remaining" checkbox.
 *
 * DELIBERATE DESIGN: There is no "Upload anyway" option.
 * Duplicate files must not be stored twice. If the file already exists,
 * the user should link the existing item to additional albums or skip.
 * Deduplication is unconditional.
 */
export function DuplicateSheet({ visible, info, onResult }: DuplicateSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const [applyToAll, setApplyToAll] = useState(false);

  const item = info.checkResult.item;

  const handleAddToAlbums = useCallback(() => {
    onResult({ action: 'addToAlbums', applyToAll });
  }, [onResult, applyToAll]);

  const handleSkip = useCallback(() => {
    onResult({ action: 'skip', applyToAll });
  }, [onResult, applyToAll]);

  const toggleApplyToAll = useCallback(() => {
    setApplyToAll((prev) => !prev);
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      // Not dismissible — user must choose an action
      onRequestClose={handleSkip}
    >
      {/* Backdrop — non-dismissible */}
      <View style={styles.backdrop} />

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopStartRadius: radius.lg,
            borderTopEndRadius: radius.lg,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.base,
            paddingBottom: spacing.xl,
          },
        ]}
      >
        {/* Handle indicator */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Header */}
        <View style={[styles.headerRow, { marginTop: spacing.md }]}>
          <Copy size={24} color={colors.primary} />
          <View style={{ flex: 1, marginStart: spacing.md }}>
            <Text
              style={[
                typography.headingSmall,
                { color: colors.foreground },
              ]}
            >
              {t('galleryDuplicateFound')}
            </Text>
            <Text
              style={[
                typography.bodySmall,
                { color: colors.foregroundSecondary, marginTop: spacing.xxs },
              ]}
            >
              {t('galleryDuplicateSubtext')}
            </Text>
          </View>
        </View>

        {/* Existing item details card */}
        {item && (
          <View
            style={[
              styles.detailsCard,
              {
                backgroundColor: withAlpha(colors.muted, 0.7),
                borderRadius: radius.md,
                padding: spacing.md,
                marginTop: spacing.base,
              },
            ]}
          >
            {item.filename && (
              <DetailRow
                icon={<FileText size={16} color={colors.foregroundSecondary} />}
                text={item.filename}
                colors={colors}
                typography={typography}
                spacing={spacing}
              />
            )}
            {item.project && (
              <DetailRow
                icon={<FolderOpen size={16} color={colors.foregroundSecondary} />}
                text={`${t('galleryDuplicateProject')}: ${item.project.name}`}
                colors={colors}
                typography={typography}
                spacing={spacing}
              />
            )}
            {item.tags.length > 0 && (
              <DetailRow
                icon={<Tag size={16} color={colors.foregroundSecondary} />}
                text={`${t('galleryDuplicateTags')}: ${item.tags.map((tag) => tag.name).join(', ')}`}
                colors={colors}
                typography={typography}
                spacing={spacing}
              />
            )}
            {item.albums.length > 0 && (
              <DetailRow
                icon={<Album size={16} color={colors.foregroundSecondary} />}
                text={`${t('galleryDuplicateAlbums')}: ${item.albums.map((a) => a.title).join(', ')}`}
                colors={colors}
                typography={typography}
                spacing={spacing}
              />
            )}
          </View>
        )}

        {/* Apply to all checkbox */}
        <Pressable
          onPress={toggleApplyToAll}
          style={[styles.checkboxRow, { marginTop: spacing.base }]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: applyToAll }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: applyToAll ? colors.primary : colors.foregroundSecondary,
                backgroundColor: applyToAll ? colors.primary : 'transparent',
                borderRadius: 4,
              },
            ]}
          >
            {applyToAll && <Check size={14} color={colors.onPrimary} />}
          </View>
          <Text
            style={[
              typography.bodyMedium,
              { color: colors.foreground, marginStart: spacing.md, flex: 1 },
            ]}
          >
            {t('galleryDuplicateApplyToAll')}
          </Text>
        </Pressable>

        {/* Actions */}
        <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
          <Button
            title={t('galleryDuplicateAddToAlbums')}
            onPress={handleAddToAlbums}
            variant="default"
            size="lg"
            testID="duplicate-add-to-albums"
          />
          <Button
            title={t('galleryDuplicateSkip')}
            onPress={handleSkip}
            variant="outline"
            size="lg"
            testID="duplicate-skip"
          />
        </View>
      </View>
    </Modal>
  );
}

/** A single row in the details card showing icon + text. */
function DetailRow({
  icon,
  text,
  colors,
  typography: typo,
  spacing,
}: {
  icon: React.ReactNode;
  text: string;
  colors: { foregroundSecondary: string };
  typography: { bodySmall: object };
  spacing: { sm: number };
}) {
  return (
    <View style={[styles.detailRow, { marginBottom: spacing.sm }]}>
      {icon}
      <Text
        style={[
          typo.bodySmall,
          { color: colors.foregroundSecondary, marginStart: spacing.sm, flex: 1 },
        ]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailsCard: {},
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
