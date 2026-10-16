import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { OpenHarness } from '@libs/harness/open-harness';
import sql from '@pkgs/sql-root-shared/sql';
import { scenarioSearchActors } from './multiplayer-search-ui';

const stopScenarioSearches = scenarioAction({
  name: 'stopScenarioSearches',
  act: async (s) => {
    for (const actor of scenarioSearchActors(s)) {
      const ui = await actorUi(s, actor);
      if (!(await ui.get('multiplayer-stop').isVisible())) continue;
      await ui.get('multiplayer-stop').tap();
      await pollUntil(
        s,
        async () => {
          if (await ui.get('multiplayer-waiting').isVisible()) return null;
          const db = s.actors.get(actor)?.localSql();
          if (db === null || db === undefined)
            throw new Error('Search cleanup needs the actor database');
          const rows = await db.query(sql<{ pending: number | string }>`
          SELECT COUNT(*) AS pending FROM sync_engine_mutations WHERE deleted_at IS NULL`);
          return Number(rows[0]?.pending) === 0 ? true : null;
        },
        {
          maxMs: 15000,
          description: 'scenario-owned search cancellation acknowledged',
        }
      );
    }
  },
});

/** Cancel only this scenario's unfinished searches before disposing its devices. */
export function withOpponentSearchCleanup(run: OpenHarness): OpenHarness {
  let disposed = false;
  return {
    ...run,
    async [Symbol.asyncDispose]() {
      if (disposed) return;
      disposed = true;
      try {
        await run.apply(stopScenarioSearches);
      } finally {
        await run[Symbol.asyncDispose]();
      }
    },
  };
}
