import type { Container } from '@/@shared/dependency-injection/dependency-injection-container';
import { DependencyInjectionContainer } from '@/@shared/dependency-injection/dependency-injection-container';
import { ContainerProvider } from '@/@shared/dependency-injection/react';
import { createConfigService, ConfigServiceToken } from './config-service';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

export function createConfigContainer(): Container {
  const container = new DependencyInjectionContainer();
  container.register(ConfigServiceToken, createConfigService);
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
