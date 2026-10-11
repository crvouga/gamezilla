/**
 * Icon, control and measure sizes in px, read from `design-tokens.json`.
 * Emitted as `--ui-icon-size-*`, `--ui-control-size-*` and
 * `--ui-max-width-*`.
 */

import { readGroup, readPx } from './design-tokens';
import { size } from './design-tokens.json';

/** Glyph box per `IconSizeToken`. */
export const iconSize = readGroup({}, size.icon, readPx);

/** Minimum control height per `ControlSizeToken`. A primary control is `md`. */
export const controlSize = readGroup({}, size.control, readPx);

/** Reading and layout measures per `MaxWidthToken` (`full` is 100%). */
export const maxWidth = readGroup({}, size.maxWidth, readPx);
