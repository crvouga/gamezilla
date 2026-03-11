import { createContext, useContext, type ReactNode } from 'react';
import type {
  Container,
  InjectionToken,
} from './dependency-injection-container';

const ContainerContext = createContext<Container | null>(null);

export interface ContainerProviderProps {
  container: Container;
  children: ReactNode;
}

export function ContainerProvider({
  container,
  children,
}: ContainerProviderProps): ReactNode {
  return (
    <ContainerContext.Provider value={container}>
      {children}
    </ContainerContext.Provider>
  );
}

export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error('useContainer must be used within a ContainerProvider');
  }
  return container;
}

export function useDependency<T>(token: InjectionToken<T>): T {
  const container = useContainer();
  return container.get(token);
}
