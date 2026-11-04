import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { LogInIcon, LogOutIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';

const BUTTON_ICON_SIZE = 16;
const ROW_ICON_SIZE = 20;

/** A guest's way into an account: the account screen's one button. */
export function AccountSignInAction(props: {
  readonly onSignIn: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical self="stretch">
      <Button
        title={t`Sign in`}
        startIcon={<LogInIcon size={BUTTON_ICON_SIZE} />}
        onClick={() => props.onSignIn()}
        dataSet={{ testid: Handles.accountSignIn }}
      />
    </StackVertical>
  );
}

/**
 * Sign out of this device: a calm row in the Security panel, like every
 * other account choice. It only opens the confirmation, which carries the
 * destructive tone.
 */
export function SignOutRow(props: {
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuRow
      title={t`Sign out`}
      caption={t`This device only`}
      leading={<LogOutIcon size={ROW_ICON_SIZE} color="icon" />}
      onClick={() => props.onOpen()}
      dataSet={{ testid: Handles.accountSignOut }}
    />
  );
}
