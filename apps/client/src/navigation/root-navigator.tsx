import { AppTabBarBridge } from '@apps/client/ui/app-header/app-tab-bar-bridge';
import { AccountDeviceDetailScreen } from '@libs/auth/root/client/account-device/account-device-detail-screen';
import { AccountDevicesScreen } from '@libs/auth/root/client/account-device/account-devices-screen';
import { ClientConfigScreen } from '@libs/client-config/root/client/client-config-screen';
import { FriendUserScreen } from '@libs/friends/root/client/friend-user-screen-view';
import { FriendsListScreen } from '@libs/friends/root/client/friends-list-screen-view';
import { NotificationsTabIcon } from '@libs/notifications/public';
import { NotificationsScreen } from '@libs/notifications/root/client/notifications-screen';
import { ProfileHandleScreen } from '@libs/profile/root/client/claim-username/profile-handle-screen';
import { AvatarEditorScreen } from '@libs/profile/root/client/patch-avatar/avatar-editor-screen';
import { ProfileEditScreen } from '@libs/profile/root/client/profile-edit-screen';
import { SearchScreen } from '@libs/search/root/client/search-screen';
import { SpaceDetailScreen } from '@libs/spaces/root/client/space-detail-screen';
import { SpacesScreen } from '@libs/spaces/root/client/spaces-screen';
import { useLingui } from '@lingui/react/macro';
import {
  Gamepad2Icon,
  SearchIcon,
  UserIcon,
  useStackProps,
  useTabsProps,
} from '@pkgs/ui';
import {
  type BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';

import { ServerStatusScreen } from '../connection/server-status-screen';
import { AboutScreen } from '../settings/about-screen';
import { SettingsScreen } from '../settings/settings-screen';
import { ThemeSettingsScreen } from '../settings/theme-screen';
import { SyncScreen } from '../sync/sync-screen';
import { UiExplorerDetailScreen } from '../ui/explorer/ui-explorer-detail-screen';
import { UiExplorerScreen } from '../ui/explorer/ui-explorer-screen';
import AccountIndexScreen from './screens/account-index';
import AccountProvidersScreen from './screens/account-providers';
import ProfileTabScreen from './screens/profile-tab';
import SsoCallbackScreen from './screens/sso-callback';
import type { RootStackParamList, TabsParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

function MainTabs(): ReactNode {
  const { t } = useLingui();
  const tabsProps = useTabsProps();
  return (
    <Tabs.Navigator
      {...tabsProps}
      tabBar={(props) => <AppTabBarBridge {...props} />}
    >
      <Tabs.Screen
        name="Spaces"
        component={SpacesScreen}
        options={
          {
            title: t`Spaces`,
            tabBarIcon: ({ color, size }) => (
              <Gamepad2Icon color={color} size={size ?? 24} />
            ),
          } satisfies BottomTabNavigationOptions
        }
      />
      <Tabs.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: t`Search`,
          tabBarIcon: ({ color, size }) => (
            <SearchIcon color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: t`Notifications`,
          tabBarIcon: ({ color, size }) => (
            <NotificationsTabIcon color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileTabScreen}
        options={{
          title: t`Profile`,
          tabBarIcon: ({ color, size }) => (
            <UserIcon color={color} size={size ?? 24} />
          ),
        }}
      />
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
        options={{ headerShown: false, animation: 'fade' }}
      />
    </RootStack.Navigator>
  );
}
