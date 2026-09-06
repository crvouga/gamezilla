import { AuthModalsProvider } from '@libs/auth/public/auth-modals-provider';
import { EndSpaceModalProvider } from '@libs/spaces/root/client/end-space/end-space-modal-provider';
import { LeaveSpaceModalProvider } from '@libs/spaces/root/client/leave-space/leave-space-modal-provider';
import { ReconcileEndedOpenSessions } from '@libs/spaces/root/client/reconcile-ended-open-sessions';
import { ComposeProviders } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { AppSignInCapabilities } from './auth/sign-in-capabilities';
import { AppCommandRegistry } from './ui/command-registry';
import { AppPortalContentBridge } from './ui/portal-bridge';
import { AppUiPortals } from './ui/portals';

const uiProviders = [
  AppUiPortals,
  AppPortalContentBridge,
  EndSpaceModalProvider,
  LeaveSpaceModalProvider,
  AppSignInCapabilities,
  AuthModalsProvider,
  AppCommandRegistry,
];

/**
 * Overlays, bottom sheets, portal sync-engine bridge, app modals, and command
 * palette. Must render after {@link AppLocalDatabaseProvider} (sync engine +
 * portal bridge).
 */
export function AppUiProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={uiProviders}>
      <ReconcileEndedOpenSessions />
      {children}
    </ComposeProviders>
  );
}
