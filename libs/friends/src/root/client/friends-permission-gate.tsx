import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useCan } from '@libs/permissions/public/use-can';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState, ScreenBase, UsersIcon } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export function FriendsPermissionGate(props: {
  children: JSX.Element;
}): JSX.Element {
  const canUseFriends = useCan(PERMISSION.friendsUse);
  const { open: openSignInModal } = useSignInModal();
  const { t } = useLingui();

  return (
    <Show
      when={canUseFriends()}
      fallback={
        <ScreenBase
          screenId="friends-signed-in-gate"
          breadcrumbs={[
            { name: <Trans>Profile</Trans>, href: '/profile' },
            { name: <Trans>Friends</Trans> },
          ]}
          content={({ bodyClass }) => (
            <div class={`box ${bodyClass}`}>
              <EmptyState
                icon={UsersIcon}
                title={<Trans>Sign in to add friends</Trans>}
                body={
                  <Trans>
                    Friends let you find each other and jump into shared spaces.
                  </Trans>
                }
                action={{ label: t`Sign in`, onClick: openSignInModal }}
              />
            </div>
          )}
        />
      }
    >
      {props.children}
    </Show>
  );
}
