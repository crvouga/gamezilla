/**
 * Probe: a puzzle-first game, offering puzzles and nothing else — no custom
 * games, no finding an opponent, no history. It is the reference game's
 * rules, puzzles part and known puzzles under a definition offering only
 * puzzles, so what changes is exactly the capability set.
 */

import { defineGameClient } from '@libs/game-menu-client/game-client';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import type { TurnGameCapabilities } from '@pkgs/turn-game-shared/game-rules';
import {
  COUNTING_RACE_CLIENT,
  COUNTING_RACE_FIXTURES,
  COUNTING_RACE_GAME,
  COUNTING_RACE_PUZZLES,
  COUNTING_RACE_TURN_GAME,
} from '../reference-game/counting-race-game';

const CAPABILITIES = {
  puzzles: COUNTING_RACE_PUZZLES,
} satisfies TurnGameCapabilities;

const SHARED = defineTurnGame({
  rules: COUNTING_RACE_TURN_GAME.rules,
  capabilities: CAPABILITIES,
  automation: COUNTING_RACE_TURN_GAME.automation,
});

export const PUZZLE_ONLY_GAME = assertHarnessGame({
  label: 'puzzle-only counting race',
  shared: SHARED,
  client: defineGameClient({
    shared: SHARED,
    title: COUNTING_RACE_CLIENT.title,
    caption: COUNTING_RACE_CLIENT.caption,
    subtitle: COUNTING_RACE_CLIENT.subtitle,
    presentation: COUNTING_RACE_CLIENT.presentation,
    puzzles: COUNTING_RACE_CLIENT.puzzles,
  }),
  fixtures: COUNTING_RACE_FIXTURES,
  ...(COUNTING_RACE_GAME.puzzleSounds === undefined
    ? {}
    : { puzzleSounds: COUNTING_RACE_GAME.puzzleSounds }),
  ...(COUNTING_RACE_GAME.slice === undefined
    ? {}
    : { slice: COUNTING_RACE_GAME.slice }),
});
