/** @jsxImportSource solid-js */
/**
 * Cross-cutting platform services: secure storage, logger, config,
 * observability. Clock / ids / HTTP come from `ClientEnvProvider` above.
 *
 * The RN `ConfigService` (`getApiUrl`) collapses into `env.serverUrl`; the
 * pre-sync observability is the env's instance (noop in production until the
 * client-config-driven backend arrives with the `/more/client-config` port).
 */

import { ConfigServiceProvider } from '@libs/auth/public/config-service-context';
import { ClipboardProvider } from '@pkgs/device/solid';
import { OriginAvailabilityProvider } from '@pkgs/http-client/solid';
import { createLogger } from '@pkgs/logger/logger';
import { LoggerProvider } from '@pkgs/logger/solid';
import { ObservabilityProvider } from '@pkgs/observability/client/solid';
import {
  SecureStorageProvider,
  SecureStorageStoreProvider,
} from '@pkgs/secure-storage/solid';
import type { JSX } from 'solid-js';

import { useClientEnv } from '../client-env-context';
import { originAvailabilityFor } from '../origin-availability-for-env';

export function AppInfrastructureProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  const logger = createLogger({ name: 'client', now: env.clock.now });
  return (
    <SecureStorageProvider value={env.secureStorage.storage}>
      <SecureStorageStoreProvider value={env.secureStorage}>
        <LoggerProvider value={logger}>
          <ObservabilityProvider observability={env.observability}>
            <ConfigServiceProvider value={{ getApiUrl: () => env.serverUrl }}>
              <OriginAvailabilityProvider value={originAvailabilityFor(env)}>
                <ClipboardProvider value={env.clipboard}>
                  {props.children}
                </ClipboardProvider>
              </OriginAvailabilityProvider>
            </ConfigServiceProvider>
          </ObservabilityProvider>
        </LoggerProvider>
      </SecureStorageStoreProvider>
    </SecureStorageProvider>
  );
}
