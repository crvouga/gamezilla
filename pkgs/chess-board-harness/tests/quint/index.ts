import '@pkgs/chess-board-client/board-style-preload';
import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import { boardSystem, setupBoard } from '@pkgs/chess-board-harness/chess-board';
import { CAPTURE } from '@pkgs/chess-board-harness/positions';
import type { Run } from '@pkgs/harness-shared/run-types';
import { setQuintWorld } from '@pkgs/quint-shared/registry';

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setQuintWorld<Run<BoardWorld>>({
  create: async () => {
    const w = await boardSystem.run({ seed: 424242 });
    await w.apply(setupBoard, { fen: CAPTURE });
    await w.advanceTime(1000);
    return w;
  },
  dispose: (w) => w[Symbol.asyncDispose](),
});
