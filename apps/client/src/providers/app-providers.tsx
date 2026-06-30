import { AuthBridge } from '@libs/auth/client/auth-bridge';
import { AuthClientProvider } from '@libs/auth/client/auth-client-provider';
import { AuthModalsProvider } from '@libs/auth/client/auth-modals-provider';
import { ProfileProvider } from '@libs/profile/client/profile-provider';
import { SpaceLifecycleModalProvider } from '@libs/spaces/client/lifecycle/space-lifecycle-modal-provider';
import {
  ComposeProviders,
  preventSplashAutoHide,
  SpinnerProvider,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import { ReactScanDev } from '../dev/react-scan-dev';
import { ApiClientProviderWrapper } from './api-client-provider';
import { AppI18nProviderWrapper } from './app-i18n-provider';
import { AppThemeProvider } from './app-theme-provider';
import { CommandRegistryProviderWrapper } from './command-registry-provider';
import { ConfigServiceProviderWrapper } from './config-service-provider';
import { DeviceEntityBootstrapProvider } from './device-entity-bootstrap-provider';
import { FontsProvider } from './fonts-provider';
import { GamesBootstrapProvider } from './games-bootstrap-provider';
import { GestureHandlerProvider } from './gesture-handler-provider';
import { KvProvider } from './kv-provider';
import { LlmProviderWrapper } from './llm-provider';
import { LoggerProvider } from './logger-provider';
import { ObservabilityProvider } from './observability-provider';
import { ObjectStoreProviderWrapper } from './object-store-provider';
import { PatchDbLocalDataActionsProvider } from './patch-db-local-data-actions-provider';
import { PatchDbProvider } from './patch-db-provider';
import { SafeAreaProviderWrapper } from './safe-area-provider';
import { SecureStorageProvider } from './secure-storage-provider';
import { SqlClientProvider } from './sql-client-provider';
import { SuspenseRootProvider } from './suspense-root-provider';
import { TtsProviderWrapper } from './tts-provider';
import { UiPortalsProvider } from './ui-portals-provider';

void preventSplashAutoHide();

const appProviders = [
  GestureHandlerProvider,
  SafeAreaProviderWrapper,
  FontsProvider,
  KvProvider,
  AppThemeProvider,
  UiPortalsProvider,
  SpinnerProvider,
  SecureStorageProvider,
  ConfigServiceProviderWrapper,
  AuthClientProvider,
  SuspenseRootProvider,
  AppI18nProviderWrapper,
  LoggerProvider,
  ObservabilityProvider,
  ObjectStoreProviderWrapper,
  LlmProviderWrapper,
  TtsProviderWrapper,
  ApiClientProviderWrapper,
  SqlClientProvider,
  PatchDbProvider,
  SpaceLifecycleModalProvider,
  DeviceEntityBootstrapProvider,
  PatchDbLocalDataActionsProvider,
  ProfileProvider,
  AuthBridge,
  AuthModalsProvider,
  GamesBootstrapProvider,
  CommandRegistryProviderWrapper,
];

export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      <ReactScanDev />
      <ComposeProviders providers={appProviders}>{children}</ComposeProviders>
    </>
  );
}
