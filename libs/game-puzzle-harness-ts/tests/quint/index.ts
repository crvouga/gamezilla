import type { ContentHarness } from '@libs/game-puzzle-harness-ts/content-system';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { setQuintWorld } from '@pkgs/quint-shared-ts/registry';

const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setQuintWorld<Run<ContentHarness>>({
  create: (ctx) => contentSystem.run({ seed: ctx.testId, report: true }),
  dispose: (run) => run[Symbol.asyncDispose](),
  record: (run, meta, fn) =>
    run.record({ kind: 'quint', title: meta.title, detail: meta.detail }, fn),
  settle: async (run, matches) => {
    try {
      await run.until(matches, { pred: Boolean, maxMs: 15000 });
    } catch {
      // The runner re-reads and reports the remaining state difference.
    }
  },
});
