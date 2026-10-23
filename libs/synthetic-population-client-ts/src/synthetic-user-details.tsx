import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from 'solid-js';
import type { SyntheticUserDetail } from './synthetic-population-api';

export function SyntheticUserDetails(props: {
  user: SyntheticUserDetail;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection title={props.user.username}>
      <MenuRow title={<Trans>User ID</Trans>} value={props.user.id} />
      <MenuRow title={<Trans>Activity</Trans>} value={props.user.activity} />
      <MenuRow
        title={<Trans>Account ID</Trans>}
        value={props.user.account_id ?? t`Not registered`}
      />
      <MenuRow title={<Trans>Region</Trans>} value={props.user.region} />
      <MenuRow
        title={<Trans>Session started</Trans>}
        value={
          props.user.checkpoint === null
            ? t`Not started`
            : new Date(props.user.checkpoint.startedAtMs).toISOString()
        }
      />
      <MenuRow
        title={<Trans>Active space</Trans>}
        value={props.user.checkpoint?.spaceId ?? t`None`}
      />
      <MenuRow
        title={<Trans>Active match</Trans>}
        value={props.user.checkpoint?.matchId ?? t`None`}
      />
      <MenuRow
        title={<Trans>Current route</Trans>}
        value={props.user.checkpoint?.route ?? t`None`}
      />
      <MenuRow
        title={<Trans>Synthetic Population state</Trans>}
        value={props.user.paused ? t`Paused` : t`Available`}
        dataSet={{ testid: 'synthetic-population-availability' }}
      />
      <MenuRow
        title={<Trans>Synthetic Population Worker</Trans>}
        value={props.user.worker_id ?? t`Unassigned`}
      />
      <MenuRow
        title={<Trans>Worker Lease</Trans>}
        value={props.user.lease_until ?? t`Released`}
      />
      <MenuRow
        title={<Trans>Ownership generation</Trans>}
        value={String(props.user.generation)}
      />
      <MenuRow
        title={<Trans>Application version</Trans>}
        value={props.user.application_version ?? t`Not started`}
      />
      <MenuRow
        title={<Trans>Last successful action</Trans>}
        value={props.user.last_action ?? t`None`}
      />
      <MenuRow
        title={<Trans>Recent failure</Trans>}
        value={props.user.last_error ?? t`None`}
      />
    </MenuSection>
  );
}
