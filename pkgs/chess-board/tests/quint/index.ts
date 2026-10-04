import '../board-style-preload';
import {
  type BoardWorld,
  boardSystem,
  CAPTURE,
  setupBoard,
} from '@pkgs/chess-board/harness';
import type { Run } from '@pkgs/harness';
import { setQuintWorld } from '@pkgs/quint/registry';

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
