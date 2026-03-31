import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAlbumActions } from '../hooks/useAlbumActions';
import { GalleryAlbum } from '../types';

interface EditAlbumNameDialogProps {
  visible: boolean;
  album: GalleryAlbum | null;
  onClose: () => void;
  onSaved: (albumId: string, newTitle: string) => void;
}

export function EditAlbumNameDialog({
  visible,
  album,
  onClose,
  onSaved,
}: EditAlbumNameDialogProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const { renameAlbum, isRenaming, error, clearError } = useAlbumActions();

  const isArabic = i18n.language === 'ar';
  const currentTitle = album
    ? isArabic
      ? album.titleAr
      : album.titleEn
    : '';

  const [name, setName] = useState(currentTitle);

  // Sync input when album changes
  useEffect(() => {
    if (album) {
      setName(isArabic ? album.titleAr : album.titleEn);
    }
  }, [album, isArabic]);

  const handleSave = useCallback(async () => {
    if (!album) return;
    const success = await renameAlbum(album.id, name);
    if (success) {
      clearError();
      onSaved(album.id, name.trim());
      onClose();
    }
  }, [album, renameAlbum, name, onSaved, onClose, clearError]);

  const handleClose = useCallback(() => {
    clearError();
    onClose();
  }, [onClose, clearError]);

  if (!album) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl,
            },
          ]}
          onPress={() => {}}
        >
          <Text
            style={[
              typography.headingSmall,
              { color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs },
            ]}
          >
            {t('editAlbumName')}
          </Text>
          <Text
            style={[
              typography.bodySmall,
              {
                color: colors.foregroundSecondary,
                textAlign: 'center',
                marginBottom: spacing.lg,
              },
            ]}
          >
            {isArabic ? t('editingArabicName') : t('editingEnglishName')}
          </Text>

          <Input
            label={t('albumName')}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={[styles.buttonRow, { gap: spacing.md }]}>
            <View style={styles.buttonFlex}>
              <Button
                title={t('cancel')}
                variant="ghost"
                onPress={handleClose}
              />
            </View>
            <View style={styles.buttonFlex}>
              <Button
                title={t('save')}
                onPress={handleSave}
                loading={isRenaming}
                disabled={name.trim().length === 0}
              />
            </View>
          </View>

          {error && (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, textAlign: 'center', marginTop: spacing.sm },
              ]}
            >
              {t(error)}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    maxWidth: 320,
    width: '85%',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  buttonFlex: {
    flex: 1,
  },
});
