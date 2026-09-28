import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../constants/theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Global error boundary. Catches any uncaught render exception below it and
 * shows a recoverable fallback instead of a white screen. Reset clears the
 * error and re-renders children — usually enough to recover from a transient
 * null-handling crash without forcing a force-quit.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught render error:', error);
    // eslint-disable-next-line no-console
    console.error(info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🐾</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Sniffs hit an unexpected error. Tap below to try again.
        </Text>
        <ScrollView style={styles.detailsBox} contentContainerStyle={styles.detailsContent}>
          <Text style={styles.details}>{this.state.error.message}</Text>
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  detailsBox: {
    maxHeight: 140,
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  detailsContent: {
    padding: 12,
  },
  details: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'left',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
