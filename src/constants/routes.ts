export const Routes = {
  // Auth Stack
  Login: 'Login',
  Register: 'Register',

  // App Tabs
  Discover: 'Discover',
  Friends: 'Friends',
  Dogs: 'Dogs',
  Walks: 'Walks',
  Profile: 'Profile',

  // Sub-screens
  Chat: 'Chat',
  FriendProfile: 'FriendProfile',
  DogDetail: 'DogDetail',
  AddDog: 'AddDog',
  EditDog: 'EditDog',
  EditProfile: 'EditProfile',
  ScheduleWalk: 'ScheduleWalk',
  WalkDetail: 'WalkDetail',
  UserProfile: 'UserProfile',
  PackChat: 'PackChat',
  CreatePack: 'CreatePack',
  PackRequests: 'PackRequests',
  QuickMatch: 'QuickMatch',
  OpenPacks: 'OpenPacks',
} as const;

export type RouteKeys = keyof typeof Routes;
