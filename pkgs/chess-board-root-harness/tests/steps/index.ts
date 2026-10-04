import '@pkgs/chess-board-root-client/board-style-preload';
import type { BoardWorld } from '@pkgs/chess-board-root-harness/board-world';
import { boardSystem } from '@pkgs/chess-board-root-harness/chess-board';
import { setWorld } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-root-shared/run-types';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setWorld<Run<BoardWorld>>({
  create: () => boardSystem.run({ seed: 424242 }),
  dispose: (w) => w[Symbol.asyncDispose](),
});
