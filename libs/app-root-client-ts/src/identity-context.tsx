/** @jsxImportSource solid-js */
/**
 * `LocalIdentityProvider` — establishes the install's device id and current
 * `users.id` (see `identity-boot.ts`), then exposes them reactively from the
 * secure-storage mirror so identity switches re-scope SQLite downstream.
 */

import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { createSecureStorageItem } from '@pkgs/secure-storage-root-client-ts/solid';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type JSX,
  useContext,
} from 'solid-js';
import { setBrowserLocalIdentity } from './browser-identity';

export type LocalIdentityValue = {
  /** Current local `users.id`; `null` until the local boot lands. */
  readonly userId: Accessor<string | null>;
  readonly deviceId: Accessor<string | null>;
  readonly sessionToken: Accessor<string | null>;
};

const LocalIdentityContext = createContext<LocalIdentityValue>();

function nonEmpty(value: string | null): string | null {
  return value !== null && value.length > 0 ? value : null;
}

export function LocalIdentityProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const userItem = createSecureStorageItem(LAST_LOCAL_ACCOUNT_ID_KEY);
  const deviceItem = createSecureStorageItem(DEVICE_ID_KEY);
  const tokenItem = createSecureStorageItem(SESSION_TOKEN_KEY);

  const userId = createMemo(() => nonEmpty(userItem.value()));
  const deviceId = createMemo(() => nonEmpty(deviceItem.value()));
  const sessionToken = createMemo(() => nonEmpty(tokenItem.value()));
  const value: LocalIdentityValue = {
    userId,
    deviceId,
    sessionToken,
  };
  createEffect(() => {
    setBrowserLocalIdentity(userId(), deviceId());
  });
  return (
    <LocalIdentityContext.Provider value={value}>
      {props.children}
    </LocalIdentityContext.Provider>
  );
}

export function useLocalIdentity(): LocalIdentityValue {
  const value = useContext(LocalIdentityContext);
  if (value === undefined) {
    throw new Error(
      'useLocalIdentity: missing LocalIdentityProvider — wrap with AppProviders'
    );
  }
  return value;
}
