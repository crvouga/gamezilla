import { ApiFeaturesProvider } from '@libs/auth/client/api-features-context';
import { ComposeProviders } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppConfigService } from './auth/config-service';
import { AppLogger } from './infrastructure/logger';
import { AppObservability } from './infrastructure/observability';
import { AppSecureStorage } from './infrastructure/secure-storage';

/** Io is mounted in `_layout` around `RootErrorBoundary`. */
const infrastructureProviders = [
  AppSecureStorage,
  AppLogger,
  AppConfigService,
  ApiFeaturesProvider,
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
