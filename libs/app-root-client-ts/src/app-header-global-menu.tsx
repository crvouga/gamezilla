/** @jsxImportSource solid-js */
/**
 * Global dropdown mounted as `AppFrameChromeProvider` `globalTrailing` so
 * every top bar shares it. Rows: Settings, Connectivity (→ Connection in
 * Settings), Account, Theme, Sound. Header shows `@username` and an email when one is published
 * (bridged from the sync tree via {@link useGlobalMenuIdentity}). Trigger face
 * is the current user's avatar when available; at the foot of the wide
 * sidebar their name sits beside it. The chrome shows identity only:
 * it knows nothing of sign-in state or membership, so it cannot branch on them.
 */

import { useGlobalMenuIdentity } from '@libs/app-env-client-ts/global-menu-identity-context';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { JSX } from 'solid-js';
import { AppHeaderGlobalMenuView } from './app-header-global-menu-view';
import { useGlobalMenuInSidebar } from './global-menu-in-sidebar';
import { createConnectivity } from './use-connectivity';

/** Wires `AppHeaderGlobalMenuView` to identity, connectivity and preferences. */
export function AppHeaderGlobalMenu(): JSX.Element {
  const router = useRouter();
  const connectivity = createConnectivity();
  const menuIdentity = useGlobalMenuIdentity();
  const { preference } = useThemePreference();
  const { muted } = useSoundsPreference();
  const inSidebar = useGlobalMenuInSidebar();
  return (
    <AppHeaderGlobalMenuView
      identity={menuIdentity()}
      connectivity={connectivity.status()}
      theme={preference()}
      muted={muted()}
      onNavigate={(href) => router.push(href)}
      showName={inSidebar}
    />
  );
}
