import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { type JSX, Show } from 'solid-js';
import type { SyntheticPopulationEventView } from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { SyntheticPopulationEventsTable } from './synthetic-population-events-table';
import { panelCrumbs, useRefreshAction } from './synthetic-population-frame';

export type SyntheticPopulationEventsScreenViewProps = {
  /** Set when the person may not open the panel; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** The events last read; kept in view while the next read runs. */
  readonly events: readonly SyntheticPopulationEventView[] | undefined;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly onRefresh: () => void;
};

function EventsScreen(
  props: SyntheticPopulationEventsScreenViewProps
): JSX.Element {
  const refresh = useRefreshAction(props);
  return (
    <ContentScreen
      screenId="synthetic-population-events"
      breadcrumbs={panelCrumbs([{ name: <Trans>Events</Trans> }])}
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
 * `/admin/observatory/synthetic-users/events`, presentational: what the
 * Synthetic Population recorded, as a searchable table newest first; a row
 * opens its context read-only. Its loading, refreshing, failed, empty and
 * denied states are distinct. `SyntheticPopulationEventsScreen` wires it.
 */
export function SyntheticPopulationEventsScreenView(
  props: SyntheticPopulationEventsScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<EventsScreen {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
