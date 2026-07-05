import { KvProvider } from '@pkgs/kv/kv-provider';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppConfigService } from './auth/config-service';
import { AppLogger } from './infrastructure/logger';
import { AppObservability } from './infrastructure/observability';
import { AppSecureStorage } from './infrastructure/secure-storage';

const infrastructureProviders = [
  KvProvider,
  AppSecureStorage,
  AppLogger,
  AppConfigService,
  AppObservability,
];

/** Cross-cutting platform services: kv, secure storage, logger, config, observability. */
export function AppInfrastructureProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={infrastructureProviders}>
      {children}
    </ComposeProviders>
  );
}
