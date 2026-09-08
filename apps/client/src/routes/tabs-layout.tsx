/** @jsxImportSource solid-js */
/**
 * Layout for the four tab roots. Compact: bottom `AppTabBar` with the
 * `SpaceMiniplayer` docked above it (RN tab-bar bridge parity). Wide: the
 * header island (default `AppFrame` header, `AppHeaderIslandHost`) owns tab
 * navigation, and the miniplayer sits under the route body.
 */

import { SpaceMiniplayer } from '@libs/spaces/root/client/miniplayer/space-miniplayer';
import { Box, useLayoutMode, usePathname, useRouter } from '@pkgs/ui';
import type { RouteSectionProps } from '@solidjs/router';
import { type JSX, Show } from 'solid-js';

import { AppTabBar } from '../chrome/app-tab-bar';

export function TabsLayout(props: RouteSectionProps): JSX.Element {
  const mode = useLayoutMode();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <Box sx={{ flex: 1, minHeight: 0 }} dataSet={{ component: 'TabsLayout' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>{props.children}</Box>
      <SpaceMiniplayer />
      <Show when={mode() === 'compact'}>
        <AppTabBar
          pathname={pathname()}
          onSelect={(tab) => {
            if (pathname() !== tab.href) router.push(tab.href);
          }}
        />
      </Show>
    </Box>
  );
}
