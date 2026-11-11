import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { type JSX, Show } from 'solid-js';
import type { SyntheticPopulationEventView } from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { SyntheticPopulationEventsTable } from './synthetic-population-events-table';
import {
  syntheticUserCrumbs,
  useRefreshAction,
} from './synthetic-population-frame';

/** Who a screen under a control panel is about: its id and name. */
export type SyntheticUserName = {
  readonly id: string;
  readonly username: string;
};

export type SyntheticUserEventsScreenViewProps = {
  /** Set when the person may not inspect Synthetic Users; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Whose events, once read; names the way back to its control panel. */
  readonly user: SyntheticUserName | undefined;
  /** The events last read; kept in view while the next read runs. */
  readonly events: readonly SyntheticPopulationEventView[] | undefined;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly onRefresh: () => void;
};

function EventsScreen(props: SyntheticUserEventsScreenViewProps): JSX.Element {
  const refresh = useRefreshAction(props);
  return (
    <ContentScreen
      screenId="synthetic-user-events"
      breadcrumbs={syntheticUserCrumbs(props.user, {
        name: <Trans>Event timeline</Trans>,
      })}
      actions={refresh()}
      width="list"
    >
      <SyntheticPopulationEventsTable
        events={props.events}
        loading={props.loading}
        failed={props.failed}
        onRetry={() => props.onRefresh()}
      />
    </ContentScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users/:id/events`, presentational: what one
 * Synthetic User recorded, as a searchable table newest first; a row opens
 * its context read-only. Its loading, refreshing, failed, empty and denied
 * states are distinct. `SyntheticUserEventsScreen` wires it.
 */
export function SyntheticUserEventsScreenView(
  props: SyntheticUserEventsScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<EventsScreen {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
