import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAlbumActions } from '../hooks/useAlbumActions';
import { GalleryAlbum } from '../types';

interface CreateAlbumSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (album: GalleryAlbum) => void;
}

export function CreateAlbumSheet({
  visible,
  onClose,
  onCreated,
}: CreateAlbumSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const { createAlbum, isCreating, error, clearError } = useAlbumActions();
  const [name, setName] = useState('');

  const handleCreate = useCallback(async () => {
    const album = await createAlbum(name);
    if (album) {
      setName('');
      clearError();
      onCreated(album);
      onClose();
    }
  }, [createAlbum, name, onCreated, onClose, clearError]);

  const handleClose = useCallback(() => {
    setName('');
    clearError();
    onClose();
  }, [onClose, clearError]);

  return (
    <BottomSheet visible={visible} onClose={handleClose} heightRatio={0.4}>
      <Text
        style={[
          typography.headingSmall,
          { color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs },
        ]}
      >
        {t('createAlbum')}
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
        {t('nameUsedForBothLanguages')}
      </Text>

      <Input
        label={t('albumName')}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleCreate}
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
            title={t('createAlbum')}
            onPress={handleCreate}
            loading={isCreating}
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
  },
  buttonFlex: {
    flex: 1,
  },
});
