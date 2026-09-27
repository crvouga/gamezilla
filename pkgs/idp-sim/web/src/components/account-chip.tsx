/** Who is signing in: the account's initials beside its address. */

import { Avatar } from '@pkgs/ui/components/avatar';

import type { IdpAccount } from '../../../src/shared/types';
import { initials } from './initials';

const CHIP_AVATAR_SIZE = 32;

export function AccountAvatar(props: { readonly account: IdpAccount }) {
  return (
    <Avatar
      initials={initials(props.account.name)}
      size={CHIP_AVATAR_SIZE}
      background="tintSubtle"
      foreground="tint"
    />
  );
}

export function AccountChip(props: { readonly account: IdpAccount }) {
  return (
    <div class="box flex-row items-center gap-3">
      <AccountAvatar account={props.account} />
      <span class="text textLabel truncate">{props.account.email}</span>
    </div>
  );
}
