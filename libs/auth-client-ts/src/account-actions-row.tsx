import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { LogInIcon, LogOutIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

const BUTTON_ICON_SIZE = 16;

/** Sign in / sign out actions for the account screen. */
export function AccountActionsRow(props: {
  readonly signedIn: boolean;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical self="stretch">
      <Show
        when={props.signedIn}
        fallback={
          <Button
            title={t`Sign in`}
            startIcon={<LogInIcon size={BUTTON_ICON_SIZE} />}
            onClick={() => props.onSignIn()}
            dataSet={{ testid: Handles.accountSignIn }}
          />
        }
      >
        <Button
          title={t`Sign out`}
          intent="danger"
          variant="outline"
          startIcon={<LogOutIcon size={BUTTON_ICON_SIZE} />}
          onClick={() => props.onSignOut()}
          dataSet={{ testid: Handles.accountSignOut }}
        />
      </Show>
    </StackVertical>
  );
}
