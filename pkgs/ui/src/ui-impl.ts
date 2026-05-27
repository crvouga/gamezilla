/**
 * Active `UIAdapter` selection -- read once at module load.
 *
 * The chosen adapter is set per-app via the `EXPO_PUBLIC_UI_IMPL` env var,
 * which Metro/Expo inlines at build time. Unknown / missing values fall back
 * to the in-house adapter (the default look-and-feel).
 *
 * The full dispatch lives in `adapter-registry.ts` -- this file just exposes
 * the constant the `switch` reads.
 */

import type { UiImpl } from './ports';

function parseUiImpl(raw: string | undefined): UiImpl {
  switch (raw) {
    case 'inhouse':
      return 'inhouse';
    case 'heroui':
      return 'heroui';
    default:
      return 'inhouse';
  }
}

export const UI_IMPL: UiImpl = parseUiImpl(process.env['EXPO_PUBLIC_UI_IMPL']);
