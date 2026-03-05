import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Routes } from '../constants/routes';
import { colors } from '../constants/theme';
import { Text, TouchableOpacity, Image } from 'react-native';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import DogPickerModal from '../components/DogPickerModal';
import AddEditDogModal from '../screens/dogs/AddEditDogModal';
import { useQueryClient } from '@tanstack/react-query';
import { useDogStore } from '../store/dogStore';

const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

const DogTabIcon = ({ photoUrl, focused }: { photoUrl: string | null; focused: boolean }) => {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: 28, height: 28, borderRadius: 14,
          opacity: focused ? 1 : 0.5,
          borderWidth: focused ? 2 : 0,
          borderColor: colors.primary,
        }}
      />
    );
  }
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🐶</Text>;
};

export type AppTabsParamList = {
  [Routes.Discover]: undefined;
  FriendsStack: undefined;
  [Routes.Profile]: undefined;
};

export type FriendsStackParamList = {
  [Routes.Friends]: undefined;
  [Routes.Chat]: { friendshipId: string; friendName: string; friendDogName: string };
};

const Tab = createBottomTabNavigator<AppTabsParamList>();
const FriendsStack = createNativeStackNavigator<FriendsStackParamList>();

function FriendsNavigator() {
  return (
    <FriendsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <FriendsStack.Screen name={Routes.Friends} component={FriendsScreen} options={{ title: 'Friends' }} />
      <FriendsStack.Screen name={Routes.Chat} component={ChatScreen} />
    </FriendsStack.Navigator>
  );
}

export default function AppTabs() {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [addDogVisible, setAddDogVisible] = useState(false);
  const queryClient = useQueryClient();
  const { dogs, currentDog } = useDogStore();
  const dog = currentDog();

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textLight,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingTop: 6,
            paddingBottom: 8,
            height: 64,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800', fontSize: 20, color: colors.text },
        }}
      >
        <Tab.Screen
          name={Routes.Discover}
          component={DiscoverScreen}
          options={{ title: 'Discover', tabBarIcon: ({ focused }) => <TabIcon emoji="🐾" focused={focused} /> }}
        />
        <Tab.Screen
          name="FriendsStack"
          component={FriendsNavigator}
          options={{ headerShown: false, title: 'Friends', tabBarIcon: ({ focused }) => <TabIcon emoji="🐶" focused={focused} /> }}
        />
        <Tab.Screen
          name={Routes.Profile}
          component={ProfileScreen}
          options={{
            title: dog?.name ?? 'Profile',
            tabBarIcon: ({ focused }) => <DogTabIcon photoUrl={dog?.photo_url ?? null} focused={focused} />,
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                onLongPress={dogs.length > 0 ? () => setPickerVisible(true) : undefined}
                delayLongPress={400}
              />
            ),
          }}
        />
      </Tab.Navigator>

      <DogPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onAddDog={() => setAddDogVisible(true)}
      />
      <AddEditDogModal
        visible={addDogVisible}
        dog={null}
        onClose={() => setAddDogVisible(false)}
        onSaved={() => {
          setAddDogVisible(false);
          queryClient.invalidateQueries({ queryKey: ['dogs'] });
        }}
      />
    </>
  );
}
