/**
 * HeroUI Native theme bridge.
 *
 * Wraps children with `HeroUINativeProvider` so HeroUI components have the
 * portal host, animation root, and gesture handler they require. Designed
 * to be rendered *inside* the app's `ThemeProvider` so it can read the
 * resolved color scheme and translate our `Theme` tokens onto HeroUI's CSS
 * variable surface (via the `theme` prop).
 *
 * Phase 2 status (not yet activated by default):
 *   1. This file compiles because `heroui-native` is installed as a
 *      dependency of `@pkgs/ui`.
 *   2. It will NOT render correctly until apps/client adds the Uniwind /
 *      Tailwind v4 setup HeroUI requires:
 *        - `apps/client/global.css` with
 *            `@import 'tailwindcss'; @import 'uniwind'; @import 'heroui-native/styles';`
 *            `@source './node_modules/heroui-native/lib';`
 *        - Wire Uniwind into Metro + Babel so the `className` attrs HeroUI
 *          emits resolve to RN styles.
 *        - Wrap the root with `<GestureHandlerRootView style={{ flex: 1 }}>`
 *          (already present in apps/client's providers for BottomSheet).
 *   3. Once those land, this bridge becomes the value of
 *      `heroUIAdapter.RootProvider` (a future port slot) and gets composed
 *      into `apps/client/src/providers/app-providers.tsx`.
 *
 * The component intentionally stays a thin pass-through so the in-house
 * theme system remains the source of truth -- only HeroUI components read
 * the HeroUI CSS variables; the rest of the app keeps using
 * `useTheme().colors.*`.
 */

import { type ReactNode } from 'react';
import { HeroUINativeProvider } from 'heroui-native';

export type HeroUIThemeBridgeProps = {
  children: ReactNode;
};

export function HeroUIThemeBridge({
  children,
}: HeroUIThemeBridgeProps): ReactNode {
  return (
    <HeroUINativeProvider
      config={{
        // Quiet the in-dev "styling principles" console message; we render
        // HeroUI components inside our own theme + Uniwind setup.
        devInfo: { stylingPrinciples: false },
      }}
    >
      {children}
    </HeroUINativeProvider>
  );
}
