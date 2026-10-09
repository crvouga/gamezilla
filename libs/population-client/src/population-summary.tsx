import { Trans } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import type { JSX } from 'solid-js';
import type { PopulationOverview } from './population-api';

export function PopulationSummary(props: {
  overview: PopulationOverview;
}): JSX.Element {
  return (
    <MenuSection title={<Trans>Synthetic Population</Trans>}>
      <MenuRow
        title={<Trans>Desired population</Trans>}
        value={String(props.overview.config.desired)}
        dataSet={{ testid: 'population-desired-value' }}
      />
      <MenuRow
        title={<Trans>Online Synthetic Users</Trans>}
        value={String(props.overview.online)}
      />
      <MenuRow
        title={<Trans>Playing</Trans>}
        value={String(props.overview.playing)}
      />
      <MenuRow
        title={<Trans>Matchmaking</Trans>}
        value={String(props.overview.matchmaking)}
      />
      <MenuRow
        title={<Trans>Recovering</Trans>}
        value={String(props.overview.recovering)}
      />
    </MenuSection>
  );
}
