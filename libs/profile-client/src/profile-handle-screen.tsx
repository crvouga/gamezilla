import { useModeration } from '@libs/moderation-client/moderation-context';
import { claimUsernameMutation } from '@libs/profile-shared/claim-username-mutation';
import type { ProfileRow } from '@libs/profile-shared/profile-row-sql';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n-shared/localized-string';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { FormActionsFooter } from '@pkgs/ui-root-client/form-actions-footer';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import type { Accessor, JSX } from 'solid-js';
import { createEffect, createMemo, createSignal } from 'solid-js';
import { useMyProfileId } from './claim-username-use-my-profile-id';
import { useProfileRow } from './claim-username-use-profile-row';
import { useStandInName } from './use-stand-in-name';

function useSyncedUsername(row: Accessor<ProfileRow | null>) {
  const [value, setValue] = createSignal('');
  const lastPersistedRef = { current: null as string | null };

  createEffect(() => {
    const current = row();
    if (current === null) return;
    const persisted =
      typeof current.username === 'string' ? current.username : '';
    const prev = lastPersistedRef.current;
    if (prev === null) {
      setValue((draft) => (draft === '' ? persisted : draft));
      lastPersistedRef.current = persisted;
      return;
    }
    if (persisted !== prev) {
      setValue((draft) => (draft === prev ? persisted : draft));
      lastPersistedRef.current = persisted;
    }
  });

  return [value, setValue] as const;
}

/**
 * As-you-type moderation (the first level of the shared policy): a draft the
 * rules refuse is flagged before saving — saving it is refused all the same,
 * and says so; a saved name the rules no longer allow tells its owner which
 * stand-in name everyone sees instead. The saved name is kept.
 */
function useUsernameModeration(
  value: Accessor<string>,
  row: Accessor<ProfileRow | null>
) {
  const { t } = useLingui();
  const moderation = useModeration();
  const standIn = useStandInName(row);
  const error = createMemo(() =>
    moderation().checkWrite('username', value().trim().toLowerCase()).allowed
      ? undefined
      : t`That username is not allowed`
  );
  const helperText = createMemo(() => {
    const alias = standIn();
    if (alias === null) return undefined;
    return t`Other people see you as ${alias} until you choose a new username`;
  });
  return { error, helperText };
}

function ProfileHandleScreenBody(props: {
  class?: string | undefined;
  value: Accessor<string>;
  setValue: (v: string) => void;
  error: Accessor<LocalizedString | undefined>;
  helperText: Accessor<LocalizedString | undefined>;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <div class={`box ${props.class ?? ''}`.trim()}>
      <TextInput
        label={<Trans>Username</Trans>}
        aria-label={t`Username`}
        value={props.value()}
        onChangeText={props.setValue}
        error={props.error()}
        helperText={props.helperText()}
        placeholder={t`your_handle`}
        autocapitalize="none"
        autocorrect="off"
        dataSet={{ testid: Handles.profileUsernameInput }}
      />
    </div>
  );
}

function usernameErrorLabel(
  error: { readonly code: string } | null
): JSX.Element {
  if (error === null) {
    return <Trans>Couldn't save</Trans>;
  }
  switch (error.code) {
    case 'USERNAME_TAKEN':
      return <Trans>Username is taken</Trans>;
    case 'USERNAME_COOLDOWN':
      return <Trans>Username was changed recently</Trans>;
    case 'USERNAME_TOO_SHORT':
      return <Trans>Username is too short</Trans>;
    case 'USERNAME_TOO_LONG':
      return <Trans>Username is too long</Trans>;
    case 'USERNAME_INVALID_FORMAT':
      return <Trans>Username can only use letters, numbers, and _</Trans>;
    case 'USERNAME_EMPTY':
      return <Trans>Username is required</Trans>;
    case 'USERNAME_BLOCKED':
      return <Trans>That username is not allowed</Trans>;
    case 'OFFLINE':
      return <Trans>You're offline</Trans>;
    default:
      return <Trans>Couldn't save</Trans>;
  }
}

export function ProfileHandleScreen(): JSX.Element {
  const router = useRouter();
  const profileId = useMyProfileId();
  const { row } = useProfileRow(profileId);
  const [value, setValue] = useSyncedUsername(row);
  const usernameModeration = useUsernameModeration(value, row);
  const nav = useBreadcrumbNav();
  const mutationClient = useMutationClient();
  const [lastError, setLastError] = createSignal<{
    readonly code: string;
  } | null>(null);

  const save = async () => {
    const id = profileId();
    if (id === null) return;
    setLastError(null);
    const result = await mutationClient.mutate(claimUsernameMutation, {
      username: value(),
    });
    if (!result.ok) {
      const failure = result.failures[0];
      if (failure !== undefined) {
        setLastError(failure);
        throw new Error(failure.message);
      }
      throw new Error("Couldn't save");
    }
  };

  return (
    <ScreenBase
      screenId="profile-handle"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
        { name: <Trans>Edit profile</Trans>, onClick: nav('/profile/edit') },
        { name: <Trans>Username</Trans> },
      ]}
      footer={
        <FormActionsFooter
          cancel={{
            label: <Trans>Cancel</Trans>,
            onClick: () => router.back(),
            dataSet: { testid: Handles.profileUsernameCancel },
          }}
          submit={{
            label: <Trans>Save</Trans>,
            loadingLabel: <Trans>Saving…</Trans>,
            successLabel: <Trans>Saved</Trans>,
            get errorLabel() {
              return usernameErrorLabel(lastError());
            },
            operation: save,
            get disabled() {
              return profileId() === null;
            },
            dataSet: { testid: Handles.profileUsernameSave },
          }}
        />
      }
      content={({ bodyClass }) => (
        <ProfileHandleScreenBody
          class={bodyClass}
          value={value}
          setValue={setValue}
          error={usernameModeration.error}
          helperText={usernameModeration.helperText}
        />
      )}
    />
  );
}
