import { AppTabBarBridge } from '@apps/client/ui/app-header/app-tab-bar-bridge';
import { IconSymbol, useTabsProps } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { Tabs } from 'expo-router';

/**
 * Top-level tab layout.
 *
 * One bar definition (`Tabs.Screen` options) drives both surfaces via
 * {@link AppTabBar}: mobile bottom bar and desktop header center strip.
 */
export default function TabsLayout() {
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b580fa'},body:JSON.stringify({sessionId:'b580fa',location:'(tabs)/_layout.tsx:TabsLayout:render',message:'TabsLayout render',hypothesisId:'H8',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const { t } = useLingui();
  const tabsProps = useTabsProps();
  return (
    <Tabs {...tabsProps} tabBar={(props) => <AppTabBarBridge {...props} />}>
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
