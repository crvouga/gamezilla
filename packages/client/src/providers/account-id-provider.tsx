import {
  AccountIdProvider,
  useAccountIdModel,
} from '@gamezilla/auth/client/account-id-context';
import { readLastLocalAccountId } from '@gamezilla/auth/client/account-local-state';
import {
  type SecureStorage,
  useSecureStorage,
} from '@gamezilla/lib/secure-storage/interface';
import { useEffect, type ReactNode } from 'react';

function AccountIdHydrateFromStorage({
  secure,
}: {
  secure: SecureStorage;
}): null {
  const accountId = useAccountIdModel();

  useEffect(() => {
    let cancelled = false;
    void readLastLocalAccountId(secure).then((id) => {
      if (!cancelled && id !== null) {
        accountId.setAccountId(id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [secure, accountId]);

  return null;
}

export function AccountIdProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const secure = useSecureStorage();

  return (
    <AccountIdProvider>
      <AccountIdHydrateFromStorage secure={secure} />
      {children}
    </AccountIdProvider>
  );
}
