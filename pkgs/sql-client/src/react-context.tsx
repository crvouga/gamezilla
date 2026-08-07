import { createContext, type ReactNode, useContext } from 'react';

import type { SqlClient } from './interface';

const Ctx = createContext<SqlClient | null>(null);

export function SqlClientProvider({
  value,
  children,
}: {
  value: SqlClient;
  children: ReactNode;
}): ReactNode {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSqlClient(): SqlClient {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useSqlClient: provider missing — mount inside AppProviders'
    );
  }
  return v;
}
