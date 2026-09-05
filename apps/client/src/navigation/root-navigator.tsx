import { AppTabBarBridge } from '@apps/client/ui/app-header/app-tab-bar-bridge';
import { AccountDeviceDetailScreen } from '@libs/auth/root/client/account-device/account-device-detail-screen';
import { AccountDevicesScreen } from '@libs/auth/root/client/account-device/account-devices-screen';
import { ClientConfigScreen } from '@libs/client-config/root/client/client-config-screen';
import { FriendUserScreen } from '@libs/friends/root/client/friend-user-screen-view';
import { FriendsListScreen } from '@libs/friends/root/client/friends-list-screen-view';
import { NotificationsScreen } from '@libs/notifications/root/client/notifications-screen';
import { ProfileHandleScreen } from '@libs/profile/root/client/claim-username/profile-handle-screen';
import { AvatarEditorScreen } from '@libs/profile/root/client/patch-avatar/avatar-editor-screen';
import { ProfileEditScreen } from '@libs/profile/root/client/profile-edit-screen';
import { SearchScreen } from '@libs/search/root/client/search-screen';
import { SpaceDetailScreen } from '@libs/spaces/root/client/space-detail-screen';
import { SpacesScreen } from '@libs/spaces/root/client/spaces-screen';
import { useStackProps, useTabsProps } from '@pkgs/ui';
import {
  type BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { enableFreeze } from 'react-native-screens';

import { ServerStatusScreen } from '../connection/server-status-screen';
import { AboutScreen } from '../settings/about-screen';
import { PerformanceSettingsScreen } from '../settings/performance-screen';
import { SettingsScreen } from '../settings/settings-screen';
import { SoundSettingsScreen } from '../settings/sound-screen';
import { ThemeSettingsScreen } from '../settings/theme-screen';
import { SyncScreen } from '../sync/sync-screen';
import { UiExplorerDetailScreen } from '../ui/explorer/ui-explorer-detail-screen';
import { UiExplorerScreen } from '../ui/explorer/ui-explorer-screen';
import { useAppTabs } from './app-tabs';
import AccountIndexScreen from './screens/account-index';
import AccountProvidersScreen from './screens/account-providers';
import ProfileTabScreen from './screens/profile-tab';
import SsoCallbackScreen from './screens/sso-callback';
import type { RootStackParamList, TabsParamList } from './types';

enableFreeze(true);

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

const TAB_SCREENS = {
  Spaces: SpacesScreen,
  Search: SearchScreen,
  Notifications: NotificationsScreen,
  ProfileTab: ProfileTabScreen,
} as const;

function MainTabs(): ReactNode {
  const tabsProps = useTabsProps();
  const tabs = useAppTabs();
  return (
    <Tabs.Navigator
      {...tabsProps}
      tabBar={(props) => <AppTabBarBridge {...props} />}
    >
      {tabs.map((tab) => {
        const Screen = TAB_SCREENS[tab.name];
        const Icon = tab.Icon;
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            component={Screen}
            options={
              {
                title: tab.label,
                tabBarIcon: ({ color, size }) => (
                  <Icon color={color} size={size ?? 24} />
                ),
              } satisfies BottomTabNavigationOptions
            }
          />
        );
      })}
    </Tabs.Navigator>
  );
}

export function RootNavigator(): ReactNode {
  const stackProps = useStackProps();
  return (
    <RootStack.Navigator {...stackProps}>
      <RootStack.Screen name="Tabs" component={MainTabs} />
      <RootStack.Screen
        name="Space"
        component={SpaceDetailScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <RootStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <RootStack.Screen name="ProfileHandle" component={ProfileHandleScreen} />
      <RootStack.Screen name="ProfileAvatar" component={AvatarEditorScreen} />
      <RootStack.Screen name="ProfileFriends" component={FriendsListScreen} />
      <RootStack.Screen name="FriendUser" component={FriendUserScreen} />
      <RootStack.Screen name="MoreIndex" component={SettingsScreen} />
      <RootStack.Screen name="MoreTheme" component={ThemeSettingsScreen} />
      <RootStack.Screen
        name="MorePerformance"
        component={PerformanceSettingsScreen}
      />
      <RootStack.Screen name="MoreSound" component={SoundSettingsScreen} />
      <RootStack.Screen name="MoreAbout" component={AboutScreen} />
      <RootStack.Screen name="MoreSync" component={SyncScreen} />
      <RootStack.Screen
        name="MoreServerStatus"
        component={ServerStatusScreen}
      />
      <RootStack.Screen
        name="MoreClientConfig"
        component={ClientConfigScreen}
      />
      <RootStack.Screen name="AccountIndex" component={AccountIndexScreen} />
      <RootStack.Screen
        name="AccountProviders"
        component={AccountProvidersScreen}
      />
      <RootStack.Screen
        name="AccountDevices"
        component={AccountDevicesScreen}
      />
      <RootStack.Screen
        name="AccountDevice"
        component={AccountDeviceDetailScreen}
      />
      <RootStack.Screen name="UiExplorer" component={UiExplorerScreen} />
      <RootStack.Screen
        name="UiExplorerDetail"
        component={UiExplorerDetailScreen}
      />
      <RootStack.Screen
        name="SsoCallback"
        component={SsoCallbackScreen}
        options={{ headerShown: false, animation: 'none' }}
      />
    </RootStack.Navigator>
  );
}
