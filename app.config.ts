import { ExpoConfig, ConfigContext } from 'expo/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { APP_NAME } = require('./config/app') as { APP_NAME: string };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'pawmeet',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.pawmeet.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    package: 'com.pawmeet.app',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location to find nearby dogs.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow $(PRODUCT_NAME) to access your photos for profile pictures.',
        cameraPermission: 'Allow $(PRODUCT_NAME) to use your camera.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#4CAF50',
        sounds: [],
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: '20c4a407-2f8d-454e-8d21-9cd14d913a86',
    },
  },
  owner: 'guyshik12s-organization',
});
