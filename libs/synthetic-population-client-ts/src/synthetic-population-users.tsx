import { createResource, createSignal, type JSX } from 'solid-js';
import { resourceValue } from './resource-value';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import { SyntheticPopulationUsersView } from './synthetic-population-users-view';

/**
 * The Synthetic User directory, wired: reads one page per search, cursor and
 * observed revision, and renders `SyntheticPopulationUsersView`.
 */
export function SyntheticPopulationUsers(props: {
  observedAtMs: number;
  canInspect: boolean;
  inspect: (id: string) => void;
}): JSX.Element {
  const [filter, setFilter] = createSignal('');
  const [cursor, setCursor] = createSignal<string | null>(null);
  const api = useSyntheticPopulationApi();
  const [page, { refetch }] = createResource(
    () => ({ q: filter(), cursor: cursor(), revision: props.observedAtMs }),
    (input) => api.directory(input.q, input.cursor)
  );
  return (
    <SyntheticPopulationUsersView
      filter={filter()}
      page={resourceValue(page)}
      loading={page.loading}
      failed={Boolean(page.error)}
      paged={cursor() !== null}
      canInspect={props.canInspect}
      onFilterChange={(value) => {
        setCursor(null);
        setFilter(value);
      }}
      onFirstPage={() => setCursor(null)}
      onNextPage={(next) => setCursor(next)}
      onInspect={(id) => props.inspect(id)}
      onRetry={() => {
        void refetch();
      }}
    />
  );
}
