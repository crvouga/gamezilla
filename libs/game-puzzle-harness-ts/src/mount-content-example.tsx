import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client-ts/solid';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-root-shared-ts/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import type { MutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import { MutationClientContext } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';
import { contentClient } from './content-actions';
import { ContentExampleClient } from './content-example-client';
import { ContentExampleHost } from './content-example-host';
import type { ContentHarness } from './content-system';

/** Mount the counting reference app over its real SQLite, mutation queue and sync engine. */
export async function mountContentExample(s: ContentHarness, clientId: string) {
  const client = contentClient(s, clientId);
  const store = createSecureStorageStore(createInMemorySecureStorage());
  await store.write(LAST_LOCAL_ACCOUNT_ID_KEY, client.actorId);
  await store.hydrate(LAST_LOCAL_ACCOUNT_ID_KEY);
  await store.hydrate(SESSION_TOKEN_KEY);
  const ports = s.session.ports;
  const mutations: MutationClient = {
    ...client.mutationClient,
    async mutate(mutation, args) {
      const result = await client.mutationClient.mutate(mutation, args);
      s.lastResult.set(clientId, result);
      return result;
    },
  };
  return renderWithI18n(() => (
    <SecureStorageStoreProvider value={store}>
      <ClockProvider clock={ports.clock} timers={ports.timers}>
        <IdProvider createId={ports.createId} random={ports.random}>
          <SyncEngineProvider value={client.engine}>
            <MutationClientContext.Provider value={mutations}>
              <ThemeProvider
                colorScheme="light"
                fixedLayout={{ width: 390, height: 844 }}
              >
                <SurfaceStackProvider>
                  <ContentExampleHost>
                    <ContentExampleClient />
                  </ContentExampleHost>
                </SurfaceStackProvider>
              </ThemeProvider>
            </MutationClientContext.Provider>
          </SyncEngineProvider>
        </IdProvider>
      </ClockProvider>
    </SecureStorageStoreProvider>
  ));
}
