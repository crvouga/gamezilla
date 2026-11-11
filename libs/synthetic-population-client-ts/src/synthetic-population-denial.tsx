import { OBSERVATORY_PATH } from '@libs/observatory-shared-ts/observatory-routes';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { JSX } from 'solid-js';

/**
 * The Synthetic Population panel's denied screen, shared by its routes: a person
 * without the route's permission sees the resolved denial and nothing else.
 */
export function SyntheticPopulationDenial(props: {
  denial: DenialView;
}): JSX.Element {
  return (
    <ContentScreen
      screenId="synthetic-population-permission"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>User Observatory</Trans>, href: OBSERVATORY_PATH },
        { name: <Trans>Synthetic Population</Trans> },
      ]}
    >
      <DenialSurfaceView denial={props.denial} />
    </ContentScreen>
  );
}
