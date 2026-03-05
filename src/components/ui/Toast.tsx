import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

type ToastType = 'success' | 'error' | 'info';

type Props = {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
};

export default function Toast({ message, type = 'info', visible, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  const bg = type === 'success' ? colors.success : type === 'error' ? colors.error : colors.text;

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: bg }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 100, left: spacing.lg, right: spacing.lg,
    borderRadius: borderRadius.md, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 6, zIndex: 999,
  },
  text: { ...typography.body, color: colors.surface, textAlign: 'center', fontWeight: '600' },
});
