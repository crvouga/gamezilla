/**
 * Custom `tabBarButton` for the navigator that overlays an active-tab
 * indicator stripe along the bottom edge of the focused tab. Used on
 * every breakpoint so the desktop header tabs and mobile bottom tabs stay
 * visually identical (matching what the user can see on both surfaces
 * via {@link AppHeaderTabs} / {@link AppTabBarBridge}).
 *
 * The indicator is `position: absolute` so it escapes the icon-over-label
 * column flex inside the button and sits at the bottom of the tap area.
 * Icon + label children are wrapped with `pointerEvents="none"` so clicks
 * on SVG/text hit the `PlatformPressable` on web (nested targets otherwise
 * swallow the press). Behavior + accessibility stay identical to React
 * Navigation's default `PlatformPressable` -- we just wrap it.
 */

import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

const INDICATOR_HEIGHT = 3;

export function AppTabBarButton(props: BottomTabBarButtonProps): ReactNode {
  const theme = useTheme();
  const focused = props['aria-selected'] === true;
  const { children, style, ...rest } = props;
  return (
    <PlatformPressable {...rest} style={style}>
      <View
        pointerEvents="none"
        style={{
          flex: 1,
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
      {focused ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: INDICATOR_HEIGHT,
            borderTopLeftRadius: INDICATOR_HEIGHT,
            borderTopRightRadius: INDICATOR_HEIGHT,
            backgroundColor: theme.colors.tint,
          }}
        />
      ) : null}
    </PlatformPressable>
  );
}
