import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useDecision } from '@libs/permissions-client/use-can';
import type { AppPermission } from '@libs/permissions-shared/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import type { JSX } from 'solid-js';

export function PopulationDenial(props: {
  permission: AppPermission;
  testId: string;
}): JSX.Element {
  const decision = useDecision(props.permission);
  return (
    <ScreenBase
      screenId="population-permission"
      breadcrumbs={[{ name: <Trans>Bot Observatory</Trans> }]}
      content={() => (
        <DenialSurface decision={decision()} testId={props.testId} />
      )}
    />
  );
}
