import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Routes } from '../constants/routes';
import { colors } from '../constants/theme';
import { Text, TouchableOpacity, Image, View } from 'react-native';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import FriendProfileScreen, { FriendProfileParams } from '../screens/friends/FriendProfileScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import WalksScreen from '../screens/walks/WalksScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import DogPickerModal from '../components/DogPickerModal';
import AddEditDogModal from '../screens/dogs/AddEditDogModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDogStore } from '../store/dogStore';
import { useAuthStore } from '../store/authStore';
import { getTotalBadgeCount } from '../services/friendService';
import { getDogs } from '../services/dogService';
import { supabase } from '../lib/supabase';
import MatchModal, { MatchModalData } from '../components/MatchModal';

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
  [Routes.Walks]: undefined;
  [Routes.Profile]: undefined;
};

export type FriendsStackParamList = {
  [Routes.Friends]: undefined;
  [Routes.FriendProfile]: FriendProfileParams;
  [Routes.Chat]: { friendshipId: string; friendName: string; friendDogName: string; isUserA: boolean };
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
      <FriendsStack.Screen
        name={Routes.FriendProfile}
        component={FriendProfileScreen}
        options={({ route }: any) => ({ title: route.params?.dog?.name ?? 'Profile' })}
      />
      <FriendsStack.Screen name={Routes.Chat} component={ChatScreen} />
    </FriendsStack.Navigator>
  );
}

export default function AppTabs() {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [addDogVisible, setAddDogVisible] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { dogs, currentDog, setDogs, isOnTrip, lastDiscoverMatchMs } = useDogStore();
  const dog = currentDog();
  const seenFriendshipIds = React.useRef<Set<string>>(new Set());
  const [matchData, setMatchData] = React.useState<MatchModalData | null>(null);
  const isOnTripRef = React.useRef(isOnTrip);
  const lastDiscoverMatchMsRef = React.useRef(lastDiscoverMatchMs);
  useEffect(() => { lastDiscoverMatchMsRef.current = lastDiscoverMatchMs; }, [lastDiscoverMatchMs]);
  const activeDogIds = dog ? [dog.id] : [];

  // Load dogs immediately on auth — so all tabs have fresh data from the start
  useQuery({
    queryKey: ['dogs', user?.id],
    queryFn: async () => {
      const data = await getDogs(user!.id);
      setDogs(data);
      return data;
    },
    enabled: !!user,
    staleTime: 0,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['badge_count', dog?.id],
    queryFn: () => getTotalBadgeCount(dog?.id ?? null, user!.id),
    enabled: !!user && activeDogIds.length > 0,
    refetchInterval: 15000,
  });

  // Keep isOnTripRef in sync without causing channel re-subscription
  useEffect(() => { isOnTripRef.current = isOnTrip; }, [isOnTrip]);

  // Seed seenFriendshipIds with existing friendships so old ones don't pop up
  useEffect(() => {
    if (!dog) return;
    supabase
      .from('friendships')
      .select('id')
      .or(`dog_a.eq.${dog.id},dog_b.eq.${dog.id}`)
      .then(({ data }) => { data?.forEach((f) => seenFriendshipIds.current.add(f.id)); });
  }, [dog?.id]);

  // Poll for new friendships — reliable fallback so both sides see the match popup
  useEffect(() => {
    if (!dog) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('friendships')
        .select('id, dog_a, dog_b')
        .or(`dog_a.eq.${dog.id},dog_b.eq.${dog.id}`)
        .order('created_at', { ascending: false })
        .limit(10);
      for (const f of data ?? []) {
        if (!seenFriendshipIds.current.has(f.id)) {
          seenFriendshipIds.current.add(f.id);
          if (Date.now() - lastDiscoverMatchMsRef.current < 5000) break; // Discover just showed it
          const friendDogId = f.dog_a === dog.id ? f.dog_b : f.dog_a;
          const { data: friendDog } = await supabase
            .from('dogs').select('name, photo_url').eq('id', friendDogId).single();
          setMatchData({
            myDogName: dog.name,
            myDogPhoto: dog.photo_url ?? null,
            theirDogName: friendDog?.name ?? 'New friend',
            theirDogPhoto: friendDog?.photo_url ?? null,
          });
          break;
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [dog?.id]);

  // Realtime: badge invalidation + friend-request popup + match popup
  useEffect(() => {
    const channel = supabase
      .channel('badge_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['badge_count'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships' }, async (payload: any) => {
        const row = payload.new;
        if (!row || !dog) return;
        if (row.dog_a !== dog.id && row.dog_b !== dog.id) return;
        if (seenFriendshipIds.current.has(row.id)) return;
        seenFriendshipIds.current.add(row.id);
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        if (Date.now() - lastDiscoverMatchMsRef.current < 5000) return; // Discover just showed it
        const friendDogId = row.dog_a === dog.id ? row.dog_b : row.dog_a;
        const { data: friendDog } = await supabase
          .from('dogs').select('name, photo_url').eq('id', friendDogId).single();
        setMatchData({
          myDogName: dog.name,
          myDogPhoto: dog.photo_url ?? null,
          theirDogName: friendDog?.name ?? 'New friend',
          theirDogPhoto: friendDog?.photo_url ?? null,
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['badge_count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dog?.id]);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textLight,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingTop: 8,
            paddingBottom: 10,
            height: 68,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
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
          options={{
            headerShown: false,
            title: 'Friends',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🐶" focused={focused} />,
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          }}
        />
        <Tab.Screen
          name={Routes.Walks}
          component={WalksScreen}
          options={{
            title: 'Trip',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
          }}
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

      <MatchModal
        visible={!!matchData}
        myDogName={matchData?.myDogName ?? ''}
        myDogPhoto={matchData?.myDogPhoto ?? null}
        theirDogName={matchData?.theirDogName ?? ''}
        theirDogPhoto={matchData?.theirDogPhoto ?? null}
        onClose={() => setMatchData(null)}
      />

    </>
  );
}

