import React, { useEffect } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
} from 'react-native-reanimated';

export type MatchModalData = {
  myDogName: string;
  myDogPhoto: string | null;
  theirDogName: string;
  theirDogPhoto: string | null;
};

// Inner content — rendered only when visible so animations reset properly
function MatchContent({
  myDogName, myDogPhoto, theirDogName, theirDogPhoto, onClose,
}: MatchModalData & { onClose: () => void }) {
  const overlayOpacity = useSharedValue(0);
  const photosY = useSharedValue(80);
  const photosOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 350 });
    photosY.value = withDelay(150, withSpring(0, { damping: 14, stiffness: 80 }));
    photosOpacity.value = withDelay(150, withTiming(1, { duration: 400 }));
    titleScale.value = withDelay(450, withSpring(1, { damping: 7, stiffness: 100 }));
    btnOpacity.value = withDelay(800, withTiming(1, { duration: 300 }));
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const photosStyle = useAnimatedStyle(() => ({
    opacity: photosOpacity.value,
    transform: [{ translateY: photosY.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ transform: [{ scale: titleScale.value }] }));
  const btnStyle = useAnimatedStyle(() => ({ opacity: btnOpacity.value }));

  return (
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Text style={[styles.decoPaw, { top: '8%', left: '10%', fontSize: 28, opacity: 0.15 }]}>🐾</Text>
        <Text style={[styles.decoPaw, { top: '14%', right: '8%', fontSize: 22, opacity: 0.12 }]}>🐾</Text>
        <Text style={[styles.decoPaw, { bottom: '26%', left: '6%', fontSize: 20, opacity: 0.1 }]}>🐾</Text>
        <Text style={[styles.decoPaw, { bottom: '32%', right: '5%', fontSize: 26, opacity: 0.13 }]}>🐾</Text>

        <Animated.View style={[styles.photosRow, photosStyle]}>
          <View style={styles.photoOuter}>
            {myDogPhoto ? (
              <Image source={{ uri: myDogPhoto }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={{ fontSize: 44 }}>🐶</Text>
              </View>
            )}
            <Text style={styles.dogLabel}>{myDogName}</Text>
          </View>

          <Text style={styles.pawBetween}>🐾</Text>

          <View style={styles.photoOuter}>
            {theirDogPhoto ? (
              <Image source={{ uri: theirDogPhoto }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={{ fontSize: 44 }}>🐶</Text>
              </View>
            )}
            <Text style={styles.dogLabel}>{theirDogName}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <Text style={styles.topEmoji}>🐶</Text>
          <Text style={styles.title}>New Park Pals!</Text>
          <Text style={styles.subtitle}>
            Tails are wagging — {myDogName} and {theirDogName} are now friends!
          </Text>
        </Animated.View>

        <Animated.View style={[styles.btnWrap, btnStyle]}>
          <TouchableOpacity style={styles.continueBtn} onPress={onClose}>
            <Text style={styles.continueBtnText}>Keep Sniffing Around 🐾</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
  );
}

// Wrapper — Modal is always mounted so iOS releases touches cleanly via visible prop
export default function MatchModal({
  visible, myDogName, myDogPhoto, theirDogName, theirDogPhoto, onClose,
}: { visible: boolean } & MatchModalData & { onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {visible && (
        <MatchContent
          myDogName={myDogName}
          myDogPhoto={myDogPhoto}
          theirDogName={theirDogName}
          theirDogPhoto={theirDogPhoto}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 16, 10, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  decoPaw: { position: 'absolute' },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    gap: 16,
  },
  photoOuter: { alignItems: 'center', gap: 10 },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FF9500',
  },
  photoPlaceholder: {
    backgroundColor: '#1A2010',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dogLabel: { color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  pawBetween: { fontSize: 38, marginHorizontal: 4 },
  titleWrap: { alignItems: 'center', marginBottom: 48 },
  topEmoji: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 34, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginTop: 10, lineHeight: 22,
  },
  btnWrap: { width: '100%' },
  continueBtn: {
    backgroundColor: '#FF9500',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
