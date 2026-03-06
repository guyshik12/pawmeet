import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { borderRadius } from '../../constants/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function GlassCard({ children, style }: Props) {
  return (
    <View style={[styles.wrapper, style]}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    padding: 0,
  },
});
