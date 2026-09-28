import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { colors } from './src/constants/theme';

const queryClient = new QueryClient();

export default function App() {
  const [fontsLoaded] = useFonts({
    'InstrumentSerif':         require('./assets/fonts/InstrumentSerif-Regular.ttf'),
    'InstrumentSerif-Italic':  require('./assets/fonts/InstrumentSerif-Italic.ttf'),
    'JakartaSans':             require('./assets/fonts/PlusJakartaSans-Regular.ttf'),
    'JakartaSans-Bold':        require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
    'JakartaSans-ExtraBold':   require('./assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
