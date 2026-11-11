import { syntheticUserPath } from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createEffect, createResource, createSignal, type JSX } from 'solid-js';
import type { EveryCommand } from './every-synthetic-user-controls';
import { resourceValue } from './resource-value';
import {
  type SyntheticPopulationDirectoryPage,
  useSyntheticPopulationApi,
} from './synthetic-population-api';
import { SyntheticUsersScreenView } from './synthetic-users-screen-view';
import { useSyntheticPopulationOverview } from './use-synthetic-population-overview';

/**
 * The directory's pages: one per search and cursor, read again whenever
 * the population changes. The cursors walked so far make Previous work;
 * the last page read stays in view while the next loads or fails.
 */
function useDirectoryPages(revision: () => number) {
  const api = useSyntheticPopulationApi();
  const [search, setSearch] = createSignal('');
  const [cursors, setCursors] = createSignal<readonly (string | null)[]>([
    null,
  ]);
  const [page, { refetch }] = createResource(
    () => ({
      q: search(),
      cursor: cursors().at(-1) ?? null,
      revision: revision(),
    }),
    (input) => api.directory(input.q, input.cursor)
  );
  const [shown, setShown] = createSignal<SyntheticPopulationDirectoryPage>();
  createEffect(() => {
    const value = resourceValue(page);
    if (value !== undefined) setShown(value);
  });
  return {
    page,
    shown,
    search,
    cursors,
    refetch,
    find(value: string) {
      setCursors([null]);
      setSearch(value);
    },
    previous: () => setCursors((list) => list.slice(0, -1)),
    next: (cursor: string) => setCursors((list) => [...list, cursor]),
  };
}

function SyntheticUsersContent(): JSX.Element {
  const api = useSyntheticPopulationApi();
  const router = useRouter();
  const createId = useCreateId();
  const inspect = useCan(PERMISSION.syntheticPopulationInspect);
  const control = useDecision(PERMISSION.syntheticPopulationControl);
  const controlDenial = useDenialView({
    get decision() {
      return control();
    },
    testId: 'synthetic-population-control-denied',
  });
  const population = useSyntheticPopulationOverview();
  const pages = useDirectoryPages(
    () => resourceValue(population.overview)?.observedAtMs ?? 0
  );
  return (
    <SyntheticUsersScreenView
      search={pages.search()}
      onSearch={pages.find}
      page={pages.shown()}
      loading={pages.page.loading}
      failed={Boolean(pages.page.error)}
      onRetry={() => {
        void population.refetch();
        void pages.refetch();
      }}
      pageNumber={pages.cursors().length}
      onPrevious={pages.cursors().length > 1 ? pages.previous : undefined}
      onNext={(() => {
        const next = pages.shown()?.nextCursor;
        return next ? () => pages.next(next) : undefined;
      })()}
      overview={population.shown()}
      canInspect={inspect()}
      onOpenUser={(id) => router.push(syntheticUserPath(id))}
      canControl={control().allowed}
      controlDenial={control().allowed ? undefined : controlDenial()}
      onCommandAll={async (command: EveryCommand) => {
        await api.commandAll({ command, operationId: createId() });
        await population.refetch();
      }}
    />
  );
}

/** `/admin/observatory/synthetic-users/directory`: wires `SyntheticUsersScreenView`. */
export function SyntheticUsersScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationView);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-denied"
      denied={(denial) => (
        <SyntheticUsersScreenView
          denial={denial}
          search=""
          onSearch={() => undefined}
          page={undefined}
          loading={false}
          failed={false}
          onRetry={() => undefined}
          pageNumber={1}
          overview={undefined}
          canInspect={false}
          onOpenUser={() => undefined}
          canControl={false}
          onCommandAll={async () => undefined}
        />
      )}
    >
      <SyntheticUsersContent />
    </DecisionGate>
  );
}
