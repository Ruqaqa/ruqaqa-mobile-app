import React from 'react';
import {
  Modal,
  View,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme';

interface ReceiptViewerProps {
  visible: boolean;
  imageUri: string;
  headers?: Record<string, string>;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Full-screen image viewer modal with pinch-to-zoom.
 * Uses ScrollView's built-in zoom support (works on both iOS and Android).
 */
export function ReceiptViewer({
  visible,
  imageUri,
  headers,
  onClose,
}: ReceiptViewerProps) {
  const { spacing } = useTheme();
  const [loading, setLoading] = React.useState(true);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Close button */}
        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { top: spacing.xl + spacing.base }]}
          hitSlop={16}
        >
          <X size={24} color="#fff" />
        </Pressable>

        {/* Zoomable image */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bouncesZoom
        >
          <Image
            source={{ uri: imageUri, headers }}
            style={styles.fullImage}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />
        </ScrollView>

        {loading && (
          <ActivityIndicator
            size="large"
            color="#fff"
            style={styles.loader}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    end: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
