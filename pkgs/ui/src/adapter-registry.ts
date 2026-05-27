/**
 * Boot-time `UIAdapter` dispatch.
 *
 * A single `switch (UI_IMPL)` picks the active adapter when this module
 * loads. The chosen adapter is then re-exported by `index.ts` so render-time
 * has no dispatch cost: `Button` becomes the literal function the adapter
 * provided. Swapping adapters is a build-time concern, not a render-time one.
 *
 * `heroUIAdapter` is intentionally partial. The spread merge falls through
 * to the in-house implementation for any slot HeroUI doesn't provide --
 * which lets us roll the HeroUI adapter out component by component without
 * leaving holes in the public API.
 */

import { heroUIAdapter } from './adapters/heroui';
import { inhouseAdapter } from './adapters/inhouse';
import type { UIAdapter } from './ports';
import { UI_IMPL } from './ui-impl';

function selectAdapter(): UIAdapter {
  switch (UI_IMPL) {
    case 'inhouse':
      return inhouseAdapter;
    case 'heroui':
      return { ...inhouseAdapter, ...heroUIAdapter };
  }
}

export const adapter: UIAdapter = selectAdapter();
