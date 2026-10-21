/**
 * Class lookups for the layout prop vocabulary in `layout-props.ts`. Each map
 * is a literal table keyed by the prop's union, so the stylesheet scanner
 * sees every class and the type checker sees every missing key.
 * Design-system internal.
 */

import type {
  MaxWidthToken,
  RadiusToken,
  SurfaceTone,
} from '@pkgs/ui-root-shared/token-names';
import type {
  Align,
  Direction,
  FlexContainerProps,
  FlexItemProps,
  Justify,
  MinHeight,
  SelfAlign,
} from './layout-props';
import type { Responsive } from './responsive';
import { responsiveClass, responsiveTable } from './responsive';

const DIRECTION = responsiveTable<Direction>({
  vertical: 'flex-col sm:flex-col md:flex-col lg:flex-col xl:flex-col',
  horizontal: 'flex-row sm:flex-row md:flex-row lg:flex-row xl:flex-row',
});

const ALIGN: Readonly<Record<Align, string>> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY: Readonly<Record<Justify, string>> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const SELF: Readonly<Record<SelfAlign, string>> = {
  auto: 'self-auto',
  start: 'self-start',
  center: 'self-center',
  end: 'self-end',
  stretch: 'self-stretch',
};

const MAX_WIDTH: Readonly<Record<MaxWidthToken, string>> = {
  prose: 'max-w-ui-prose',
  form: 'max-w-ui-form',
  content: 'max-w-ui-content',
  wide: 'max-w-ui-wide',
  full: 'max-w-full',
};

const MIN_HEIGHT: Readonly<Record<MinHeight, string>> = {
  none: 'min-h-0',
  control: 'min-h-ui-control-md',
  row: 'min-h-ui-control-lg',
  state: 'min-h-50',
  screen: 'min-h-dvh',
};

const RADIUS: Readonly<Record<RadiusToken, string>> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  control: 'rounded-control',
  card: 'rounded-card',
  sheet: 'rounded-sheet',
  full: 'rounded-full',
};

const SURFACE: Readonly<Record<SurfaceTone, string>> = {
  background: 'bg-background',
  surface: 'bg-surface',
  muted: 'bg-surface-muted',
  elevated: 'bg-surface-elevated',
  overlay: 'bg-surface-overlay',
  'tint-subtle': 'bg-tint-subtle',
  destructive: 'bg-destructive-surface',
  success: 'bg-success-surface',
  warning: 'bg-warning-surface',
  info: 'bg-info-surface',
  transparent: 'bg-transparent',
};

/** Space-joined `parts`, skipping the unset ones. */
export function spaced(parts: readonly (string | undefined)[]): string {
  return parts.filter((part) => part !== undefined && part !== '').join(' ');
}

export function directionClass(direction: Responsive<Direction>): string {
  return responsiveClass(DIRECTION, direction);
}

export function radiusClass(radius: RadiusToken | undefined): string {
  return radius === undefined ? '' : RADIUS[radius];
}

export function surfaceClass(tone: SurfaceTone): string {
  return SURFACE[tone];
}

export function flexItemClass(item: FlexItemProps): string {
  return spaced([
    item.grow === true ? 'flex-1' : undefined,
    item.shrink === true && item.grow !== true ? 'shrink' : undefined,
    item.self === undefined ? undefined : SELF[item.self],
    item.width === 'full' ? 'w-full' : undefined,
    item.height === 'full' ? 'h-full' : undefined,
    item.maxWidth === undefined ? undefined : MAX_WIDTH[item.maxWidth],
    item.minHeight === undefined ? undefined : MIN_HEIGHT[item.minHeight],
  ]);
}

export function flexContainerClass(container: FlexContainerProps): string {
  return spaced([
    container.align === undefined ? undefined : ALIGN[container.align],
    container.justify === undefined ? undefined : JUSTIFY[container.justify],
    container.wrap === true ? 'flex-wrap' : undefined,
    container.overflow === 'hidden' ? 'overflow-hidden' : undefined,
  ]);
}
