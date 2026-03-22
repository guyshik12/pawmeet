import React, { useEffect } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
  withRepeat, withSequence, cancelAnimation,
} from 'react-native-reanimated';

export type MatchModalData = {
  myDogName: string;
  myDogPhoto: string | null;
  theirDogName: string;
  theirDogPhoto: string | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function FloatingPaw({ xOffset, delay, size }: { xOffset: number; delay: number; size: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.7, { duration: 400 }),
        withTiming(0.7, { duration: 1600 }),
        withTiming(0, { duration: 500 }),
        withTiming(0, { duration: 300 }),
      ),
      -1, false,
    ));
    y.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-220, { duration: 2500 }),
        withTiming(0, { duration: 300 }),
      ),
      -1, false,
    ));
    return () => { cancelAnimation(opacity); cancelAnimation(y); };
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
    position: 'absolute',
    bottom: 80,
    left: xOffset,
  }));

  return <Animated.Text style={[{ fontSize: size }, style]}>🐾</Animated.Text>;
}

function MatchContent({
  myDogName, myDogPhoto, theirDogName, theirDogPhoto, onClose, onChat,
}: MatchModalData & { onClose: () => void; onChat?: () => void }) {
  const overlayOpacity = useSharedValue(0);

  // Profile photos slide in from each side
  const dog1X = useSharedValue(-SCREEN_WIDTH * 0.55);
  const dog2X = useSharedValue(SCREEN_WIDTH * 0.55);

  // Playing dogs in the middle: alternating bounce
  const play1Y = useSharedValue(0);
  const play2Y = useSharedValue(0);
  const playingOpacity = useSharedValue(0);
  const playingScale = useSharedValue(0.7);

  const titleY = useSharedValue(24);
  const titleOpacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 300 });

    // Photos rush in
    dog1X.value = withDelay(180, withSpring(0, { damping: 7, stiffness: 70 }));
    dog2X.value = withDelay(180, withSpring(0, { damping: 7, stiffness: 70 }));

    // Playing dogs pop in after photos land, then loop
    playingOpacity.value = withDelay(600, withTiming(1, { duration: 250 }));
    playingScale.value = withDelay(600, withSpring(1, { damping: 6, stiffness: 120 }));

    play1Y.value = withDelay(650, withRepeat(
      withSequence(
        withTiming(-14, { duration: 280 }),
        withTiming(0, { duration: 240 }),
        withTiming(0, { duration: 280 }),
      ),
      -1,
      false,
    ));
    play2Y.value = withDelay(930, withRepeat(
      withSequence(
        withTiming(-14, { duration: 280 }),
        withTiming(0, { duration: 240 }),
        withTiming(0, { duration: 280 }),
      ),
      -1,
      false,
    ));

    titleY.value = withDelay(700, withSpring(0, { damping: 14, stiffness: 100 }));
    titleOpacity.value = withDelay(700, withTiming(1, { duration: 320 }));
    btnOpacity.value = withDelay(1100, withTiming(1, { duration: 300 }));

    return () => { cancelAnimation(play1Y); cancelAnimation(play2Y); };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const dog1Style = useAnimatedStyle(() => ({ transform: [{ translateX: dog1X.value }] }));
  const dog2Style = useAnimatedStyle(() => ({ transform: [{ translateX: dog2X.value }] }));
  const play1Style = useAnimatedStyle(() => ({ transform: [{ translateY: play1Y.value }] }));
  const play2Style = useAnimatedStyle(() => ({ transform: [{ translateY: play2Y.value }, { scaleX: -1 }] }));
  const playingStyle = useAnimatedStyle(() => ({
    opacity: playingOpacity.value,
    transform: [{ scale: playingScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOpacity.value }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>

      <FloatingPaw xOffset={SCREEN_WIDTH * 0.10} delay={900} size={18} />
      <FloatingPaw xOffset={SCREEN_WIDTH * 0.36} delay={1500} size={14} />
      <FloatingPaw xOffset={SCREEN_WIDTH * 0.63} delay={2000} size={20} />
      <FloatingPaw xOffset={SCREEN_WIDTH * 0.50} delay={2700} size={13} />

      <View style={styles.photosRow}>
        <Animated.View style={[styles.photoOuter, dog1Style]}>
          {myDogPhoto
            ? <Image source={{ uri: myDogPhoto }} style={styles.photo} />
            : <View style={[styles.photo, styles.photoPlaceholder]}><Text style={{ fontSize: 44 }}>🐶</Text></View>}
          <Text style={styles.dogLabel}>{myDogName}</Text>
        </Animated.View>

        <Animated.View style={[styles.playingWrap, playingStyle]}>
          <Animated.Text style={[styles.playDog, play1Style]}>🐕</Animated.Text>
          <Animated.Text style={[styles.playDog, play2Style]}>🐕</Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.photoOuter, dog2Style]}>
          {theirDogPhoto
            ? <Image source={{ uri: theirDogPhoto }} style={styles.photo} />
            : <View style={[styles.photo, styles.photoPlaceholder]}><Text style={{ fontSize: 44 }}>🐶</Text></View>}
          <Text style={styles.dogLabel}>{theirDogName}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.titleWrap, titleStyle]}>
        <Text style={styles.topEmoji}>🐶</Text>
        <Text style={styles.title}>New Park Pals!</Text>
        <Text style={styles.subtitle}>
          Tails are wagging — {myDogName} and {theirDogName} are now friends!
        </Text>
      </Animated.View>

      <Animated.View style={[styles.btnWrap, btnStyle]}>
        {onChat && (
          <TouchableOpacity style={styles.chatBtn} onPress={onChat}>
            <Text style={styles.chatBtnText}>Start Chatting 💬</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.continueBtn} onPress={onClose}>
          <Text style={styles.continueBtnText}>Keep Sniffing Around 🐾</Text>
        </TouchableOpacity>
      </Animated.View>

    </Animated.View>
  );
}

export default function MatchModal({
  visible, myDogName, myDogPhoto, theirDogName, theirDogPhoto, onClose, onChat,
}: { visible: boolean; onChat?: () => void } & MatchModalData & { onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {visible && (
        <MatchContent
          myDogName={myDogName}
          myDogPhoto={myDogPhoto}
          theirDogName={theirDogName}
          theirDogPhoto={theirDogPhoto}
          onClose={onClose}
          onChat={onChat}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 6, 2, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 44,
    gap: 8,
  },
  photoOuter: { alignItems: 'center', gap: 10 },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#E8943A',
  },
  photoPlaceholder: {
    backgroundColor: '#1C1408',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dogLabel: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  playingWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingBottom: 26,
  },
  playDog: { fontSize: 30 },
  titleWrap: { alignItems: 'center', marginBottom: 52 },
  topEmoji: { fontSize: 52, marginBottom: 10 },
  title: { fontSize: 34, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 0.4 },
  subtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.65)',
    textAlign: 'center', marginTop: 10, lineHeight: 23,
  },
  btnWrap: { width: '100%', gap: 12 },
  chatBtn: {
    backgroundColor: '#E8943A',
    borderRadius: 18, paddingVertical: 17, alignItems: 'center',
  },
  chatBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  continueBtn: {
    borderRadius: 18, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  continueBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
});
