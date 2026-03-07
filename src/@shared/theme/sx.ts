/**
 * Tailwind-like sx() style builder.
 * Maps shorthand props to React Native styles.
 */

import type { TextStyle, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import type { ColorTokens } from "./colors";
import { fontSize, spacing, spacingScale } from "./scale";

export type ColorTokenName = keyof ColorTokens;

const HAIRLINE = StyleSheet.hairlineWidth;

/** Shorthand props for theme.sx() */
export type SxProps = {
  // Padding
  p?: number;
  px?: number;
  py?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  // Margin
  m?: number;
  mx?: number;
  my?: number;
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  // Layout
  flex?: number;
  flexDirection?: ViewStyle["flexDirection"];
  alignItems?: ViewStyle["alignItems"];
  alignSelf?: ViewStyle["alignSelf"];
  justifyContent?: ViewStyle["justifyContent"];
  gap?: number;
  flexWrap?: ViewStyle["flexWrap"];
  // Background / color
  background?: ColorTokenName | string;
  color?: ColorTokenName | string;
  backgroundColor?: ColorTokenName | string;
  // Border
  borderWidth?: number;
  borderBottomWidth?: number | "hairline";
  borderColor?: ColorTokenName | string;
  borderRadius?: number;
  // Typography
  fontSize?: number | keyof typeof fontSize;
  fontWeight?: TextStyle["fontWeight"];
  fontFamily?: string;
  lineHeight?: number;
  textDecorationLine?: TextStyle["textDecorationLine"];
  fontStyle?: TextStyle["fontStyle"];
  // Other
  opacity?: number;
  position?: ViewStyle["position"];
  overflow?: ViewStyle["overflow"];
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  transform?: ViewStyle["transform"];
  animationName?: unknown;
  animationIterationCount?: number;
  animationDuration?: string;
} & Partial<Omit<ViewStyle & TextStyle, "backgroundColor" | "color" | "borderBottomWidth">>;

type ResolvedStyle = ViewStyle & TextStyle;

const SHORTHAND_KEYS = new Set([
  "p", "px", "py", "pt", "pb", "pl", "pr",
  "m", "mx", "my", "mt", "mb", "ml", "mr",
  "flex", "flexDirection", "alignItems", "alignSelf", "justifyContent", "gap", "flexWrap",
  "background", "color", "backgroundColor",
  "borderWidth", "borderBottomWidth", "borderColor", "borderRadius",
  "fontSize", "fontWeight", "fontFamily", "lineHeight", "textDecorationLine", "fontStyle",
  "opacity", "position", "overflow", "bottom", "left", "right", "top",
  "width", "height", "minWidth", "maxWidth", "transform",
]);

function resolveSpacing(n: number): number {
  return spacing[n as keyof typeof spacing] ?? spacingScale(n);
}

function resolveColor(
  value: ColorTokenName | string | undefined,
  colors: ColorTokens
): string | undefined {
  if (!value) return undefined;
  if (value === "hairline") return undefined; // special case for border width
  if (value in colors) return colors[value as ColorTokenName];
  return value; // hex or rgba
}

function resolveFontSize(
  value: number | keyof typeof fontSize | undefined
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  return fontSize[value];
}

export function createSx(colors: ColorTokens) {
  return function sx(props: SxProps): ResolvedStyle {
    const result: ResolvedStyle = {};

    // Padding
    if (props.p !== undefined) result.padding = resolveSpacing(props.p);
    if (props.px !== undefined) result.paddingHorizontal = resolveSpacing(props.px);
    if (props.py !== undefined) result.paddingVertical = resolveSpacing(props.py);
    if (props.pt !== undefined) result.paddingTop = resolveSpacing(props.pt);
    if (props.pb !== undefined) result.paddingBottom = resolveSpacing(props.pb);
    if (props.pl !== undefined) result.paddingLeft = resolveSpacing(props.pl);
    if (props.pr !== undefined) result.paddingRight = resolveSpacing(props.pr);

    // Margin
    if (props.m !== undefined) result.margin = resolveSpacing(props.m);
    if (props.mx !== undefined) result.marginHorizontal = resolveSpacing(props.mx);
    if (props.my !== undefined) result.marginVertical = resolveSpacing(props.my);
    if (props.mt !== undefined) result.marginTop = resolveSpacing(props.mt);
    if (props.mb !== undefined) result.marginBottom = resolveSpacing(props.mb);
    if (props.ml !== undefined) result.marginLeft = resolveSpacing(props.ml);
    if (props.mr !== undefined) result.marginRight = resolveSpacing(props.mr);

    // Layout
    if (props.flex !== undefined) result.flex = props.flex;
    if (props.flexDirection !== undefined) result.flexDirection = props.flexDirection;
    if (props.alignItems !== undefined) result.alignItems = props.alignItems;
    if (props.alignSelf !== undefined) result.alignSelf = props.alignSelf;
    if (props.justifyContent !== undefined) result.justifyContent = props.justifyContent;
    if (props.gap !== undefined) result.gap = resolveSpacing(props.gap);
    if (props.flexWrap !== undefined) result.flexWrap = props.flexWrap;

    // Background / color
    const bg = props.background ?? props.backgroundColor;
    if (bg !== undefined) {
      result.backgroundColor = resolveColor(bg, colors);
    }
    if (props.color !== undefined) {
      result.color = resolveColor(props.color, colors);
    }

    // Border
    if (props.borderWidth !== undefined) result.borderWidth = props.borderWidth;
    if (props.borderBottomWidth !== undefined) {
      result.borderBottomWidth =
        props.borderBottomWidth === "hairline" ? HAIRLINE : props.borderBottomWidth;
    }
    if (props.borderColor !== undefined) {
      result.borderColor = resolveColor(props.borderColor, colors);
    }
    if (props.borderRadius !== undefined) result.borderRadius = props.borderRadius;

    // Typography
    if (props.fontSize !== undefined) result.fontSize = resolveFontSize(props.fontSize);
    if (props.fontWeight !== undefined) result.fontWeight = props.fontWeight;
    if (props.fontFamily !== undefined) result.fontFamily = props.fontFamily;
    if (props.lineHeight !== undefined) result.lineHeight = props.lineHeight;
    if (props.textDecorationLine !== undefined)
      result.textDecorationLine = props.textDecorationLine;
    if (props.fontStyle !== undefined) result.fontStyle = props.fontStyle;

    // Other
    if (props.opacity !== undefined) result.opacity = props.opacity;
    if (props.position !== undefined) result.position = props.position;
    if (props.overflow !== undefined) result.overflow = props.overflow;
    if (props.bottom !== undefined) result.bottom = props.bottom;
    if (props.left !== undefined) result.left = props.left;
    if (props.right !== undefined) result.right = props.right;
    if (props.top !== undefined) result.top = props.top;
    if (props.width !== undefined) result.width = props.width;
    if (props.height !== undefined) result.height = props.height;
    if (props.minWidth !== undefined) result.minWidth = props.minWidth;
    if (props.maxWidth !== undefined) result.maxWidth = props.maxWidth;
    if (props.transform !== undefined) result.transform = props.transform;

    // Passthrough: any remaining RN style props
    for (const key of Object.keys(props)) {
      if (SHORTHAND_KEYS.has(key)) continue;
      const val = (props as Record<string, unknown>)[key];
      if (val !== undefined) {
        (result as Record<string, unknown>)[key] = val;
      }
    }

    return result;
  };
}
