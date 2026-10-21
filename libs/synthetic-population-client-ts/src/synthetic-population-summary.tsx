import { Trans } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX } from 'solid-js';
import type { SyntheticPopulationOverview } from './synthetic-population-api';

export function SyntheticPopulationSummary(props: {
  overview: SyntheticPopulationOverview;
}): JSX.Element {
  return (
    <MenuSection title={<Trans>Synthetic Population</Trans>}>
      <MenuRow
        title={<Trans>Desired synthetic population</Trans>}
        value={String(props.overview.config.desired)}
        dataSet={{ testid: 'synthetic-population-desired-value' }}
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
      <For each={props.overview.groups}>
        {(group) => (
          <MenuRow
            title={group.activity}
            caption={group.region}
            value={String(group.count)}
          />
        )}
      </For>
    </MenuSection>
  );
}
