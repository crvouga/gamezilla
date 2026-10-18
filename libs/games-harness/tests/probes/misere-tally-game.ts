/**
 * Probe: a result the mover does not win. Two sides count on by one or two;
 * whoever counts to seven loses, so the move that ends the game is a loss
 * for the side that made it (`PlayedPosition.winner` is the other side).
 * Offers custom games only.
 */

import { defineGameClient } from '@libs/game-menu-client/game-client';
import type { GameFixtures } from '@libs/game-session-harness/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import type { TurnGameCapabilities } from '@pkgs/turn-game-shared/game-rules';
import { countRules, otherSide } from './count-rules';
import { probeAutomation, probePresentation } from './probe-parts';

export const MISERE_TALLY_RULES = countRules({
  id: 'misere-tally',
  steps: { one: 1, two: 2 },
  finish: 7,
  next: (_count, mover) => otherSide(mover),
  ending: (mover) => ({ winner: otherSide(mover), reason: 'counted to seven' }),
});

const CAPABILITIES = {
  'custom-games': {
    bots: {
      difficulties: [],
      choose: (position) => MISERE_TALLY_RULES.legal(position)[0] ?? null,
    },
  },
} satisfies TurnGameCapabilities;

const SHARED = defineTurnGame({
  rules: MISERE_TALLY_RULES,
  capabilities: CAPABILITIES,
  automation: probeAutomation(MISERE_TALLY_RULES),
});

/** The first side wins when the second is left to count from six to seven. */
const FIXTURES: GameFixtures<typeof CAPABILITIES> = {
  firstSideVictory: ['two', 'two', 'two', 'one'],
  firstSideVictoryLabels: ['two to 2', 'two to 4', 'two to 6', 'one to 7'],
  refusedOpenings: ['three', ''],
};

export const MISERE_TALLY_GAME = assertHarnessGame({
  label: 'misère tally',
  shared: SHARED,
  client: defineGameClient({
    shared: SHARED,
    title: 'Misère tally',
    caption: 'Leave the count of seven to the other side',
    subtitle: () => 'Whoever counts to seven loses.',
    presentation: probePresentation(MISERE_TALLY_RULES, {
      name: 'Misère tally',
      sides: { white: 'Ones', black: 'Twos' },
      endings: { 'counted to seven': 'The side that counted to seven lost.' },
    }),
  }),
  fixtures: FIXTURES,
});
