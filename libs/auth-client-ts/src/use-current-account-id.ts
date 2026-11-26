import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { createSecureStorageItem } from '@pkgs/secure-storage-root-client-ts/solid';
import { isUuid } from '@pkgs/uuid-shared-ts/uuid';
import type { Accessor } from 'solid-js';

/** Local users.id, including anonymous accounts; null until storage hydrates. */
export function useAccountIdRead() {
  const item = createSecureStorageItem(LAST_LOCAL_ACCOUNT_ID_KEY);
  const value = () => {
    const value = item.value();
    return value !== null && isUuid(value) ? value : null;
  };
  return { value, isHydrated: item.isHydrated };
}

export function useCurrentAccountId(): Accessor<string | null> {
  return useAccountIdRead().value;
}
