import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { UsersIcon } from '@pkgs/ui-root-client/icons';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
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
