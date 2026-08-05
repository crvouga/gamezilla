/**
 * Avatar for a {@link LocalAccount} row. Live SQLite only when the row is the
 * active session *and* bound to `lastLocalAccountId` — mid-switch the provider
 * can flip `isActive` before the pointer catches up.
 */

import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import type { LocalAccount } from '@libs/auth/client/use-local-accounts';
import { DeviceAvatar } from '@libs/profile/client/device-avatar';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import {
  createDefaultAvatarConfig,
  parseAvatarConfig,
} from '@libs/profile/shared/avatar-config';
import type { ReactNode } from 'react';

function accountAvatarSeed(account: LocalAccount): string {
  return account.accountId ?? account.externalUserId ?? account.sessionId;
}

export function LocalAccountAvatar({
  account,
  size,
}: {
  account: LocalAccount;
  size: number;
}): ReactNode {
  const activeAccountId = useCurrentAccountId();
  const useLiveProfile =
    account.isActive &&
    account.accountId !== null &&
    account.accountId === activeAccountId;
  if (useLiveProfile) {
    return <MyProfileAvatar size={size} />;
  }
  const seed = accountAvatarSeed(account);
  const parsed = parseAvatarConfig(account.avatarConfigJson);
  return (
    <DeviceAvatar
      avatarConfig={parsed ?? createDefaultAvatarConfig(seed)}
      seedFallback={seed}
      size={size}
    />
  );
}
