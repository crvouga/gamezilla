import {
  type BoardWorld,
  boardSystem,
  CAPTURE,
  setupBoard,
} from '@pkgs/chess-board/harness';
import type { Run } from '@pkgs/harness';
import { setQuintWorld } from '@pkgs/quint/registry';

setQuintWorld<Run<BoardWorld>>({
  create: async () => {
    const w = await boardSystem.run({ seed: 424242 });
    await w.apply(setupBoard, { fen: CAPTURE });
    await w.advanceTime(1000);
    return w;
  },
  dispose: (w) => w[Symbol.asyncDispose](),
});

import './board-lifecycle.binding';
