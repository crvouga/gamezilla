import { ComposeProviders, preventSplashAutoHide } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { ReactScanDev } from '../dev/react-scan-dev';
import { AppAuthProvider } from './app-auth-provider';
import { AppGamesProvider } from './app-games-provider';
import { AppInfrastructureProvider } from './app-infrastructure-provider';
import { AppLocalDatabaseProvider } from './app-local-database-provider';
import { AppServicesProvider } from './app-services-provider';
import { AppShellProvider } from './app-shell-provider';
import { AppUiProvider } from './app-ui-provider';

void preventSplashAutoHide();

/**
 * App-wide provider stack (outermost → innermost).
 *
 * Ordering constraints:
 * - Infrastructure (config, secure storage) before auth and services.
 * - Local database (SQLite + patch-db) before UI (portal bridge reads patch-db).
 * - UI (BottomSheetModalProvider) before modal hosts inside AppUiProvider.
 */
const appProviders = [
  AppShellProvider,
  AppInfrastructureProvider,
  AppAuthProvider,
  AppServicesProvider,
  AppLocalDatabaseProvider,
  AppUiProvider,
  AppGamesProvider,
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
