import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '@libs/profile-shared-ts/username';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { FormScreen } from '@pkgs/ui-root-client-ts/form-screen';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import {
  type UsernameChange,
  UsernameChangeFeedbackView,
} from './username-change-feedback-view';
import { usernameErrorLabel } from './username-error-label';

export type ProfileHandleScreenViewProps = {
  /** The username draft in the field. */
  readonly value: string;
  /** The alias others see while the saved username is no longer allowed. */
  readonly standInName: string | null;
  /** Why the last save was refused (its server code), or null. */
  readonly saveError: { readonly code: string } | null;
  /** False until the session has a profile to save to. */
  readonly canSave: boolean;
  /** The last username change, while it is shared or after it was refused. */
  readonly usernameChange: UsernameChange | null;
  readonly onValueChange: (value: string) => void;
  /** Saves the draft; rejects when the change is refused. */
  readonly onSave: () => Promise<void>;
  readonly onCancel: () => void;
};

/**
 * As-you-type moderation (the first level of the shared policy): a draft the
 * rules refuse is flagged before saving — saving it is refused all the same,
 * and says so; a saved name the rules no longer allow tells its owner which
 * stand-in name everyone sees instead.
 */
function useUsernameHints(props: ProfileHandleScreenViewProps) {
  const { t } = useLingui();
  const moderation = useModeration();
  const error = createMemo(() =>
    moderation().checkWrite('username', props.value.trim().toLowerCase())
      .allowed
      ? undefined
      : t`That username is not allowed`
  );
  const helperText = createMemo(() => {
    const alias = props.standInName;
    if (alias === null) return undefined;
    return t`Other people see you as ${alias} until you choose a new username`;
  });
  return { error, helperText };
}

/**
 * `/profile/handle`, presentational: the username field with its rules,
 * as-you-type moderation, Save / Cancel and the last change's outcome.
 * `ProfileHandleScreen` wires the draft and the save mutation.
 */
export function ProfileHandleScreenView(
  props: ProfileHandleScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const hints = useUsernameHints(props);
  return (
    <FormScreen
      screenId="profile-handle"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Edit profile</Trans>, href: '/profile/edit' },
        { name: <Trans>Username</Trans> },
      ]}
      cancel={{
        label: <Trans>Cancel</Trans>,
        onClick: () => props.onCancel(),
        dataSet: { testid: Handles.profileUsernameCancel },
      }}
      submit={{
        label: <Trans>Save</Trans>,
        loadingLabel: <Trans>Saving…</Trans>,
        successLabel: <Trans>Saved</Trans>,
        get errorLabel() {
          return usernameErrorLabel(props.saveError);
        },
        operation: () => props.onSave(),
        get disabled() {
          return !props.canSave;
        },
        dataSet: { testid: Handles.profileUsernameSave },
      }}
    >
      <StackVertical gap="lg">
        <TextInput
          label={<Trans>Username</Trans>}
          aria-label={t`Username`}
          value={props.value}
          onChangeText={(value) => props.onValueChange(value)}
          error={hints.error()}
          helperText={hints.helperText()}
          placeholder={t`your_handle`}
          autocapitalize="none"
          autocorrect="off"
          dataSet={{ testid: Handles.profileUsernameInput }}
        />
        <P variant="caption" testId="profile-username-rules">
          <Trans>
            {USERNAME_MIN_LENGTH} to {USERNAME_MAX_LENGTH} letters, numbers or
            _. Saved in lowercase.
          </Trans>
        </P>
        <UsernameChangeFeedbackView change={props.usernameChange} />
      </StackVertical>
    </FormScreen>
  );
}
