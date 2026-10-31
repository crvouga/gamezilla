/** @jsxImportSource solid-js */

import type { JSX } from 'solid-js';
import type { LayoutProps } from '../layout-host/index';
import { LayoutHost } from '../layout-host/index';
import type { Direction } from '../layout-props';
import type { Responsive } from '../responsive';

export type StackVerticalProps = LayoutProps;

export type StackHorizontalProps = LayoutProps;

export type StackProps = LayoutProps & {
  /** The main axis, per breakpoint when it turns. */
  direction: Responsive<Direction>;
};

/**
 * `StackVertical` / `StackHorizontal` / `Stack` -- the layout box. It
 * arranges its children along one axis and spaces them with `gap`; it never
 * paints (that is `Surface`) and never carries meaning (that is a landmark,
 * a heading, a list).
 *
 * - `StackVertical` stacks top to bottom, `StackHorizontal` start to end.
 * - `Stack` takes `direction`, for a layout that turns at a breakpoint.
 *
 * Children stretch across the cross axis and keep their content size along
 * the main axis: a box does not shrink unless it says `shrink`, and claims
 * leftover room only with `grow`. To center, set `align="center"
 * justify="center"`; there is no separate centering component.
 *
 * @example
 * ```tsx
 * <StackHorizontal align="center" gap="sm" paddingX="lg">
 *   <Avatar … />
 *   <StackVertical grow gap="2xs">
 *     <P variant="label" lines={1}>{name()}</P>
 *     <P variant="caption">{status()}</P>
 *   </StackVertical>
 * </StackHorizontal>
 * <Stack direction={{ base: 'vertical', md: 'horizontal' }} gap={{ base: 'md', md: 'xl' }}>…</Stack>
 * ```
 */
export function StackVertical(props: StackVerticalProps): JSX.Element {
  return <LayoutHost name="StackVertical" direction="vertical" of={props} />;
}

export function StackHorizontal(props: StackHorizontalProps): JSX.Element {
  return (
    <LayoutHost name="StackHorizontal" direction="horizontal" of={props} />
  );
}

export function Stack(props: StackProps): JSX.Element {
  return <LayoutHost name="Stack" direction={props.direction} of={props} />;
}
