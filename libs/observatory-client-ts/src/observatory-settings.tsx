import { OBSERVATORY_PATH } from '@libs/observatory-shared-ts/observatory-routes';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';

/** Settings' way into the User Observatory, for those who may view it. */
export function ObservatorySettings(): JSX.Element {
  const allowed = useCan(PERMISSION.observatoryView);
  const router = useRouter();
  return (
    <Show when={allowed()}>
      <MenuSection title={<Trans>Administration</Trans>}>
        <MenuRow
          title={<Trans>User Observatory</Trans>}
          caption={
            <Trans>
              See who is online now, watch them live and control the Synthetic
              Population
            </Trans>
          }
          onClick={() => router.push(OBSERVATORY_PATH)}
          dataSet={{ testid: 'observatory-open' }}
        />
      </MenuSection>
    </Show>
  );
}
