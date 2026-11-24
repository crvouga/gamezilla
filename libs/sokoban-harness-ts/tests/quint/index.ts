import type { SokobanHarness } from '@libs/sokoban-harness-ts/sokoban-system';
import { sokobanModelSystem } from '@libs/sokoban-harness-ts/sokoban-system';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { setQuintWorld } from '@pkgs/quint-shared-ts/registry';

const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setQuintWorld<Run<SokobanHarness>>({
  create: (ctx) => sokobanModelSystem.run({ seed: ctx.testId }),
  dispose: (run) => run[Symbol.asyncDispose](),
  settle: async (run, matches) => {
    try {
      await run.until(matches, { pred: Boolean, maxMs: 15000 });
    } catch {
      // The runner re-reads and reports the remaining state difference.
    }
  },
});
