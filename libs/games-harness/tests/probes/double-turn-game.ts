/**
 * Probe: turns that do not alternate. The first side moves twice, then the
 * second side once (first, first, second, first, first, second, …); who
 * counts to seven wins. Offers custom games only.
 */

import { defineGameClient } from '@libs/game-menu-client/game-client';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import type { TurnGameCapabilities } from '@pkgs/turn-game-shared/game-rules';
import { countRules } from './count-rules';
import { probeAutomation, probePresentation } from './probe-parts';

export const DOUBLE_TURN_RULES = countRules({
  id: 'double-turn',
  steps: { one: 1, two: 2 },
  finish: 7,
  // After counts 2 and 5 the second side moves; otherwise the first.
  next: (count) => (count % 3 === 2 ? 'black' : 'white'),
  ending: (mover) => ({ winner: mover, reason: 'counted to seven' }),
});

const CAPABILITIES = {
  'custom-games': {
    bots: {
      difficulties: [],
      choose: (position) => DOUBLE_TURN_RULES.legal(position)[0] ?? null,
    },
  },
} satisfies TurnGameCapabilities;

const SHARED = defineTurnGame({
  rules: DOUBLE_TURN_RULES,
  capabilities: CAPABILITIES,
  automation: probeAutomation(DOUBLE_TURN_RULES),
});

/**
 * The adapter, unchecked: `assertHarnessGame` takes it (it checks fixtures,
 * not turn order), and the rules laws then refuse it
 * (`turn-order.test.ts`).
 */
export const DOUBLE_TURN_GAME: HarnessGame<typeof CAPABILITIES> = {
  label: 'double turn',
  shared: SHARED,
  client: defineGameClient({
    shared: SHARED,
    title: 'Double turn',
    caption: 'Two counts, then one',
    subtitle: () => 'The first side counts twice in a row.',
    presentation: probePresentation(DOUBLE_TURN_RULES, {
      name: 'Double turn',
      sides: { white: 'Doubles', black: 'Singles' },
      endings: { 'counted to seven': 'Counted to seven first.' },
    }),
  }),
  fixtures: {
    // Movers: first, first, second, first, first, second, first.
    firstSideVictory: ['one', 'one', 'one', 'one', 'one', 'one', 'one'],
    firstSideVictoryLabels: [1, 2, 3, 4, 5, 6, 7].map(
      (count) => `one to ${String(count)}`
    ),
    refusedOpenings: ['three', ''],
  },
};
