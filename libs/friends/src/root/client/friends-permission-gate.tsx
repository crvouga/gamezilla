import { DenialSurface } from '@libs/permissions/public/denial-surface';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useDecision } from '@libs/permissions/public/use-can';
import { Trans } from '@lingui/solid/macro';
import { ScreenBase, UsersIcon } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export function FriendsPermissionGate(props: {
  children: JSX.Element;
}): JSX.Element {
  const decision = useDecision(PERMISSION.friendsUse);

  return (
    <Show
      when={decision().allowed}
      fallback={
        <ScreenBase
          screenId="friends-permission-gate"
          breadcrumbs={[
            { name: <Trans>Profile</Trans>, href: '/profile' },
            { name: <Trans>Friends</Trans> },
          ]}
          content={({ bodyClass }) => (
            <div class={`box ${bodyClass}`}>
              <DenialSurface decision={decision()} icon={UsersIcon} />
            </div>
          )}
        />
      }
    >
      {props.children}
    </Show>
  );
}
