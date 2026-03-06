import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { getProfile } from '../services/profileService';
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
          const profileData = await getProfile(s.user.id);
          setProfile(profileData);
        } catch (_) {}
      } else {
        reset();
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => loadSession(s));

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
    <NavigationContainer>
      {session ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
