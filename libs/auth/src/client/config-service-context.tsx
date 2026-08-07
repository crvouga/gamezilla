import { createContext, type ReactNode, useContext } from 'react';

import type { ConfigService } from './config-service-types';

const Ctx = createContext<ConfigService | null>(null);

export function ConfigServiceProvider({
  value,
  children,
}: {
  value: ConfigService;
  children: ReactNode;
}): ReactNode {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConfigService(): ConfigService {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useConfigService: ConfigServiceProvider missing — wrap with AppProviders'
    );
  }
  return v;
}
