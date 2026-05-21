import { IconSymbol, useBreakpoint, useTabsProps } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import { Tabs } from 'expo-router';

/**
 * Top-level tab layout.
 *
 * Mobile: native bottom tab bar (expo-router default).
 * Desktop: native bar hidden; each top-level screen renders a centered tab
 * strip inside its `ScreenBaseHeader` (see `app-header-tabs.tsx`). We never
 * render an additional outer header here, so there is only ever one top bar.
 */
export default function TabsLayout() {
  const { t } = useLingui();
  const isMobile = useBreakpoint() === 'mobile';
  const props = useTabsProps({ hidden: !isMobile });
  return (
    <Tabs {...props}>
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
