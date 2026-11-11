import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  BotIcon,
  HistoryIcon,
  ServerIcon,
  SlidersHorizontalIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { panelCrumbs } from './synthetic-population-frame';

/** Where the hub leads. */
export type SyntheticPopulationDestination =
  | 'directory'
  | 'workers'
  | 'events'
  | 'settings';

export type SyntheticPopulationScreenViewProps = {
  /** Set when the person may not open the panel; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Offers the population settings form. */
  readonly canConfigure: boolean;
  readonly onOpen: (destination: SyntheticPopulationDestination) => void;
};

function SyntheticPopulationHub(
  props: SyntheticPopulationScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuScreen screenId="synthetic-population" breadcrumbs={panelCrumbs([])}>
      <MenuSection title={<Trans>Synthetic Population</Trans>}>
        <MenuRow
          leading={<BotIcon size={20} color="icon" />}
          title={t`Synthetic Users`}
          caption={t`Every Synthetic User, what each is doing and its control panel`}
          onClick={() => props.onOpen('directory')}
          dataSet={{ testid: 'synthetic-population-open-directory' }}
        />
        <MenuRow
          leading={<ServerIcon size={20} color="icon" />}
          title={t`Workers`}
          caption={t`The Synthetic Population Workers that run them, and their health`}
          onClick={() => props.onOpen('workers')}
          dataSet={{ testid: 'synthetic-population-open-workers' }}
        />
        <MenuRow
          leading={<HistoryIcon size={20} color="icon" />}
          title={t`Events`}
          caption={t`What the Synthetic Population recorded, newest first`}
          onClick={() => props.onOpen('events')}
          dataSet={{ testid: 'synthetic-population-open-events' }}
        />
      </MenuSection>
      <Show when={props.canConfigure}>
        <MenuSection title={<Trans>Settings</Trans>}>
          <MenuRow
            leading={<SlidersHorizontalIcon size={20} color="icon" />}
            title={t`Population settings`}
            caption={t`How many Synthetic Users there are and how they run`}
            onClick={() => props.onOpen('settings')}
            dataSet={{ testid: 'synthetic-population-open-settings' }}
          />
        </MenuSection>
      </Show>
    </MenuScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users`, presentational: the Synthetic
 * Population panel's hub. It only links onward: to the Synthetic Users, the
 * workers and the recorded events (each a table of its own) and, for those
 * who may configure it, the population settings form. It reads nothing, so
 * it has no loading or failed state; its denied state replaces it.
 * `SyntheticPopulationScreen` wires it.
 */
export function SyntheticPopulationScreenView(
  props: SyntheticPopulationScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<SyntheticPopulationHub {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
