import { KvContextProvider } from '@pkgs/kv/kv-context';
import { KvPlatform } from '@pkgs/kv/kv-platform';
import { useMemo, type ReactNode } from 'react';

export function KvProvider({ children }: { children: ReactNode }): ReactNode {
  const kv = useMemo(() => new KvPlatform(), []);
  return <KvContextProvider value={kv}>{children}</KvContextProvider>;
}
