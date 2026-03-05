import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Routes } from '../constants/routes';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import { colors } from '../constants/theme';
import { APP_NAME } from '../../config/app';

export type AuthStackParamList = {
  [Routes.Login]: undefined;
  [Routes.Register]: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name={Routes.Login} component={LoginScreen} options={{ title: APP_NAME }} />
      <Stack.Screen name={Routes.Register} component={RegisterScreen} options={{ title: 'Create Account' }} />
    </Stack.Navigator>
  );
}
