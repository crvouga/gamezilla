/**
 * Stacking order of the app-level hosts, read from `design-tokens.json` and
 * emitted as `--ui-layer-*`. Surfaces sit below pointer overlays so drag
 * previews and tooltips still float above modals.
 *
 * | Layer             | Host                                     |
 * | ----------------- | ---------------------------------------- |
 * | `surface`         | surface stack base (+ a step per surface) |
 * | `overlay`         | overlay portal                           |
 * | `tooltip`         | tooltip bubble                           |
 * | `harness-browser` | a harness's in-page browser              |
 */

import { readGroup, readNumber } from './design-tokens';
import { layer as layerTokens } from './design-tokens.json';

/** `z-index` per `LayerToken`. */
export const layer = readGroup({}, layerTokens, readNumber);
