import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from 'solid-js';
import type { SyntheticUserDetail } from './synthetic-population-api';
import { useActivityLabel, useMomentLabel } from './synthetic-user-labels';

/**
 * What a Synthetic User is doing now: whether it is paused, its activity,
 * where and since when, and how its last action went.
 */
export function SyntheticUserStatus(props: {
  user: SyntheticUserDetail;
}): JSX.Element {
  const { t } = useLingui();
  const activity = useActivityLabel();
  const moment = useMomentLabel();
  return (
    <MenuSection title={<Trans>Status</Trans>}>
      <MenuRow
        title={<Trans>Synthetic Population state</Trans>}
        value={props.user.paused ? t`Paused` : t`Available`}
        dataSet={{ testid: 'synthetic-population-availability' }}
      />
      <MenuRow
        title={<Trans>Activity</Trans>}
        value={activity(props.user.activity)}
        valueLines={2}
      />
      <MenuRow title={<Trans>Region</Trans>} value={props.user.region} />
      <MenuRow
        title={<Trans>Session started</Trans>}
        value={
          props.user.checkpoint === null
            ? t`Not started`
            : moment(props.user.checkpoint.startedAtMs)
        }
        valueLines={2}
      />
      <MenuRow
        title={<Trans>Current route</Trans>}
        caption={props.user.checkpoint?.route ?? t`None`}
      />
      <MenuRow
        title={<Trans>Last successful action</Trans>}
        caption={props.user.last_action ?? t`None`}
      />
      <MenuRow
        title={<Trans>Recent failure</Trans>}
        caption={props.user.last_error ?? t`None`}
      />
    </MenuSection>
  );
}

/**
 * The records behind a Synthetic User, for diagnosing it: its ids, the
 * worker that runs it and the lease it holds. Each id reads in full under
 * its name.
 */
export function SyntheticUserDiagnostics(props: {
  user: SyntheticUserDetail;
}): JSX.Element {
  const { t } = useLingui();
  const moment = useMomentLabel();
  const leaseLabel = () => {
    if (props.user.lease_until === null) return t`Released`;
    const until = moment(props.user.lease_until);
    return t`Until ${until}`;
  };
  return (
    <MenuSection title={<Trans>Diagnostics</Trans>}>
      <MenuRow title={<Trans>User ID</Trans>} caption={props.user.id} />
      <MenuRow
        title={<Trans>Account ID</Trans>}
        caption={props.user.account_id ?? t`Not registered`}
      />
      <MenuRow
        title={<Trans>Active space</Trans>}
        caption={props.user.checkpoint?.spaceId ?? t`None`}
      />
      <MenuRow
        title={<Trans>Active match</Trans>}
        caption={props.user.checkpoint?.matchId ?? t`None`}
      />
      <MenuRow
        title={<Trans>Synthetic Population Worker</Trans>}
        caption={props.user.worker_id ?? t`Unassigned`}
      />
      <MenuRow
        title={<Trans>Worker Lease</Trans>}
        value={leaseLabel()}
        valueLines={2}
      />
      <MenuRow
        title={<Trans>Ownership generation</Trans>}
        value={String(props.user.generation)}
      />
      <MenuRow
        title={<Trans>Application version</Trans>}
        value={props.user.application_version ?? t`Not started`}
        valueLines={2}
      />
    </MenuSection>
  );
}
