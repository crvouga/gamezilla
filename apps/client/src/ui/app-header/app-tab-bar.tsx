/**
 * Standalone tab bar driven by live {@link BottomTabBarProps} from the
 * expo-router `Tabs` navigator.
 */

import { Box, getTopBarContentHeight, useTheme } from '@pkgs/ui';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { type ReactNode, useMemo } from 'react';

import { APP_TAB_ICON_SIZE, AppTabButton } from './app-tab-button';

type TabRoute = BottomTabBarProps['state']['routes'][number];

function resolveTabLabel(
  options: BottomTabNavigationOptions,
  routeName: string
): string {
  const label = options.tabBarLabel ?? options.title;
  if (typeof label === 'string') return label;
  return routeName;
}

function tabTintColors(
  props: BottomTabBarProps,
  theme: ReturnType<typeof useTheme>
): { active: string; inactive: string } {
  const firstRoute = props.state.routes[0];
  const options =
    firstRoute !== undefined
      ? props.descriptors[firstRoute.key]?.options
      : undefined;
  return {
    active: options?.tabBarActiveTintColor ?? theme.colors.tint,
    inactive: options?.tabBarInactiveTintColor ?? theme.colors.tabIconDefault,
  };
}

function buildTabPressHandlers(
  props: BottomTabBarProps,
  route: TabRoute,
  focused: boolean
): { onPress: () => void; onLongPress: () => void } {
  const { navigation } = props;
  const onPress = () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };
  const onLongPress = () => {
    navigation.emit({
      type: 'tabLongPress',
      target: route.key,
    });
  };
  return { onPress, onLongPress };
}

function renderTabIcon(
  options: BottomTabNavigationOptions,
  focused: boolean,
  color: string
): ReactNode {
  const icon = options.tabBarIcon;
  if (icon === undefined) return null;
  return icon({
    focused,
    color,
    size: APP_TAB_ICON_SIZE,
  });
}

function AppTabBarRow({ props }: { props: BottomTabBarProps }): ReactNode {
  const theme = useTheme();
  const { active, inactive } = tabTintColors(props, theme);
  const { state, descriptors } = props;

  return (
    <>
      {state.routes.map((route, routeIndex) => {
        const focused = state.index === routeIndex;
        const descriptor = descriptors[route.key];
        if (descriptor === undefined) return null;
        const { options } = descriptor;
        const color = focused ? active : inactive;
        const { onPress, onLongPress } = buildTabPressHandlers(
          props,
          route,
          focused
        );
        return (
          <AppTabButton
            key={route.key}
            label={resolveTabLabel(options, route.name)}
            icon={renderTabIcon(options, focused, color)}
            focused={focused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </>
  );
}

export function AppTabBar(props: BottomTabBarProps): ReactNode {
  const { breakpoint } = useTheme();
  const tabBarHeight = getTopBarContentHeight(breakpoint);
  const row = useMemo(() => <AppTabBarRow props={props} />, [props]);

  return (
    <Box
      sx={{
        background: 'surface',
        borderTopWidth: 1,
        borderColor: 'border',
        paddingBottom: props.insets.bottom,
      }}
    >
      <Box
        sx={{
          flexDirection: 'row',
          height: tabBarHeight,
          minHeight: tabBarHeight,
        }}
      >
        {row}
      </Box>
    </Box>
  );
}
