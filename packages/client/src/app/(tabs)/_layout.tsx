import {
  Box,
  IconSymbol,
  useBreakpoint,
  useTabsProps,
} from '@gamezilla/shared/ui';
import { Tabs } from 'expo-router';

import { AppSidebar } from '@/ui/app-sidebar';

export default function TabsLayout() {
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
              title: 'Spaces',
              tabBarIcon: ({ color, size }) => (
                <IconSymbol name="house.fill" color={color} size={size ?? 24} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
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
