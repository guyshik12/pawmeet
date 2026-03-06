import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

export type MessageBannerData = {
  friendDogName: string;
  friendshipId: string;
  friendName: string;
  isUserA: boolean;
  message: string;
};

type Props = {
  data: MessageBannerData | null;
  onDismiss: () => void;
  onPress: (data: MessageBannerData) => void;
};

export default function InAppMessageBanner({ data, onDismiss, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const hide = () => {
    translateY.value = withTiming(-120, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 }, (done) => {
      if (done) runOnJS(onDismiss)();
    });
  };

  useEffect(() => {
    if (!data) return;
    translateY.value = withSpring(0, { damping: 18, stiffness: 160 });
    opacity.value = withTiming(1, { duration: 200 });

    const timer = setTimeout(hide, 4000);
    return () => clearTimeout(timer);
  }, [data?.friendshipId, data?.message]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!data) return null;

  return (
    <Animated.View style={[styles.container, { top: insets.top + 8 }, animStyle]}>
      <TouchableOpacity
        style={styles.inner}
        activeOpacity={0.9}
        onPress={() => { hide(); onPress(data); }}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🐾</Text>
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{data.friendDogName}</Text>
          <Text style={styles.body} numberOfLines={1}>{data.message}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 22 },
  textWrap: { flex: 1 },
  title: { fontWeight: '700', fontSize: 14, color: colors.text, marginBottom: 2 },
  body: { fontSize: 13, color: colors.textSecondary },
});
