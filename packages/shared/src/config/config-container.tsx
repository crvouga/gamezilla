import type { Container } from '../dependency-injection/dependency-injection-container';
import { DependencyInjectionContainer } from '../dependency-injection/dependency-injection-container';
import { ContainerProvider } from '../dependency-injection/react';
import { createLogger } from '../logger/logger';
import { LoggerToken } from '../logger/token';
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
