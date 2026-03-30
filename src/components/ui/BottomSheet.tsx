import React, { useCallback, ReactNode } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Dimensions,
  Text,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  heightRatio?: number;
  children: ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  heightRatio = 0.75,
  children,
}: BottomSheetProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible) return null;

  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <View />
      </Pressable>

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            height: screenHeight * heightRatio,
            backgroundColor: colors.surface,
            borderTopStartRadius: radius.lg,
            borderTopEndRadius: radius.lg,
          },
        ]}
      >
        {/* Handle indicator */}
        <View style={styles.handleRow}>
          <View
            style={[
              styles.handle,
              { backgroundColor: colors.border },
            ]}
          />
        </View>

        {/* Close button row */}
        <View
          style={[
            styles.closeRow,
            { paddingHorizontal: spacing.base },
          ]}
        >
          {title && (
            <Text
              style={[
                typography.headingLarge,
                { color: colors.primary, flex: 1 },
              ]}
            >
              {title}
            </Text>
          )}
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.foregroundSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.base, paddingBottom: 40 }}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
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
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
