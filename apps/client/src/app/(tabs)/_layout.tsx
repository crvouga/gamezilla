import { AppTabBarBridge } from '@apps/client/ui/app-header/app-tab-bar-bridge';
import { AppTabBarButton } from '@apps/client/ui/app-header/app-tab-bar-button';
import { IconSymbol, useTabsProps } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { Tabs } from 'expo-router';

/**
 * Top-level tab layout.
 *
 * One bar definition (`Tabs.Screen` options) drives both surfaces:
 * - Mobile: native bottom tab bar rendered by {@link AppTabBarBridge}.
 * - Desktop: the same `BottomTabBar` re-hosted inside each top-level
 *   screen's header `centerTabs` slot (see `app-header-tabs.tsx`). The
 *   bridge returns `null` on desktop so the bar is only drawn once.
 */
export default function TabsLayout() {
  const { t } = useLingui();
  const tabsProps = useTabsProps();
  return (
    <Tabs
      {...tabsProps}
      tabBar={(props) => <AppTabBarBridge {...props} />}
      screenOptions={{
        ...tabsProps.screenOptions,
        tabBarButton: (props) => <AppTabBarButton {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t`Spaces`,
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="house.fill" color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t`Profile`,
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="person.fill" color={color} size={size ?? 24} />
          ),
        }}
      />
    </Tabs>
  );
}
