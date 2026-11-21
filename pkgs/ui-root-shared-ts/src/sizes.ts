/**
 * Icon, control, measure, layout and stroke sizes in px, read from
 * `design-tokens.json`. Emitted as `--ui-icon-size-*`, `--ui-control-size-*`,
 * `--ui-max-width-*`, `--ui-size-*` and `--ui-border-width-*`.
 */

import { readGroup, readPx } from './design-tokens';
import { border, size, space } from './design-tokens.json';

/** Glyph box per `IconSizeToken`. */
export const iconSize = readGroup({}, size.icon, readPx);

/** Minimum control height per `ControlSizeToken`. A primary control is `md`. */
export const controlSize = readGroup({}, size.control, readPx);

/** Reading and layout measures per `MaxWidthToken` (`full` is 100%). */
export const maxWidth = readGroup({}, size.maxWidth, readPx);

/** Board, rail, preview and chrome measures (`--ui-size-<name>`). */
export const layoutSize = readGroup({}, size.layout, readPx);

/** Border, outline, ring and offset widths (`--ui-border-width-<name>`). */
export const borderWidth = readGroup({ space }, border.width, readPx);
