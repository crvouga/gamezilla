import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { JSX } from 'solid-js';

/**
 * The Bot Observatory's denied screen, shared by every admin route: a person
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
        { name: <Trans>Bot Observatory</Trans> },
      ]}
    >
      <DenialSurfaceView denial={props.denial} />
    </ContentScreen>
  );
}
