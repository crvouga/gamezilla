import type { Container } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { DependencyInjectionContainer } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { ContainerProvider } from '@gamezilla/lib/dependency-injection/react';
import { createLogger } from '@gamezilla/lib/logger/logger';
import { LoggerToken } from '@gamezilla/lib/logger/token';
import { createConfigService, ConfigServiceToken } from './config-service';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

export function createConfigContainer(): Container {
  const container = new DependencyInjectionContainer();
  container.register(ConfigServiceToken, createConfigService);
  container.registerValue(LoggerToken, createLogger({ name: 'client' }));
  return container;
}

export interface ConfigContainerProviderProps {
  children: ReactNode;
}

export function ConfigContainerProvider({
  children,
}: ConfigContainerProviderProps): ReactNode {
  const container = useMemo(() => createConfigContainer(), []);
  return (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
}
