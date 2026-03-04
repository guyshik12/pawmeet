import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';

export default function DogsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🦴</Text>
      <Text style={styles.title}>My Dogs</Text>
      <Text style={styles.subtitle}>Manage your dogs — coming soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
