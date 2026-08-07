import { AppTabBarBridge } from '@apps/client/ui/app-header/app-tab-bar-bridge';
import { useLingui } from '@lingui/react/macro';
import { InboxTabIcon } from '@pkgs/inbox/client';
import { Gamepad2Icon, SearchIcon, UserIcon, useTabsProps } from '@pkgs/ui';
import { Tabs } from 'expo-router';

/**
 * Top-level tab layout.
 */
export default function TabsLayout() {
  const { t } = useLingui();
  const tabsProps = useTabsProps();
  return (
    <Tabs {...tabsProps} tabBar={(props) => <AppTabBarBridge {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: t`Spaces`,
          tabBarIcon: ({ color, size }) => (
            <Gamepad2Icon color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="search/index"
        options={{
          title: t`Search`,
          tabBarIcon: ({ color, size }) => (
            <SearchIcon color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox/index"
        options={{
          title: t`Inbox`,
          tabBarIcon: ({ color, size }) => (
            <InboxTabIcon color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t`Profile`,
          tabBarIcon: ({ color, size }) => (
            <UserIcon color={color} size={size ?? 24} />
          ),
        }}
      />
    </Tabs>
  );
}
