import '../board-style-preload';
import { type BoardWorld, boardSystem } from '@pkgs/chess-board/harness';
import { setWorld } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setWorld<Run<BoardWorld>>({
  create: () => boardSystem.run({ seed: 424242 }),
  dispose: (w) => w[Symbol.asyncDispose](),
});
