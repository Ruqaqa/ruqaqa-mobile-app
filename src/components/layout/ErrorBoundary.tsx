import React, { Component, ErrorInfo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { ThemeColors } from '../../theme/colors';

// ---------------------------------------------------------------------------
// Theme-aware colors passed as props (class components cannot use hooks)
// ---------------------------------------------------------------------------

interface ErrorBoundaryColors {
  background: string;
  foreground: string;
  foregroundSecondary: string;
  border: string;
  primary: string;
}

interface InnerProps {
  children: React.ReactNode;
  colors: ErrorBoundaryColors;
}

interface State {
  hasError: boolean;
}

/**
 * Class component that catches errors. Receives theme colors via props.
 */
class ErrorBoundaryInner extends Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const { colors } = this.props;
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Something went wrong
          </Text>
          <Text style={[styles.message, { color: colors.foregroundSecondary }]}>
            An unexpected error occurred. Please try again.
          </Text>
          <Pressable
            style={[styles.button, { borderColor: colors.border }]}
            onPress={this.handleRetry}
          >
            <Text style={[styles.buttonText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Public wrapper — reads theme via hook and forwards colors
// ---------------------------------------------------------------------------

function pickColors(themeColors: ThemeColors): ErrorBoundaryColors {
  return {
    background: themeColors.background,
    foreground: themeColors.foreground,
    foregroundSecondary: themeColors.foregroundSecondary,
    border: themeColors.border,
    primary: themeColors.primary,
  };
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <ErrorBoundaryInner colors={pickColors(colors)}>
      {children}
    </ErrorBoundaryInner>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
