import { Trans, useLingui } from '@lingui/solid/macro';
import { SlidersHorizontalIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX, Show } from 'solid-js';
import type { SyntheticPopulationOverview } from './synthetic-population-api';
import { useActivityLabel } from './synthetic-user-labels';

/**
 * How many Synthetic Users there should be and how many are online,
 * playing, matchmaking and recovering, then how many do what where. Given
 * `onConfigure`, the first row opens the desired synthetic population form.
 */
export function SyntheticPopulationSummary(props: {
  overview: SyntheticPopulationOverview;
  onConfigure?: (() => void) | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const activity = useActivityLabel();
  return (
    <>
      <MenuSection title={<Trans>Synthetic Population</Trans>}>
        <MenuRow
          leading={
            props.onConfigure === undefined ? undefined : (
              <SlidersHorizontalIcon size={20} color="icon" />
            )
          }
          title={<Trans>Desired synthetic population</Trans>}
          caption={
            props.onConfigure === undefined
              ? undefined
              : t`Change how many there are and how they run`
          }
          value={String(props.overview.config.desired)}
          onClick={props.onConfigure}
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
      </MenuSection>
      <Show when={props.overview.groups.length > 0}>
        <MenuSection title={<Trans>By activity and region</Trans>}>
          <For each={props.overview.groups}>
            {(group) => (
              <MenuRow
                title={activity(group.activity)}
                caption={group.region}
                value={String(group.count)}
              />
            )}
          </For>
        </MenuSection>
      </Show>
    </>
  );
}
