import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';

export function SyntheticPopulationSettings(): JSX.Element {
  const allowed = useCan(PERMISSION.syntheticPopulationView);
  const router = useRouter();
  return (
    <Show when={allowed()}>
      <MenuSection title={<Trans>Administration</Trans>}>
        <MenuRow
          title={<Trans>Bot Observatory</Trans>}
          caption={<Trans>Observe and control the Synthetic Population</Trans>}
          onClick={() => router.push('/admin/synthetic-population')}
          dataSet={{ testid: 'synthetic-population-open' }}
        />
      </MenuSection>
    </Show>
  );
}
