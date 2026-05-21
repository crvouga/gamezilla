import { KvContextProvider } from '@gamezilla/kv/kv-context';
import { KvPlatform } from '@gamezilla/kv/kv-platform';
import { useMemo, type ReactNode } from 'react';

export function KvProvider({ children }: { children: ReactNode }): ReactNode {
  const kv = useMemo(() => new KvPlatform(), []);
  return <KvContextProvider value={kv}>{children}</KvContextProvider>;
}
