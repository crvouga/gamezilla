import { Stack, Tabs } from 'expo-router';
import { useTheme } from './theme-context';

export function useStackProps(): Parameters<typeof Stack>[0] {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.paper },
    },
  };
}

export function useTabsProps(props: {
  hidden: boolean;
}): Parameters<typeof Tabs>[0] {
  const theme = useTheme();
  return {
    screenOptions: {
      headerShown: false,
      tabBarActiveTintColor: theme.colors.tabIconSelected,
      tabBarInactiveTintColor: theme.colors.tabIconDefault,
      tabBarStyle: props.hidden ? { display: 'none' } : undefined,
      sceneStyle: { backgroundColor: theme.colors.paper },
    },
  };
}
