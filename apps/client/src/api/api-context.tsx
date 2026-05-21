import type { ApiClient } from './hc';
import { createContext, useContext, type ReactNode } from 'react';

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({
  value,
  children,
}: {
  value: ApiClient;
  children: ReactNode;
}): ReactNode {
  return (
    <ApiClientContext.Provider value={value}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const v = useContext(ApiClientContext);
  if (v === null) {
    throw new Error(
      'useApiClient: ApiClientProvider missing — wrap with AppProviders'
    );
  }
  return v;
}
