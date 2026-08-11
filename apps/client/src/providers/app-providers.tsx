import { ComposeProviders, preventSplashAutoHide } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { ReactScanDev } from '../dev/react-scan-dev';
import { AppAuthProvider } from './app-auth-provider';
import { AppGamesProvider } from './app-games-provider';
import { AppInboxProvider } from './app-inbox-provider';
import { AppInfrastructureProvider } from './app-infrastructure-provider';
import { AppLocalDatabaseProvider } from './app-local-database-provider';
import { type AppOverrides, AppOverridesProvider } from './app-overrides';
import { AppServicesProvider } from './app-services-provider';
import { AppShellProvider } from './app-shell-provider';
import { AppSpaceRoomsProvider } from './app-space-rooms-provider';
import { AppUiProvider } from './app-ui-provider';
import { AppStatusBarRegistry } from './ui/status-bar-registry';

void preventSplashAutoHide();

/**
 * App-wide provider stack (outermost → innermost).
 *
 * Ordering constraints:
 * - Infrastructure (config, secure storage) before auth and services.
 * - Local database sync engine before UI (portal bridge reads sync engine).
 * - UI (BottomSheetModalProvider, AuthModalsProvider) before inbox (opens sign-in modal).
 * - UI before modal hosts inside AppUiProvider.
 * - Games (SpaceModule) before space room host (opens WebSockets with that module).
 * - Space rooms after sync + games so presence + module are available, and
 *   before UI modals (leave/end dispatch into the open-room host).
 * - Status bar after inbox so notification items can read unread counts.
 */
const appProviders = [
  AppShellProvider,
  AppInfrastructureProvider,
  AppAuthProvider,
  AppServicesProvider,
  AppLocalDatabaseProvider,
  AppGamesProvider,
  AppSpaceRoomsProvider,
  AppUiProvider,
  AppInboxProvider,
  AppStatusBarRegistry,
];
const USE_REACT_SCAN_DEV = false;

export function AppProviders({
  children,
  overrides,
}: {
  children: ReactNode;
  /** Simulation composition seams; omit for production boot. */
  overrides?: AppOverrides;
}): ReactNode {
  return (
    <AppOverridesProvider value={overrides ?? {}}>
      {USE_REACT_SCAN_DEV ? <ReactScanDev /> : null}
      <ComposeProviders providers={appProviders}>{children}</ComposeProviders>
    </AppOverridesProvider>
  );
}
