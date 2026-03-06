import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false, // We handle in-app ourselves; only show system when backgrounded
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ push_token: token.data })
      .eq('id', userId);
  } catch (_) {
    // Push token registration is best-effort
  }
}
