// @io-wall-ok — draws traces with the pinned checker into this spec run's report directory.
import { join } from 'node:path';
import { bindStructure } from '@pkgs/alloy-shared-ts/registry';
import type { Snapshot } from '@pkgs/alloy-shared-ts/world';
import { storedSearches } from '@pkgs/matchmaking-root-harness-ts/stored-searches';
import { simulate } from '@pkgs/quint-server-ts/simulate';
import { quintBinding, quintWorld } from '@pkgs/quint-shared-ts/registry';
import { replayTrace } from '@pkgs/quint-shared-ts/replay';
import '../quint/index';
import type { MatchmakingTraceWorld } from '../quint/world';
import { traceMatchmaking } from '../quint/world';
import { projectSearches } from './searches-project';

async function snapshots(): Promise<readonly Snapshot[]> {
  const specUri = 'specs/matchmaking/matching.qnt';
  const root = join(import.meta.dir, '../../../..');
  const drawn = simulate({
    specPath: join(root, specUri),
    traces: 8,
    maxSteps: 160,
    outDir: join(
      process.env['HARNESS_REPORT_DIR'] ??
        join(root, 'pkgs/matchmaking-root-harness-ts/.cache'),
      'alloy-draw'
    ),
  });
  const snapshots: Snapshot[] = [];
  const world = quintWorld();
  const seen = new Set<string>();
  for (const [index, trace] of drawn.traces.entries()) {
    await replayTrace({
      ctx: {
        packageName: '@pkgs/matchmaking-root-harness-ts',
        specUri,
        model: 'matching',
        trace: index + 1,
        seed: drawn.seed,
        testId: `searches.${String(index)}`,
        title: 'Persisted matchmaking history',
      },
      trace,
      binding: quintBinding('matching'),
      world: {
        ...world,
        record: async (w, meta, fn) => {
          const result = await fn();
          const rows = await traceMatchmaking(w as MatchmakingTraceWorld).read(
            storedSearches
          );
          const key = JSON.stringify(rows);
          if (!seen.has(key)) {
            seen.add(key);
            snapshots.push(
              projectSearches(rows, `trace ${String(index + 1)}: ${meta.title}`)
            );
          }
          return result;
        },
      },
    });
  }
  return snapshots;
}

bindStructure({
  spec: 'searches',
  snapshots: { 'server database': snapshots },
});
