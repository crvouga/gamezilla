import {
  Box,
  IconSymbol,
  useBreakpoint,
  useTabsProps,
} from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { Tabs } from 'expo-router';

import { AppSidebar } from '@gamezilla/client/ui/app-sidebar';

export default function TabsLayout() {
  const { t } = useLingui();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const props = useTabsProps({ hidden: !isMobile });
  return (
    <Box sx={{ flex: 1, flexDirection: 'row' }}>
      {!isMobile ? <AppSidebar /> : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
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
                <IconSymbol
                  name="person.fill"
                  color={color}
                  size={size ?? 24}
                />
              ),
            }}
          />
        </Tabs>
      </Box>
    </Box>
  );
}
