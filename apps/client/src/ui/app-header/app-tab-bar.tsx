/**
 * Standalone tab bar driven by live {@link BottomTabBarProps} from the
 * expo-router `Tabs` navigator. Used in the mobile bottom slot and the
 * desktop header center slot so both surfaces share one implementation.
 */

import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { Box, TOP_BAR_CONTENT_HEIGHT, useTheme } from '@pkgs/ui';
import { useMemo, type ReactNode } from 'react';

import {
  APP_TAB_ICON_SIZE,
  AppTabButton,
  HEADER_TAB_WIDTH,
  type AppTabButtonLayout,
} from './app-tab-button';

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

type TabBarRowProps = {
  props: BottomTabBarProps;
  layout: AppTabButtonLayout;
};

function AppTabBarRow({ props, layout }: TabBarRowProps): ReactNode {
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
            layout={layout}
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

export type AppTabBarProps = BottomTabBarProps & {
  layout: AppTabButtonLayout;
};

export function AppTabBar({ layout, ...props }: AppTabBarProps): ReactNode {
  const tabCount = props.state.routes.length;
  const headerWidth = tabCount * HEADER_TAB_WIDTH;

  const row = useMemo(
    () => <AppTabBarRow props={props} layout={layout} />,
    [props, layout]
  );

  if (layout === 'header') {
    return (
      <Box
        sx={{
          flexDirection: 'row',
          width: headerWidth,
          height: TOP_BAR_CONTENT_HEIGHT,
        }}
      >
        {row}
      </Box>
    );
  }

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
          height: TOP_BAR_CONTENT_HEIGHT,
        }}
      >
        {row}
      </Box>
    </Box>
  );
}
