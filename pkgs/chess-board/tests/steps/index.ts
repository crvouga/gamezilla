import './board.steps';
import { type BoardWorld, boardSystem } from '@pkgs/chess-board/harness';
import { setWorld } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

setWorld<Run<BoardWorld>>({
  create: () => boardSystem.run({ seed: 424242 }),
  dispose: (w) => w[Symbol.asyncDispose](),
});
