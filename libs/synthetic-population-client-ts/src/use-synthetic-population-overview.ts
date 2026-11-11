import { createEffect, createResource, createSignal } from 'solid-js';
import { resourceValue } from './resource-value';
import {
  type SyntheticPopulationOverview,
  useSyntheticPopulationApi,
} from './synthetic-population-api';
import {
  useRefreshWithoutUpdates,
  useSyntheticPopulationUpdates,
} from './use-synthetic-population-updates';

/** Without live updates, the overview is read again this often. */
const REFRESH_MS = 5_000;

/**
 * The Synthetic Population's overview (counts, workers, events), read
 * again on every live update (or every few seconds without them). `shown`
 * is the last overview read, kept while a later read runs or fails.
 */
export function useSyntheticPopulationOverview() {
  const api = useSyntheticPopulationApi();
  const [overview, { refetch }] = createResource(() => api.overview());
  const [shown, setShown] = createSignal<SyntheticPopulationOverview>();
  createEffect(() => {
    const value = resourceValue(overview);
    if (value !== undefined) setShown(value);
  });
  useSyntheticPopulationUpdates(() => refetch());
  useRefreshWithoutUpdates(() => refetch(), REFRESH_MS);
  return { overview, shown, refetch };
}
