import { syntheticUserPath } from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createLiveRead } from '@pkgs/async-root-client-ts/live-read';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import type { EveryCommand } from './every-synthetic-user-controls';
import { useSyntheticPopulationApi } from './synthetic-population-api';
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
  const page = createLiveRead(
    () => ({
      q: search(),
      cursor: cursors().at(-1) ?? null,
      revision: revision(),
    }),
    (input) => api.directory(input.q, input.cursor)
  );
  return {
    page,
    search,
    cursors,
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
  const pages = useDirectoryPages(() => population.shown()?.observedAtMs ?? 0);
  return (
    <SyntheticUsersScreenView
      search={pages.search()}
      onSearch={pages.find}
      page={pages.page.shown()}
      loading={pages.page.loading()}
      failed={pages.page.failed()}
      onRetry={() => {
        void population.reread();
        void pages.page.reread();
      }}
      pageNumber={pages.cursors().length}
      onPrevious={pages.cursors().length > 1 ? pages.previous : undefined}
      onNext={(() => {
        const next = pages.page.shown()?.nextCursor;
        return next ? () => pages.next(next) : undefined;
      })()}
      overview={population.shown()}
      canInspect={inspect()}
      onOpenUser={(id) => router.push(syntheticUserPath(id))}
      canControl={control().allowed}
      controlDenial={control().allowed ? undefined : controlDenial()}
      onCommandAll={async (command: EveryCommand) => {
        await api.commandAll({ command, operationId: createId() });
        await population.reread();
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
