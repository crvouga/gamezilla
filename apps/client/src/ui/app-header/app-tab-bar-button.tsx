/**
 * Custom `tabBarButton` for the navigator. Used on every breakpoint so the
 * desktop header tabs and mobile bottom tabs stay visually identical
 * (matching what the user can see on both surfaces via
 * {@link AppHeaderTabs} / {@link AppTabBarBridge}).
 *
 * Icon + label children are wrapped with `pointerEvents="none"` so clicks
 * on SVG/text hit the `PlatformPressable` on web (nested targets otherwise
 * swallow the press). Behavior + accessibility stay identical to React
 * Navigation's default `PlatformPressable` -- we just wrap it.
 */

import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export function AppTabBarButton(props: BottomTabBarButtonProps): ReactNode {
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
    </PlatformPressable>
  );
}
