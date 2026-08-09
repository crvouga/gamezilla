import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { HttpClient } from './types';

const Ctx = createContext<HttpClient | null>(null);

export type HttpClientProviderProps = {
  readonly children: ReactNode;
  /** Required — construct via createGlobalHttpClient / Io.http at a composition root. */
  readonly client: HttpClient;
};

/**
 * Injects {@link HttpClient} for the React tree.
 * Feature code must call {@link useHttpClient} instead of bare `fetch`.
 */
export function HttpClientProvider({
  children,
  client,
}: HttpClientProviderProps): ReactNode {
  const value = useMemo<HttpClient>(() => client, [client]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHttpClient(): HttpClient {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useHttpClient: HttpClientProvider missing — wrap the tree with HttpClientProvider'
    );
  }
  return v;
}
