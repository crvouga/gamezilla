import { AuthBridge } from '@gamezilla/auth/client/auth-bridge';
import { AuthModalsProvider } from '@gamezilla/auth/client/auth-modals-provider';
import { ProfileProvider } from '@gamezilla/profile/client/profile-provider';
import { preventSplashAutoHide } from '@gamezilla/ui';
import type { ReactNode } from 'react';

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
import { LoggerProvider } from './logger-provider';
import { LlmProviderWrapper } from './llm-provider';
import { ObjectStoreProviderWrapper } from './object-store-provider';
import { PatchDbLocalDataActionsProvider } from './patch-db-local-data-actions-provider';
import { PatchDbProvider } from './patch-db-provider';
import { SafeAreaProviderWrapper } from './safe-area-provider';
import { SecureStorageProvider } from './secure-storage-provider';
import { SkiaRootProvider } from './skia-root-provider';
import { SqlClientProvider } from './sql-client-provider';
import { SuspenseRootProvider } from './suspense-root-provider';
import { TtsProviderWrapper } from './tts-provider';
import { UiPortalsProvider } from './ui-portals-provider';

void preventSplashAutoHide();

export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return (
    <GestureHandlerProvider>
      <SafeAreaProviderWrapper>
        <FontsProvider>
          <AppThemeProvider>
            <SuspenseRootProvider>
              <SkiaRootProvider>
                <AppI18nProviderWrapper>
                  <UiPortalsProvider>
                    <LoggerProvider>
                      <SecureStorageProvider>
                        <KvProvider>
                          <ConfigServiceProviderWrapper>
                            <ObjectStoreProviderWrapper>
                              <LlmProviderWrapper>
                                <TtsProviderWrapper>
                                  <ApiClientProviderWrapper>
                                    <SqlClientProvider>
                                      <PatchDbProvider>
                                        <DeviceEntityBootstrapProvider>
                                          <PatchDbLocalDataActionsProvider>
                                            <ProfileProvider>
                                              <AuthBridge />
                                              <AuthModalsProvider>
                                                <GamesBootstrapProvider>
                                                  <CommandRegistryProviderWrapper>
                                                    {children}
                                                  </CommandRegistryProviderWrapper>
                                                </GamesBootstrapProvider>
                                              </AuthModalsProvider>
                                            </ProfileProvider>
                                          </PatchDbLocalDataActionsProvider>
                                        </DeviceEntityBootstrapProvider>
                                      </PatchDbProvider>
                                    </SqlClientProvider>
                                  </ApiClientProviderWrapper>
                                </TtsProviderWrapper>
                              </LlmProviderWrapper>
                            </ObjectStoreProviderWrapper>
                          </ConfigServiceProviderWrapper>
                        </KvProvider>
                      </SecureStorageProvider>
                    </LoggerProvider>
                  </UiPortalsProvider>
                </AppI18nProviderWrapper>
              </SkiaRootProvider>
            </SuspenseRootProvider>
          </AppThemeProvider>
        </FontsProvider>
      </SafeAreaProviderWrapper>
    </GestureHandlerProvider>
  );
}
