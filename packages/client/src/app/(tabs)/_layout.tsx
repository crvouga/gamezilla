import { Tabs } from 'expo-router';

import { useTheme } from '@gamezilla/shared/theme';
import { IconSymbol } from '@gamezilla/shared/ui';
import { HapticTab } from '@/ui/haptic-tab';

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: 'Todos',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="checklist" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ui"
        options={{
          title: 'UI',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="paintbrush.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="ellipsis" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
