import { createKeyValueStorage } from '@gamezilla/lib/key-value-storage/create';
import { KeyValueStorageContextProvider } from '@gamezilla/lib/key-value-storage/interface';
import { useMemo, type ReactNode } from 'react';

export function KeyValueStorageProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const kv = useMemo(() => createKeyValueStorage(), []);
  return (
    <KeyValueStorageContextProvider value={kv}>
      {children}
    </KeyValueStorageContextProvider>
  );
}
