/**
 * Apply `sx` to a React Native host: RN `style` plus captured CSS for reports.
 */

import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import {
  COMPONENT_IDS_ENABLED,
  type ComponentDataSet,
  componentDataSet,
} from '../component-id';
import type { ResolvedRnStyle } from './sx';
import type { SxInput } from './sx-props';
import { useTheme } from './theme-context';

/**
 * RN Web only polyfills `box-none` / `box-only` for StyleSheet.create
 * (atomic CSS). Inline `style.pointerEvents` is dropped, so a full-screen
 * overlay would swallow presses.
 */
const POINTER_EVENTS_STYLE = StyleSheet.create({
  auto: { pointerEvents: 'auto' },
  none: { pointerEvents: 'none' },
  'box-none': { pointerEvents: 'box-none' },
  'box-only': { pointerEvents: 'box-only' },
});

export type HostStyle = StyleProp<ViewStyle>;

export type HostSx = {
  style: HostStyle;
  dataSet: { dataSet?: ComponentDataSet };
};

function pointerEventsKey(
  value: unknown
): keyof typeof POINTER_EVENTS_STYLE | undefined {
  if (
    value === 'auto' ||
    value === 'none' ||
    value === 'box-none' ||
    value === 'box-only'
  ) {
    return value;
  }
  return undefined;
}

/**
 * Lift `pointerEvents` off an inline sx result onto a compiled stylesheet
 * entry so RN Web applies the box-none polyfill.
 */
export function toRnHostStyle(style: ResolvedRnStyle | undefined): HostStyle {
  if (style == null) return style;
  const key = pointerEventsKey(style['pointerEvents']);
  if (key === undefined) return style as ViewStyle;
  const rest: ResolvedRnStyle = { ...style };
  delete rest['pointerEvents'];
  return [rest as ViewStyle, POINTER_EVENTS_STYLE[key]];
}

/**
 * RN Web 0.21+ deprecates View `pointerEvents` — fold the prop into sx, then
 * {@link toRnHostStyle} compiles it.
 */
export function withPointerEvents(
  sx: SxInput,
  pointerEvents: unknown
): SxInput {
  const key = pointerEventsKey(pointerEvents);
  if (key === undefined) return sx;
  return [sx, { pointerEvents: key }];
}

export function useHostSx(
  name: string,
  sx: SxInput,
  dataSet?: ComponentDataSet
): HostSx {
  const theme = useTheme();
  const style = sx ? toRnHostStyle(theme.sx(sx)) : undefined;
  const css = COMPONENT_IDS_ENABLED && sx ? theme.css(sx) : undefined;
  return {
    style,
    dataSet: componentDataSet(name, {
      ...dataSet,
      ...(css !== undefined && css.length > 0 ? { css } : {}),
    }),
  };
}
