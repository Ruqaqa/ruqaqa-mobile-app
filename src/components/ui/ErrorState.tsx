import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={styles.container}>
      <AlertCircle size={48} color={colors.error} />
      <Text
        style={[
          typography.bodyLarge,
          {
            color: colors.foreground,
            marginTop: spacing.base,
            textAlign: 'center',
          },
        ]}
      >
        {message}
      </Text>
      <View style={{ marginTop: spacing.lg }}>
        <Button title="Retry" onPress={onRetry} variant="outline" size="md" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});
