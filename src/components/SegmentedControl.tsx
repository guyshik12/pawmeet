import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

type Props = {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: ViewStyle;
  scrollFraction?: number; // 0 = first tab, 1 = second tab (driven by pager)
};

export default function SegmentedControl({ options, selectedIndex, onChange, style, scrollFraction }: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const containerWidthRef = useRef(0);
  const itemWidthRef = useRef(0);

  useEffect(() => {
    // Only animate on tap (when scrollFraction is not provided or not being used)
    if (scrollFraction === undefined && itemWidthRef.current > 0) {
      Animated.spring(slideAnim, {
        toValue: selectedIndex * itemWidthRef.current,
        useNativeDriver: true,
        damping: 25,
        stiffness: 400,
      }).start();
    }
  }, [selectedIndex]);

  useEffect(() => {
    // Drive pill position directly from pager scroll
    if (scrollFraction !== undefined && itemWidthRef.current > 0) {
      slideAnim.setValue(scrollFraction * itemWidthRef.current);
    }
  }, [scrollFraction]);

  function handleLayout(e: LayoutChangeEvent) {
    const totalWidth = e.nativeEvent.layout.width;
    containerWidthRef.current = totalWidth;
    itemWidthRef.current = totalWidth / options.length;
    // Jump to position without animation on first layout
    slideAnim.setValue(selectedIndex * itemWidthRef.current);
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {/* Sliding pill highlight */}
      <Animated.View
        style={[
          styles.highlight,
          {
            width: itemWidthRef.current || `${100 / options.length}%` as any,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      />
      {options.map((option, index) => (
        <TouchableOpacity
          key={option}
          style={styles.option}
          onPress={() => onChange(index)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.optionText,
              selectedIndex === index ? styles.optionTextSelected : styles.optionTextUnselected,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: borderRadius.full,
    padding: 3,
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    zIndex: 1,
  },
  optionText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#fff',
  },
  optionTextUnselected: {
    color: colors.textSecondary,
  },
});
