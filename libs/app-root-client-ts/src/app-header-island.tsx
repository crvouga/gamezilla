/** @jsxImportSource solid-js */
/**
 * Wide navigation composition: logo, tab rows and the global menu, as the
 * sidebar (`AppFrame` `rail`); ignored on compact layouts.
 */

import { useAppFrameGlobalTrailing } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { usePathname, useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { AppHeaderIslandView } from './app-header-island-view';
import { useAppTabs } from './app-tabs';
import { GlobalMenuInSidebar } from './global-menu-in-sidebar';

/**
 * Wires `AppHeaderIslandView` to the router, the tabs and the global menu;
 * in the sidebar the global menu names the person beside their face.
 */
export function AppHeaderIslandHost(props: {
  readonly orientation?: 'horizontal' | 'vertical' | undefined;
}): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = useAppTabs();
  const trailing = useAppFrameGlobalTrailing();
  return (
    <AppHeaderIslandView
      tabs={tabs()}
      pathname={pathname()}
      onSelect={(tab) => router.push(tab.href)}
      trailing={
        props.orientation === 'vertical' ? (
          <GlobalMenuInSidebar>{trailing()}</GlobalMenuInSidebar>
        ) : (
          trailing()
        )
      }
      orientation={props.orientation}
    />
  );
}
