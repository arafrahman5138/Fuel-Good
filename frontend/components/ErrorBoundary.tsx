import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SUPPORT_EMAIL } from '../constants/Config';
import { reportClientError } from '../services/errorReporting';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportClientError({
      message: error?.message || 'Render error',
      source: 'ui',
      isFatal: true,
      stack: error?.stack,
      context: { componentStack: info?.componentStack || null },
    });
  }

  private handleReload = () => {
    this.setState({ error: null });
  };

  private handleContactSupport = () => {
    const body = encodeURIComponent(
      `\n\n---\nError: ${this.state.error?.message || 'Unknown'}\nPlease describe what you were doing when this happened.`,
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Fuel%20Good%20crash&body=${body}`).catch(
      () => {},
    );
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>🛠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            We hit an unexpected error. Try again, or contact support if it keeps happening.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={this.handleReload}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={this.handleContactSupport}>
            <Text style={styles.secondaryButtonText}>Contact support</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0A0A0A',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
