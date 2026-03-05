import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, shadow } from '../../constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'gradient' | 'outline' | 'ghost';
};

export default function GradientButton({ label, onPress, loading, disabled, style, variant = 'gradient' }: Props) {
  if (variant === 'outline') {
    return (
      <TouchableOpacity
        style={[styles.outline, (disabled || loading) && styles.disabledOutline, style]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
      >
        <Text style={styles.outlineText}>{loading ? 'Loading…' : label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled || loading} style={style} activeOpacity={0.6}>
        <Text style={styles.ghostText}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[(disabled || loading) && styles.disabledWrapper, style]}
    >
      <LinearGradient
        colors={colors.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading
          ? <ActivityIndicator color={colors.text} size="small" />
          : <Text style={styles.gradientText}>{label}</Text>
        }
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientText: { ...typography.body, color: colors.text, fontWeight: '700', fontSize: 16 },
  disabledWrapper: { opacity: 0.45 },
  outline: {
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: borderRadius.md, paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl, alignItems: 'center',
  },
  disabledOutline: { opacity: 0.4 },
  outlineText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  ghostText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
