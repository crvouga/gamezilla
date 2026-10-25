import {
  type ContentHarness,
  type ContentHarnessGame,
  createContentWorld,
} from '@libs/game-puzzle-harness-ts/content-system';
import { createContentApp } from '@libs/game-puzzle-harness-ts/example-app';
import type { ExampleRules } from '@libs/game-puzzle-harness-ts/example-app-rules';
import { sokobanGameClient } from '@libs/sokoban-client-ts/sokoban-game-client';
import { initialSokobanDefinition } from '@libs/sokoban-shared-ts/sokoban-board-edits';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import { syncVirtual } from '@pkgs/sync-engine-harness-ts/scenario-boot';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { SOKOBAN_ACTIONS } from './sokoban-action-list';

/** Sokoban's real rules under a run's changeable rules version. */
function sokobanContentFor(rules: ExampleRules): PuzzleContent {
  return {
    ...sokobanPuzzleContent,
    get rulesVersion() {
      return sokobanPuzzleContent.rulesVersion + rules.version - 1;
    },
  };
}

const client = sokobanGameClient.puzzleContent;
if (client === undefined) throw new Error('Sokoban registers no puzzle client');

export const SOKOBAN_GAME: ContentHarnessGame = {
  id: 'sokoban',
  title: 'Sokoban',
  client,
  content: sokobanContentFor,
  app: (content) =>
    createContentApp([
      { id: 'sokoban', content, sample: initialSokobanDefinition() },
    ]),
};

export type SokobanHarness = ContentHarness;

/** Four devices over Sokoban's rules, client, the shared Puzzles sub and sync. */
export const sokobanSystem = defineSystem<SokobanHarness>({
  name: 'sokoban',
  actions: [...SOKOBAN_ACTIONS],
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => syncVirtual(),
    }),
  ],
  create: (session) =>
    createContentWorld(session, { initialContent: true }, SOKOBAN_GAME),
});
