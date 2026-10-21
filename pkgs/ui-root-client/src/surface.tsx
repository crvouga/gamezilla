/** @jsxImportSource solid-js */
/**
 * `Surface` -- the painted box: a layout box with a fill role, a radius by
 * hierarchy and an optional hairline border. It is the only container a
 * screen can paint, so every fill on a screen is a named tone.
 *
 * Which painted container:
 * - `Surface` for a one-off fill: a tag, a well, a banner strip, a tile.
 * - `Card` for one self-contained unit of content (a form step, a summary):
 *   the card recipe is fixed (surface tone, card radius, border, padding) and
 *   it is a landmark element.
 * - `MenuSection` / `MenuList` / `List` for rows: one panel, hairlines
 *   between items. Never stack surfaces to make a list.
 *
 * Elevation is a tone, not a shadow: `tone="elevated"` for a raised sheet,
 * `tone="overlay"` for what floats above content.
 *
 * @example
 * ```tsx
 * <Surface tone="muted" radius="control" padding="md" gap="xs">…</Surface>
 * <Surface tone="muted" radius="full" direction="horizontal" align="center" gap="xs" paddingX="sm" paddingY="2xs">
 *   <Text variant="footnote">{t`Rated`}</Text>
 * </Surface>
 * ```
 */

import type { JSX } from 'solid-js';
import type { LayoutProps, PaintProps } from './layout-host';
import { LayoutHost } from './layout-host';
import type { Direction } from './layout-props';
import type { Responsive } from './responsive';

export type SurfaceProps = LayoutProps &
  PaintProps & {
    /** The main axis. Default `vertical`. */
    direction?: Responsive<Direction> | undefined;
  };

export function Surface(props: SurfaceProps): JSX.Element {
  return (
    <LayoutHost
      name="Surface"
      direction={props.direction ?? 'vertical'}
      of={props}
      painted
    />
  );
}
