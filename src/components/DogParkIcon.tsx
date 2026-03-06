import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Hand-drawn style dog face — built with pure React Native Views.
 * No native dependencies so it works in Expo Go without a rebuild.
 */
export default function DogParkIcon({ size = 22 }: { size?: number }) {
  const s = size / 28;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      {/* Left ear */}
      <View style={[styles.earLeft, {
        width: 10 * s, height: 13 * s, borderRadius: 5 * s,
        left: 1 * s, top: 3 * s,
      }]} />
      {/* Right ear */}
      <View style={[styles.earRight, {
        width: 10 * s, height: 13 * s, borderRadius: 5 * s,
        right: 1 * s, top: 3 * s,
      }]} />
      {/* Head */}
      <View style={[styles.head, {
        width: 20 * s, height: 19 * s, borderRadius: 10 * s,
        top: 4 * s, left: 4 * s,
      }]} />
      {/* Snout */}
      <View style={[styles.snout, {
        width: 12 * s, height: 8 * s, borderRadius: 4 * s,
        bottom: 4 * s, left: 8 * s,
      }]} />
      {/* Nose */}
      <View style={[styles.nose, {
        width: 5 * s, height: 3.5 * s, borderRadius: 2.5 * s,
        bottom: 10 * s, left: 11.5 * s,
      }]} />
      {/* Left eye */}
      <View style={[styles.eye, {
        width: 4 * s, height: 4 * s, borderRadius: 2 * s,
        top: 9 * s, left: 7 * s,
      }]} />
      {/* Right eye */}
      <View style={[styles.eye, {
        width: 4 * s, height: 4 * s, borderRadius: 2 * s,
        top: 9 * s, right: 7 * s,
      }]} />
      {/* Tongue */}
      <View style={[styles.tongue, {
        width: 5 * s, height: 4 * s, borderRadius: 2.5 * s,
        bottom: 1 * s, left: 11.5 * s,
      }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  earLeft:  { position: 'absolute', backgroundColor: '#8B6914' },
  earRight: { position: 'absolute', backgroundColor: '#8B6914' },
  head:     { position: 'absolute', backgroundColor: '#C89B3C' },
  snout:    { position: 'absolute', backgroundColor: '#E8C06A' },
  nose:     { position: 'absolute', backgroundColor: '#2C1A0E' },
  eye:      { position: 'absolute', backgroundColor: '#1A0D00' },
  tongue:   { position: 'absolute', backgroundColor: '#E05C7A' },
});
