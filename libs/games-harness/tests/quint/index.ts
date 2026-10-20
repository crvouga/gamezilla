/**
 * Quint entry for the `specs/games/*.qnt` models: every model's binding,
 * each model replayed once for every conformance game offering what it shows
 * (`SHARED_SPECIFICATIONS`), named `<trace> [<game>]`, in a world where every
 * one of them is offered.
 */

import { useQuintHarness } from '@libs/harness/quint-world';
import { defineTraceVariants } from '@pkgs/quint-shared/registry';
import { puzzleLineLayout } from '@pkgs/turn-game-shared/game-puzzles';
import {
  conformanceGameOf,
  conformanceVariants,
  declareRequiredGames,
  openConformanceHarness,
} from '../conformance-world';

defineTraceVariants(({ specUri, parameters = [] }) =>
  conformanceVariants(specUri).map((variant) => ({
    ...variant,
    parameters: Object.fromEntries(
      parameters.map((name) => {
        const game = conformanceGameOf(variant, specUri);
        const puzzles = game.shared.turnGame.capabilities.puzzles;
        if (name !== 'OPPONENT' || puzzles === undefined)
          throw new Error(
            `${specUri}: no ${name} model input for ${variant.id}`
          );
        return [name, puzzleLineLayout(puzzles).solverStep === 2];
      })
    ),
  }))
);
declareRequiredGames();

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useQuintHarness(openConformanceHarness);
