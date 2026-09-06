/** @jsxImportSource solid-js */
/**
 * Layout for the four tab roots. Compact: bottom `AppTabBar`. Wide: the
 * header island (default `AppFrame` header, `AppHeaderIslandHost`) owns tab
 * navigation, so nothing extra renders here.
 *
 * Deferred to the Spaces screen port: the `SpaceMiniplayer` that the RN tab
 * bar bridge pinned above the tabs on every tab.
 */

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
