import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { Button, LogInIcon, LogOutIcon } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { useHasAuthSession } from '../../public/access-facts';
import {
  useSignInModal,
  useSignOutModal,
} from '../../public/auth-modals-provider';

const BUTTON_ICON_SIZE = 16;

/** Sign in / sign out actions for the account screen. */
export function AccountActionsRow(): JSX.Element {
  const { t } = useLingui();
  const isSignedIn = useHasAuthSession();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();

  return (
    <div class="box self-stretch">
      <Show
        when={isSignedIn()}
        fallback={
          <Button
            title={t`Sign in`}
            startIcon={<LogInIcon size={BUTTON_ICON_SIZE} />}
            onClick={() => {
              openSignInModal();
            }}
            dataSet={{ testid: Handles.accountSignIn }}
          />
        }
      >
        <Button
          title={t`Sign out`}
          intent="danger"
          variant="outline"
          startIcon={<LogOutIcon size={BUTTON_ICON_SIZE} />}
          onClick={() => {
            openSignOutConfirm();
          }}
          dataSet={{ testid: Handles.accountSignOut }}
        />
      </Show>
    </div>
  );
}
