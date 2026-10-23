import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import type { AppPermission } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { JSX } from 'solid-js';

export function SyntheticPopulationDenial(props: {
  permission: AppPermission;
  testId: string;
}): JSX.Element {
  const decision = useDecision(props.permission);
  return (
    <ContentScreen
      screenId="synthetic-population-permission"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Bot Observatory</Trans> },
      ]}
    >
      <DenialSurface decision={decision()} testId={props.testId} />
    </ContentScreen>
  );
}
