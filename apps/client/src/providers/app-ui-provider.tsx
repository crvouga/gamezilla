import { AuthModalsProvider } from '@libs/auth/client/auth-modals-provider';
import { AccountSwitchSurface } from '@libs/auth/client/account-switch/account-switch-surface';
import { EndSpaceModalProvider } from '@libs/spaces/client/end-space/end-space-modal-provider';
import { LeaveSpaceModalProvider } from '@libs/spaces/client/leave-space/leave-space-modal-provider';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppCommandRegistry } from './ui/command-registry';
import { AppPortalContentBridge } from './ui/portal-bridge';
import { AppUiPortals } from './ui/portals';

function AccountSwitchSurfaceHost({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <>
      {children}
      <AccountSwitchSurface />
    </>
  );
}

const uiProviders = [
  AppUiPortals,
  AppPortalContentBridge,
  EndSpaceModalProvider,
  LeaveSpaceModalProvider,
  AuthModalsProvider,
  AccountSwitchSurfaceHost,
  AppCommandRegistry,
];

/**
 * Overlays, bottom sheets, portal sync-engine bridge, app modals, and command palette.
 * Must render after {@link AppLocalDatabaseProvider} (sync engine + portal bridge).
 */
export function AppUiProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={uiProviders}>{children}</ComposeProviders>
  );
}
