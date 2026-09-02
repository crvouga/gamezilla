'use client';

import React from 'react';
import { Animated, type StyleProp, View, type ViewStyle } from 'react-native';
/**
 * Web Screen shim: RN Web 0.21+ deprecates View `pointerEvents` props.
 * `@react-navigation/bottom-tabs` still passes the prop on inactive tabs;
 * fold it into `style` before it reaches the host View.
 */
import type { ScreenProps } from 'react-native-screens';
import { screensEnabled } from 'react-native-screens';

type PointerEventsProp = 'auto' | 'none' | 'box-none' | 'box-only';

function withPointerEventsStyle(
  style: StyleProp<ViewStyle> | undefined,
  activityState: number | undefined,
  pointerEvents: PointerEventsProp | undefined
): StyleProp<ViewStyle> {
  return [
    style,
    { display: activityState !== 0 ? 'flex' : 'none' },
    pointerEvents !== undefined ? { pointerEvents } : null,
  ];
}

export const InnerScreen = View;

export class NativeScreen extends React.Component<
  ScreenProps & { pointerEvents?: PointerEventsProp }
> {
  override render(): React.JSX.Element {
    const {
      active,
      activityState: activityStateProp,
      style,
      enabled = screensEnabled(),
      pointerEvents,
      ...rest
    } = this.props;

    if (enabled) {
      let activityState: number | undefined =
        typeof activityStateProp === 'number' ? activityStateProp : undefined;
      if (active !== undefined && activityState === undefined) {
        activityState = active !== 0 ? 2 : 0;
      }
      return (
        <View
          // @ts-expect-error: hidden exists on web, but not in React Native
          hidden={activityState === 0}
          style={withPointerEventsStyle(style, activityState, pointerEvents)}
          {...rest}
        />
      );
    }

    return (
      <View
        style={pointerEvents !== undefined ? [style, { pointerEvents }] : style}
        {...rest}
      />
    );
  }
}

const Screen = Animated.createAnimatedComponent(NativeScreen);

export const ScreenContext = React.createContext(Screen);

export default Screen;
