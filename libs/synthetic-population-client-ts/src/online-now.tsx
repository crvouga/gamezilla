import type { OnlineNowFilter } from '@libs/synthetic-population-shared-ts/live-session';
import { createResource, createSignal, type JSX } from 'solid-js';
import { OnlineNowView } from './online-now-view';
import { resourceValue } from './resource-value';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import {
  PRESENCE_CHANGES,
  useRefreshWithoutUpdates,
  useSyntheticPopulationUpdates,
} from './use-synthetic-population-updates';

/** Without live updates, the list is read again this often. */
const REFRESH_MS = 5_000;

/**
 * Whoever is online now, wired: reads the list per filter and again
 * whenever someone arrives, moves or leaves (or every few seconds where no
 * live updates are configured), and renders `OnlineNowView`.
 */
export function SyntheticPopulationOnlineNow(props: {
  canWatch: boolean;
  canControl: boolean;
  watch: (sessionId: string) => void;
  controlPanel: (syntheticUserId: string) => void;
}): JSX.Element {
  const api = useSyntheticPopulationApi();
  const [filter, setFilter] = createSignal<OnlineNowFilter>('everyone');
  const [list, { refetch }] = createResource(filter, (value) =>
    api.onlineNow(value)
  );
  useSyntheticPopulationUpdates(() => refetch(), PRESENCE_CHANGES);
  useRefreshWithoutUpdates(() => refetch(), REFRESH_MS);
  return (
    <OnlineNowView
      filter={filter()}
      entries={resourceValue(list)?.entries}
      loading={list.loading}
      failed={Boolean(list.error)}
      canWatch={props.canWatch}
      canControl={props.canControl}
      onFilterChange={setFilter}
      onWatch={(id) => props.watch(id)}
      onControlPanel={(id) => props.controlPanel(id)}
      onRetry={() => {
        void refetch();
      }}
    />
  );
}
