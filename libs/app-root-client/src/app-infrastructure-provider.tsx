/** @jsxImportSource solid-js */
/**
 * Cross-cutting platform services: secure storage, logger, and config.
 * Clock / ids / HTTP come from `ClientEnvProvider` above.
 *
 * The RN `ConfigService` (`getApiUrl`) collapses into `env.serverUrl`; the
 * Observability is registered once at the browser composition root and emits
 * through the global OpenTelemetry API; it is deliberately not a Solid port.
 */

import { ConfigServiceProvider } from '@libs/auth-client/config-service-context';
import { ClipboardProvider, HapticsProvider } from '@pkgs/device-client/solid';
import { OriginAvailabilityProvider } from '@pkgs/http-client-client/solid';
import { LoggerProvider } from '@pkgs/logger-client/solid';
import { createLogger } from '@pkgs/logger-shared/logger';
import {
  SecureStorageProvider,
  SecureStorageStoreProvider,
} from '@pkgs/secure-storage-root-client/solid';
import type { JSX } from 'solid-js';

import { useClientEnv } from './client-env-context';
import { originAvailabilityFor } from './origin-availability-for-env';

export function AppInfrastructureProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  const logger = createLogger({ name: 'client', now: env.clock.now });
  return (
    <SecureStorageProvider value={env.secureStorage.storage}>
      <SecureStorageStoreProvider value={env.secureStorage}>
        <LoggerProvider value={logger}>
          <ConfigServiceProvider value={{ getApiUrl: () => env.serverUrl }}>
            <OriginAvailabilityProvider value={originAvailabilityFor(env)}>
              <ClipboardProvider value={env.clipboard}>
                <HapticsProvider value={env.haptics}>
                  {props.children}
                </HapticsProvider>
              </ClipboardProvider>
            </OriginAvailabilityProvider>
          </ConfigServiceProvider>
        </LoggerProvider>
      </SecureStorageStoreProvider>
    </SecureStorageProvider>
  );
}
