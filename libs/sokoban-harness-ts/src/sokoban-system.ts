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

/** The same game shipping only the first `count` starter puzzles: a model's example bound. */
function withStarters(
  game: ContentHarnessGame,
  count: number
): ContentHarnessGame {
  return {
    ...game,
    content: (rules) => {
      const content = game.content(rules);
      return {
        ...content,
        get rulesVersion() {
          return content.rulesVersion;
        },
        bundledPacks: (content.bundledPacks ?? []).map((pack) => ({
          ...pack,
          puzzles: pack.puzzles.slice(0, count),
        })),
      };
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

function sokobanSystemOf(name: string, game: ContentHarnessGame) {
  return defineSystem<SokobanHarness>({
    name,
    actions: [...SOKOBAN_ACTIONS],
    runtimes: [
      defineRuntime({
        name: 'virtual',
        default: true,
        create: () => syncVirtual(),
      }),
    ],
    create: (session) =>
      createContentWorld(session, { initialContent: true }, game),
  });
}

/** Four devices over Sokoban's rules, client, the shared Puzzles sub and sync. */
export const sokobanSystem = sokobanSystemOf('sokoban', SOKOBAN_GAME);

/** The models' world: their examples use three starter puzzles. */
export const sokobanModelSystem = sokobanSystemOf(
  'sokoban-models',
  withStarters(SOKOBAN_GAME, 3)
);
