import { createSecureStorageItem } from '@pkgs/secure-storage-client/solid';
import type { Accessor } from 'solid-js';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { isUuid } from '@pkgs/uuid-shared/uuid';

/** Local users.id, including anonymous accounts; null until storage hydrates. */
export function useCurrentAccountId(): Accessor<string | null> {
  const item = createSecureStorageItem(LAST_LOCAL_ACCOUNT_ID_KEY);
  return () => {
    const value = item.value();
    return value !== null && isUuid(value) ? value : null;
  };
}
