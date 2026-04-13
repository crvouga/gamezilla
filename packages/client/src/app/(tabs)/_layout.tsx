import { BottomTabBar } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import {
  Box,
  IconSymbol,
  type AppNavigationTheme,
} from '@gamezilla/shared/ui';
import { useBreakpoint } from '@gamezilla/shared/theme';

import { AppSidebar } from '@/ui/app-sidebar';

function MainTabBar(props: BottomTabBarProps) {
  return <BottomTabBar {...props} />;
}

export default function TabsLayout() {
  const theme = useTheme() as AppNavigationTheme;
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <Box sx={{ flex: 1, flexDirection: 'row' }}>
      {!isMobile ? <AppSidebar /> : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Tabs
          tabBar={(props) => (isMobile ? <MainTabBar {...props} /> : null)}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.tabIconSelected,
            tabBarInactiveTintColor: theme.colors.tabIconDefault,
          }}
        >
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
