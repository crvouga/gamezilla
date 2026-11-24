/** @jsxImportSource @solidjs/web */
/**
 * `LocalIdentityProvider` — establishes the install's device id and current
 * `users.id` (see `identity-boot.ts`), then exposes them reactively from the
 * secure-storage mirror so identity switches re-scope SQLite downstream.
 */

import { setBrowserLocalIdentity } from '@libs/app-env-client-ts/browser-identity';
import { useBugReportAccount } from '@libs/auth-client-ts/bug-report-account';
import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { createSecureStorageItem } from '@pkgs/secure-storage-root-client-ts/solid';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  useContext,
} from 'solid-js';

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
  createEffect(
    () => ({ user: userId(), device: deviceId() }),
    (bound) => {
      setBrowserLocalIdentity(bound.user, bound.device);
    }
  );
  useBugReportAccount();
  return (
    <LocalIdentityContext value={value}>{props.children}</LocalIdentityContext>
  );
}

export function useLocalIdentity(): LocalIdentityValue {
  return useContext(LocalIdentityContext);
}
