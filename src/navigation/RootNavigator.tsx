import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef } from '../services/navigationRef';
import { ActivityIndicator, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { getOrCreateProfile } from '../services/profileService';
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';
import { colors } from '../constants/theme';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { session, isLoading, setSession, setProfile, setLoading, reset } = useAuthStore();

  useEffect(() => {
    const loadSession = async (s: Session | null) => {
      if (s) {
        setSession(s);
        try {
          const fallbackName = (s.user.user_metadata as { name?: string } | null)?.name;
          const profileData = await getOrCreateProfile(s.user.id, fallbackName);
          setProfile(profileData);
        } catch (e) {
          // Profile load/create failed — usually RLS. Log it so it's visible in
          // Expo dev logs / Sentry rather than dying silently like before.
          // eslint-disable-next-line no-console
          console.warn('[RootNavigator] Failed to load/create profile:', e);
        }
      } else {
        reset();
      }
      setLoading(false);
    };

    // onAuthStateChange fires immediately with the current session (INITIAL_SESSION event),
    // so getSession() is not needed and would cause loadSession to run twice.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      loadSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {session ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
