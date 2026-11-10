import type { OnlineNowFilter } from '@libs/observatory-shared-ts/live-session';
import { createEffect, createResource, createSignal, type JSX } from 'solid-js';
import type { OnlineNowEntryView } from './observatory-api';
import { useObservatoryApi } from './observatory-api';
import { OnlineNowView } from './online-now-view';
import { resourceValue } from './resource-value';
import {
  PRESENCE_CHANGES,
  useObservatoryUpdates,
  useRefreshWithoutUpdates,
} from './use-observatory-updates';

/** Without live updates, the list is read again this often. */
const REFRESH_MS = 5_000;

/**
 * Whoever is online now, wired: reads the list per filter and again
 * whenever someone arrives, moves or leaves (or every few seconds where no
 * live updates are configured), and renders `OnlineNowView`.
 */
export function OnlineNow(props: {
  canWatch: boolean;
  canControl: boolean;
  watch: (sessionId: string) => void;
  controlPanel: (syntheticUserId: string) => void;
}): JSX.Element {
  const api = useObservatoryApi();
  const [filter, setFilter] = createSignal<OnlineNowFilter>('everyone');
  const [list, { refetch }] = createResource(filter, (value) =>
    api.onlineNow(value)
  );
  // The last list read stays in view when a later read fails.
  const [shown, setShown] = createSignal<readonly OnlineNowEntryView[]>();
  createEffect(() => {
    const entries = resourceValue(list)?.entries;
    if (entries !== undefined) setShown(entries);
  });
  useObservatoryUpdates(() => refetch(), PRESENCE_CHANGES);
  useRefreshWithoutUpdates(() => refetch(), REFRESH_MS);
  return (
    <OnlineNowView
      filter={filter()}
      entries={shown()}
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
