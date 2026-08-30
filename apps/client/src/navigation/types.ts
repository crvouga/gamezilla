import type { LinkingOptions } from '@react-navigation/native';

export type RootStackParamList = {
  Tabs: undefined;
  Space: { id: string };
  ProfileEdit: undefined;
  ProfileHandle: undefined;
  ProfileAvatar: undefined;
  ProfileFriends: undefined;
  FriendUser: { userId: string };
  MoreIndex: undefined;
  MoreTheme: undefined;
  MorePerformance: undefined;
  MoreAbout: undefined;
  MoreSync: undefined;
  MoreServerStatus: undefined;
  MoreClientConfig: undefined;
  AccountIndex: undefined;
  AccountProviders: undefined;
  AccountDevices: undefined;
  AccountDevice: { deviceId: string };
  UiExplorer: undefined;
  UiExplorerDetail: { component: string };
  SsoCallback: undefined;
};

export type TabsParamList = {
  Spaces: undefined;
  Search: undefined;
  Notifications: undefined;
  ProfileTab: undefined;
};

export const appLinking: LinkingOptions<RootStackParamList> = {
  prefixes: ['gamezilla://', 'https://gamezilla.app', 'http://localhost'],
  config: {
    screens: {
      Tabs: {
        path: '',
        screens: {
          Spaces: '',
          Search: 'search',
          Notifications: 'notifications',
          ProfileTab: 'profile',
        },
      },
      Space: 'space/:id',
      ProfileEdit: 'profile/edit',
      ProfileHandle: 'profile/handle',
      ProfileAvatar: 'profile/avatar',
      ProfileFriends: 'profile/friends',
      FriendUser: 'profile/user/:userId',
      MoreIndex: 'more',
      MoreTheme: 'more/theme',
      MorePerformance: 'more/performance',
      MoreAbout: 'more/about',
      MoreSync: 'more/sync',
      MoreServerStatus: 'more/server-status',
      MoreClientConfig: 'more/client-config',
      AccountIndex: 'more/account',
      AccountProviders: 'more/account/providers',
      AccountDevices: 'more/account/devices',
      AccountDevice: 'more/account/device/:deviceId',
      UiExplorer: 'ui',
      UiExplorerDetail: 'ui/:component',
      SsoCallback: 'sso-callback',
    },
  },
};
