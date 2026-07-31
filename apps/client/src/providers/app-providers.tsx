import { ComposeProviders, preventSplashAutoHide } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { ReactScanDev } from '../dev/react-scan-dev';
import { AppAuthProvider } from './app-auth-provider';
import { AppGamesProvider } from './app-games-provider';
import { AppInfrastructureProvider } from './app-infrastructure-provider';
import { AppInboxProvider } from './app-inbox-provider';
import { AppLocalDatabaseProvider } from './app-local-database-provider';
import { AppOpenSpacesProvider } from './app-open-spaces-provider';
import { AppServicesProvider } from './app-services-provider';
import { AppShellProvider } from './app-shell-provider';
import { AppSpaceRoomsProvider } from './app-space-rooms-provider';
import { AppUiProvider } from './app-ui-provider';

void preventSplashAutoHide();

/**
 * App-wide provider stack (outermost → innermost).
 *
 * Ordering constraints:
 * - Infrastructure (config, secure storage) before auth and services.
 * - Auth before open-spaces (account-scoped Kv key).
 * - Local database (PowerSync sync engine) before UI (portal bridge reads sync engine).
 * - UI (BottomSheetModalProvider, AuthModalsProvider) before inbox (opens sign-in modal).
 * - UI before modal hosts inside AppUiProvider.
 * - Games (SpaceModule) before space room host (opens WebSockets with that module).
 * - Space rooms after sync + games so presence + module are available, and
 *   before UI modals (leave/end dispatch into the open-room host).
 */
const appProviders = [
  AppShellProvider,
  AppInfrastructureProvider,
  AppAuthProvider,
  AppOpenSpacesProvider,
  AppServicesProvider,
  AppLocalDatabaseProvider,
  AppGamesProvider,
  AppSpaceRoomsProvider,
  AppUiProvider,
  AppInboxProvider,
];
const USE_REACT_SCAN_DEV = false;

export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      {USE_REACT_SCAN_DEV ? <ReactScanDev /> : null}
      <ComposeProviders providers={appProviders}>{children}</ComposeProviders>
    </>
  );
}
