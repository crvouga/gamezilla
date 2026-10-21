/**
 * Prop vocabulary shared by the layout hosts (`Stack*`, `Grid`, `Surface`,
 * `Pressable`). Every visual prop is a token name or a closed keyword; none
 * takes a class, a style, a length or a color.
 */

import type { MaxWidthToken } from '@pkgs/ui-root-shared-ts/token-names';
import type { DataSetProps } from './data-set-binding';

/** Cross-axis alignment of the children. */
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

/** Main-axis distribution of the children. */
export type Justify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';

/** This box's own cross-axis alignment inside its parent. */
export type SelfAlign = 'auto' | 'start' | 'center' | 'end' | 'stretch';

/** `vertical` stacks top to bottom, `horizontal` start to end. */
export type Direction = 'vertical' | 'horizontal';

/**
 * Floor on the box height: `control` is a primary control (48), `row` a list
 * row (56), `state` a loading / outcome block in a dialog (200, so the dialog
 * keeps its height across phases), `screen` the viewport.
 */
export type MinHeight = 'none' | 'control' | 'row' | 'state' | 'screen';

/** How the box sits in its parent. */
export type FlexItemProps = {
  /**
   * Claim the space the siblings leave, and never push the parent wider or
   * taller than it is (was `flex-1 min-w-0 min-h-0`).
   */
  grow?: boolean | undefined;
  /**
   * Let the box give up room when the parent runs out. Off by default: a
   * box keeps its content size, and the nearest scroller scrolls instead.
   */
  shrink?: boolean | undefined;
  /** Cross-axis alignment of this box alone (was `self-*`). */
  self?: SelfAlign | undefined;
  /** `full` spans the parent (was `w-full`). */
  width?: 'auto' | 'full' | undefined;
  /** `full` spans the parent (was `h-full`). */
  height?: 'auto' | 'full' | undefined;
  /** Cap the width at a measure token. Pair with `width="full"`. */
  maxWidth?: MaxWidthToken | undefined;
  minHeight?: MinHeight | undefined;
};

/** How the box arranges its children. */
export type FlexContainerProps = {
  /** Cross-axis alignment (was `items-*`). Default `stretch`. */
  align?: Align | undefined;
  /** Main-axis distribution (was `justify-*`). Default `start`. */
  justify?: Justify | undefined;
  /** Let children wrap onto further lines (was `flex-wrap`). */
  wrap?: boolean | undefined;
  /** `hidden` clips children to the box (was `overflow-hidden`). */
  overflow?: 'visible' | 'hidden' | undefined;
};

/** ARIA `aria-live` politeness. */
export type AriaLive = 'off' | 'polite' | 'assertive';

/** Roles a non-interactive container may take. */
export type RegionRole =
  | 'group'
  | 'region'
  | 'status'
  | 'alert'
  | 'list'
  | 'listitem'
  | 'tablist'
  | 'tabpanel'
  | 'toolbar'
  | 'radiogroup'
  | 'img'
  | 'presentation'
  | 'none';

/** Identity and accessibility of a container. Nothing here paints. */
export type RegionProps = {
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
  role?: RegionRole | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-live'?: AriaLive | undefined;
  /** Announce the whole region, not only what changed. */
  'aria-atomic'?: boolean | undefined;
  'aria-busy'?: boolean | undefined;
  /** Prefer `inert` to take a subtree away from everyone. */
  'aria-hidden'?: boolean | undefined;
  /** Remove the subtree from pointer, keyboard and assistive technology. */
  inert?: boolean | undefined;
  /** Render nothing visible and expose nothing (the `hidden` attribute). */
  hidden?: boolean | undefined;
} & DataSetProps;
