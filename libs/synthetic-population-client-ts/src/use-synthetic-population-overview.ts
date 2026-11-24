import { createLiveRead } from './live-read';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import {
  useRefreshWithoutUpdates,
  useSyntheticPopulationUpdates,
} from './use-synthetic-population-updates';

/** Without live updates, the overview is read again this often. */
const REFRESH_MS = 5_000;

/**
 * The Synthetic Population's overview (counts, workers, events), read
 * again on every live update (or every few seconds without them). Its
 * `shown` is the last overview read, kept while a later read runs or fails.
 */
export function useSyntheticPopulationOverview() {
  const api = useSyntheticPopulationApi();
  const overview = createLiveRead(
    () => true,
    () => api.overview()
  );
  useSyntheticPopulationUpdates(overview.reread);
  useRefreshWithoutUpdates(overview.reread, REFRESH_MS);
  return overview;
}
