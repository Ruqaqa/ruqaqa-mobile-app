import React from 'react';
import { View, ScrollView, Image, Text, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { TransactionReceipt } from '../types';

interface ReceiptThumbnailsProps {
  receipts: TransactionReceipt[];
}

export function ReceiptThumbnails({ receipts }: ReceiptThumbnailsProps) {
  const { colors, radius, spacing } = useTheme();

  if (receipts.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm }}
    >
      {receipts.map((receipt) => (
        <View
          key={receipt.id}
          style={[
            styles.thumbnail,
            {
              backgroundColor: colors.muted,
              borderRadius: radius.md,
              borderColor: colors.border,
            },
          ]}
        >
          {receipt.thumbnailURL ? (
            <Image
              source={{ uri: receipt.thumbnailURL }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <FileText size={24} color={colors.foregroundSecondary} />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 72,
    height: 72,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 72,
    height: 72,
  },
});
