import '../board-style-preload';
import './board.steps';
import './interaction-setup.steps';
import './interaction.steps';
import './feedback.steps';
import './special-moves.steps';
import './authority.steps';
import './options.steps';
import './annotation.steps';
import './premove.steps';
import './promotion.steps';
import './lifecycle.steps';
import './independence.steps';
import './keyboard.steps';
import './black-promotion.steps';
import './rapid-motion.steps';
import './opening.steps';
import './appearance.steps';
import { type BoardWorld, boardSystem } from '@pkgs/chess-board/harness';
import { setWorld } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

setWorld<Run<BoardWorld>>({
  create: () => boardSystem.run({ seed: 424242 }),
  dispose: (w) => w[Symbol.asyncDispose](),
});
