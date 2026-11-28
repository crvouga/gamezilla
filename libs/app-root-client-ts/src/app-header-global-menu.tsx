/** @jsxImportSource @solidjs/web */
/**
 * Global dropdown mounted as `AppFrameChromeProvider` `globalTrailing` so
 * every top bar shares it. Rows: Settings, Connectivity (→ Connection in
 * Settings), Account, Sound. Header shows `@username` and an email when one is published
 * (bridged from the sync tree via {@link useGlobalMenuIdentity}). Trigger face
 * is the current user's avatar when available; at the foot of the wide
 * sidebar their name sits beside it. The chrome shows identity only:
 * it knows nothing of sign-in state or membership, so it cannot branch on them.
 */

import { useGlobalMenuIdentity } from '@libs/app-env-client-ts/global-menu-identity-context';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from '@solidjs/web';
import { AppHeaderGlobalMenuView } from './app-header-global-menu-view';
import { createConnectivity } from './use-connectivity';

/** Wires `AppHeaderGlobalMenuView` to identity, connectivity and preferences. */
export function AppHeaderGlobalMenu(props: {
  readonly showName?: boolean;
}): JSX.Element {
  const router = useRouter();
  const connectivity = createConnectivity();
  const menuIdentity = useGlobalMenuIdentity();
  const { muted } = useSoundsPreference();
  return (
    <AppHeaderGlobalMenuView
      identity={menuIdentity()}
      connectivity={connectivity.status()}
      muted={muted()}
      onNavigate={(href) => router.push(href)}
      showName={props.showName}
    />
  );
}
