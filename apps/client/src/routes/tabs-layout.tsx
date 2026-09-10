/** @jsxImportSource solid-js */
/**
 * Layout for the four tab roots. Compact: bottom `AppTabBar` with the
 * `SpaceMiniplayer` docked above it (RN tab-bar bridge parity). Wide: the
 * header island (default `AppFrame` header, `AppHeaderIslandHost`) owns tab
 * navigation, and the miniplayer sits under the route body.
 *
 * Miniplayer is lazy: it pulls space-room / mutation graphs that must stay off
 * the shell entry (docs/low-end-android-perf.md).
 */

import { useLayoutMode, usePathname, useRouter } from '@pkgs/ui';
import type { RouteSectionProps } from '@solidjs/router';
import { type JSX, lazy, Show, Suspense } from 'solid-js';

import { AppTabBar } from '../chrome/app-tab-bar';

const SpaceMiniplayer = lazy(() =>
  import('@libs/spaces/root/client/miniplayer/space-miniplayer').then(
    (mod) => ({ default: mod.SpaceMiniplayer })
  )
);

export function TabsLayout(props: RouteSectionProps): JSX.Element {
  const mode = useLayoutMode();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div class="box flex-1 min-h-[0]" data-component="TabsLayout">
      <div class="box flex-1 min-h-[0]">{props.children}</div>
      <Suspense fallback={null}>
        <SpaceMiniplayer />
      </Suspense>
      <Show when={mode() === 'compact'}>
        <AppTabBar
          pathname={pathname()}
          onSelect={(tab) => {
            if (pathname() !== tab.href) router.push(tab.href);
          }}
        />
      </Show>
    </div>
  );
}
