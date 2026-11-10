import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { JSX } from 'solid-js';

/**
 * The User Observatory's denied screen, shared by its routes: a person
 * without the route's permission sees the resolved denial and nothing else.
 */
export function ObservatoryDenial(props: { denial: DenialView }): JSX.Element {
  return (
    <ContentScreen
      screenId="observatory-permission"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>User Observatory</Trans> },
      ]}
    >
      <DenialSurfaceView denial={props.denial} />
    </ContentScreen>
  );
}
