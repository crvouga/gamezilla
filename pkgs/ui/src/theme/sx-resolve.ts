/**
 * Shared token resolution for the RN and CSS sx compilers.
 */

import type { ColorTokens } from './colors';
import {
  type BorderRadiusKey,
  borderRadius,
  fontSize,
  lineHeight,
  spacing,
  spacingScale,
} from './scale';
import type { ColorTokenName, SxAnimatedNode, SxRadius } from './sx-props';

export function resolveSpacing(n: number): number {
  return spacing[n as keyof typeof spacing] ?? spacingScale(n);
}

export function resolveColor(
  value: ColorTokenName | string | undefined,
  colors: ColorTokens
): string | undefined {
  if (!value) return undefined;
  if (value in colors) return colors[value as ColorTokenName];
  return value;
}

export function resolveFontSize(
  value: number | keyof typeof fontSize | undefined
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return fontSize[value];
}

export function resolveLineHeight(
  value: number | keyof typeof lineHeight | undefined
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return lineHeight[value];
}

export function resolveRadius(value: SxRadius | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return borderRadius[value as BorderRadiusKey];
}

export function isAnimatedNode(value: unknown): value is SxAnimatedNode {
  return typeof value === 'object' && value !== null && '__getValue' in value;
}

export function snapshotAnimated(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'object' || value === null) return undefined;
  const node = value as { __getValue?: () => number | string };
  if (typeof node.__getValue !== 'function') return undefined;
  const n = node.__getValue();
  return typeof n === 'number' ? n : undefined;
}
