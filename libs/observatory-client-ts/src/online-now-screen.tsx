import {
  ONLINE_NOW_FILTERS,
  type OnlineNowFilter,
} from '@libs/observatory-shared-ts/live-session';
import { liveWatchPath } from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { createKvState } from '@pkgs/kv-root-client-ts/solid';
import { enumKvCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { createEffect, createResource, createSignal, type JSX } from 'solid-js';
import { type OnlineNowEntryView, useObservatoryApi } from './observatory-api';
import { OnlineNowScreenView } from './online-now-screen-view';
import { resourceValue } from './resource-value';
import {
  PRESENCE_CHANGES,
  useObservatoryUpdates,
  useRefreshWithoutUpdates,
} from './use-observatory-updates';

/** Without live updates, the list is read again this often. */
const REFRESH_MS = 5_000;

/** Who this device last chose to show online now. */
const FILTER_KEY = asKeyword('observatory.online-now/filter');
const FILTER_CODEC = enumKvCodec<OnlineNowFilter>(
  asKeyword('observatory.online-now/value'),
  ONLINE_NOW_FILTERS
);

/**
 * Whoever is online now, wired: reads the list per filter and again
 * whenever someone arrives, moves or leaves (or every few seconds where no
 * live updates are configured), and renders `OnlineNowScreenView`. The
 * filter is this device's remembered choice, so leaving Online now and
 * coming back shows what was chosen; the list is read once it is known.
 */
function OnlineNowContent(): JSX.Element {
  const api = useObservatoryApi();
  const router = useRouter();
  const watch = useCan(PERMISSION.observatoryWatch);
  const [filterKnown, setFilterKnown] = createSignal(false);
  const [filter, setFilter] = createKvState<OnlineNowFilter>({
    key: FILTER_KEY,
    default: 'everyone',
    codec: FILTER_CODEC,
    onHydrated: () => setFilterKnown(true),
  });
  const [search, setSearch] = createSignal('');
  const [list, { refetch }] = createResource(
    () => (filterKnown() ? filter() : undefined),
    (value) => api.onlineNow(value)
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
    <OnlineNowScreenView
      filter={filter()}
      search={search()}
      entries={shown()}
      loading={list.loading}
      failed={Boolean(list.error)}
      canWatch={watch()}
      onFilterChange={(next) => setFilter(next)}
      onSearchChange={setSearch}
      onWatch={(id) => router.push(liveWatchPath(id))}
      onRetry={() => {
        void refetch();
      }}
    />
  );
}

/** `/admin/observatory/online`: wires `OnlineNowScreenView`. */
export function OnlineNowScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.observatoryView);
  return (
    <DecisionGate
      decision={decision()}
      testId="observatory-denied"
      denied={(denial) => (
        <OnlineNowScreenView
          denial={denial}
          filter="everyone"
          search=""
          entries={undefined}
          loading={false}
          failed={false}
          canWatch={false}
          onFilterChange={() => undefined}
          onSearchChange={() => undefined}
          onWatch={() => undefined}
          onRetry={() => undefined}
        />
      )}
    >
      <OnlineNowContent />
    </DecisionGate>
  );
}
