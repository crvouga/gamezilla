import { ComposeProviders } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { AppConfigService } from './auth/config-service';
import { AppLogger } from './infrastructure/logger';
import { AppObservability } from './infrastructure/observability';
import { AppSecureStorage } from './infrastructure/secure-storage';

/** Clock / ids / HTTP come from {@link ClientEnvProvider} above this stack. */
const infrastructureProviders = [
  AppSecureStorage,
  AppLogger,
  AppConfigService,
  AppObservability,
];

/** Cross-cutting platform services: secure storage, logger, config, observability. */
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
