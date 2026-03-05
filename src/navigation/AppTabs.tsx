import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Routes } from '../constants/routes';
import { colors } from '../constants/theme';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import WalksScreen from '../screens/walks/WalksScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { Text } from 'react-native';

const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export type AppTabsParamList = {
  [Routes.Discover]: undefined;
  [Routes.Friends]: undefined;
  [Routes.Walks]: undefined;
  [Routes.Profile]: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name={Routes.Discover}
        component={DiscoverScreen}
        options={{ title: 'Discover', tabBarIcon: ({ focused }) => <TabIcon emoji="🐾" focused={focused} /> }}
      />
      <Tab.Screen
        name={Routes.Friends}
        component={FriendsScreen}
        options={{ title: 'Friends', tabBarIcon: ({ focused }) => <TabIcon emoji="🐶" focused={focused} /> }}
      />
      <Tab.Screen
        name={Routes.Walks}
        component={WalksScreen}
        options={{ title: 'Walks', tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} /> }}
      />
      <Tab.Screen
        name={Routes.Profile}
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
