import { createSecureStorage } from '@gamezilla/secure-storage/create';
import { SecureStorageContextProvider } from '@gamezilla/secure-storage/interface';
import { useMemo, type ReactNode } from 'react';

export function SecureStorageProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const secure = useMemo(() => createSecureStorage(), []);
  return (
    <SecureStorageContextProvider value={secure}>
      {children}
    </SecureStorageContextProvider>
  );
}
