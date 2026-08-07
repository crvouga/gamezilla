import { AuthModalsProvider } from '@libs/auth/client/auth-modals-provider';
import { EndSpaceModalProvider } from '@libs/spaces/client/end-space/end-space-modal-provider';
import { LeaveSpaceModalProvider } from '@libs/spaces/client/leave-space/leave-space-modal-provider';
import { ReconcileEndedOpenSessions } from '@libs/spaces/client/leave-space/reconcile-ended-open-sessions';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppCommandRegistry } from './ui/command-registry';
import { AppPortalContentBridge } from './ui/portal-bridge';
import { AppUiPortals } from './ui/portals';

const uiProviders = [
  AppUiPortals,
  AppPortalContentBridge,
  EndSpaceModalProvider,
  LeaveSpaceModalProvider,
  AuthModalsProvider,
  AppCommandRegistry,
];

/**
 * Overlays, bottom sheets, portal sync-engine bridge, app modals, and command
 * palette. Must render after {@link AppLocalDatabaseProvider} (sync engine +
 * portal bridge). Global status bar mounts after inbox (see AppProviders).
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
