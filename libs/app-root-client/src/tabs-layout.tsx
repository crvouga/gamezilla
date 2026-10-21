/** @jsxImportSource solid-js */
/**
 * Layout for the tab roots. Compact: bottom `AppTabBar` with any sub
 * docks above it. Wide: the header island (default `AppFrame` header,
 * `AppHeaderIslandHost`) owns tab navigation, and the docks sit under the
 * route body.
 *
 * Docks are a named slot, not a list of imports: whichever subs were
 * composed in contribute theirs, and a shell running one sub shows one.
 */

import { usePathname, useRouter } from '@pkgs/ui-root-client/app-router';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { useLayoutMode } from '@pkgs/ui-root-client/use-layout-mode';
import type { RouteSectionProps } from '@solidjs/router';
import { For, type JSX, Show, Suspense } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useAppSubs } from './app-subs-context';
import { AppTabBar } from './app-tab-bar';

export function TabsLayout(props: RouteSectionProps): JSX.Element {
  const mode = useLayoutMode();
  const pathname = usePathname();
  const router = useRouter();
  const subs = useAppSubs();
  return (
    <StackVertical grow>
      <StackVertical grow>{props.children}</StackVertical>
      <Suspense fallback={null}>
        <For each={subs.tabsDocks}>
          {(Dock) => <Dynamic component={Dock} />}
        </For>
      </Suspense>
      <Show when={mode() === 'compact'}>
        <AppTabBar
          pathname={pathname()}
          onSelect={(tab) => {
            if (pathname() !== tab.href) router.push(tab.href);
          }}
        />
      </Show>
    </StackVertical>
  );
}
