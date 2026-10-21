import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
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
        <ContentScreen
          screenId="friends-permission-gate"
          breadcrumbs={[
            { name: <Trans>Profile</Trans>, href: '/profile' },
            { name: <Trans>Friends</Trans> },
          ]}
        >
          <DenialSurface decision={decision()} icon={UsersIcon} />
        </ContentScreen>
      }
    >
      {props.children}
    </Show>
  );
}
